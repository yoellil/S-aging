# S-Aging — Banana Disease Spread Simulator

An interactive web application that combines **YOLOv11 instance segmentation** with **Stochastic Cellular Automata (SCA)** to simulate the 3D spatio-temporal progression of banana leaf diseases. Built as an undergraduate thesis project at **FEU Institute of Technology (2026)**.

---

## What it does

1. **Detect.** Upload a banana leaf photo (or pick a built-in demo). A YOLOv11-seg model runs entirely in-browser via ONNX Runtime Web and produces an instance mask.
2. **Configure.** Pick a disease, set temperature, relative humidity, and plant density.
3. **Simulate.** A Python SCA engine evolves a Moore-8 neighbourhood lattice over **31 monthly steps** (months 0–30) seeded from the YOLO mask.
4. **Visualise.** Each frame is rendered as a 3D leaf in PyVista, JPEG-encoded, and streamed back as NDJSON for live playback.
5. **Track.** A Supabase-backed auth + activity service records sessions, profile changes, and runs per user.

Two pathogens are modeled:

| Disease | Pathogen | Spread model |
|---|---|---|
| **Fusarium Wilt TR4** | *Fusarium oxysporum* f. sp. *cubense* | Marginal-lateral (margin-first chlorosis) |
| **Black Sigatoka** | *Pseudocercospora fijiensis* | Longitudinal σ-β (streak coalescence) |

---

## Architecture

```
┌─────────────────┐    ONNX inference    ┌──────────────────┐
│  React frontend │ ───────────────────▶ │  YOLOv11-seg     │
│  (Vite, port    │                      │  (in browser)    │
│   5173)         │                      └──────────────────┘
│                 │
│                 │    POST /api/simulate (NDJSON stream)
│                 │ ───────────────────▶ ┌──────────────────┐
│                 │                      │ FastAPI sim API  │
│                 │ ◀─────────────────── │ (port 8001)      │
│                 │   31 frames          │ SCA + PyVista    │
│                 │                      └──────────────────┘
│                 │
│                 │    Supabase JWT      ┌──────────────────┐
│                 │ ───────────────────▶ │ Auth/Logs API    │
│                 │ ◀─────────────────── │ (Node, port 3001)│
│                 │   profile + logs     │ + Supabase DB    │
└─────────────────┘                      └──────────────────┘
```

---

## Tech stack

**Frontend** — `s-aging-app/`
- React 19 + Vite 8
- Motion (Framer Motion v12) for transitions
- ONNX Runtime Web for client-side YOLOv11-seg inference
- `@supabase/supabase-js` for direct auth/profile reads
- Lucide React icons

**Simulation backend** — `backend/`
- FastAPI + Uvicorn
- Stochastic Cellular Automata engine (Moore 8-cell neighbourhood)
- PyVista + VTK for 3D leaf mesh rendering
- NumPy, SciPy, OpenCV, Pillow
- CLAHE + Gamma Correction preprocessing

**Auth & logging service** — `auth-service/`
- Node.js + Express 5
- Supabase (Postgres + Auth + Storage)
- bcryptjs, multer (profile picture uploads, 5 MB cap)

---

## Prerequisites

- Node.js 18+
- Python 3.10+
- A Supabase project (URL + anon key + service-role key)

---

## Setup

### 1. Database

Run [supabase_profiles_setup.sql](supabase_profiles_setup.sql) inside the Supabase SQL editor to create the `profiles` and `activity_logs` tables, RLS policies, and the `profile-pictures` storage bucket.

### 2. Frontend

```bash
cd s-aging-app
npm install
npm run dev
```

Create `s-aging-app/.env.local`:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_AUTH_API=http://localhost:3001
VITE_SIM_API=http://localhost:8001
```

Opens at `http://localhost:5173`.

### 3. Simulation backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

(Windows users can also run `start.bat`.)

### 4. Auth service

```bash
cd auth-service
npm install
npm run start
```

Create `auth-service/.env`:

```
PORT=3001
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
CORS_ORIGIN=http://localhost:5173
```

> The simulation runs in demo-mode without the FastAPI backend, but live PyVista frames require it. The auth service is required for sign-in, profile editing, and activity history.

---

## Project structure

```
.
├── README.md
├── supabase_profiles_setup.sql        # DB schema + RLS + storage bucket
├── train_yolov11_seg.ipynb            # YOLOv11-seg training notebook
│
├── s-aging-app/                       # React + Vite frontend
│   └── src/
│       ├── App.jsx                    # Landing, simulator, results pages
│       ├── AuthPage.jsx               # Login / register
│       ├── ProfilePage.jsx            # Profile + activity history
│       ├── api.js                     # NDJSON stream client
│       ├── detection.js               # ONNX Runtime Web inference
│       ├── profileApi.js              # Auth/profile HTTP client
│       ├── utils/supabase.js          # Supabase client
│       ├── main.jsx                   # Entry point
│       └── index.css                  # Global styles + design tokens
│
├── backend/                           # FastAPI simulation API
│   ├── main.py                        # /api/simulate NDJSON stream
│   ├── sca_engine.py                  # SCA driver
│   ├── leaf_renderer.py               # PyVista 3D renderer
│   ├── run_simulation.py              # CLI runner (no API)
│   ├── requirements.txt
│   └── simulation/
│       ├── sca.py                     # Moore-8 update rule
│       ├── environment.py             # Temp/RH/density modulation
│       ├── mask.py                    # Seed grid from YOLO mask
│       ├── mesh.py                    # Leaf mesh geometry
│       └── simulator.py               # Per-disease orchestration
│
└── auth-service/                      # Node + Express auth/log API
    └── src/
        ├── index.js                   # Routes
        ├── auth/                      # register, login
        ├── profile/                   # profile + picture upload
        ├── logging/                   # activity logger
        ├── middleware/                # Supabase JWT guard
        ├── config/supabase.js
        └── utils/errorHandler.js
```

---

## Key endpoints

**Simulation API** (`http://localhost:8001`)
- `GET  /api/health`
- `POST /api/simulate` → NDJSON stream of `{ step, month, image, stats, env }`

**Auth/logs API** (`http://localhost:3001`)
- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- `GET  /api/profile`, `PUT /api/profile`, `/api/profile/username`, `/api/profile/password`
- `POST /api/profile/picture`, `DELETE /api/profile/picture`
- `GET  /api/logs`, `/api/logs/stats`, `/api/logs/search`

---

## Evaluation

The system is evaluated against:
- **Detection performance** — Mask mAP, Precision, Recall (YOLOv11-seg)
- **Simulation accuracy** — IoU, SSIM against expert-annotated progressions
- **Software quality** — ISO/IEC 25010 (Functionality, Performance Efficiency, Interaction Capability, Maintainability, Security)

---

## Team

Thesis by Balitayo, Baranda, Reyes, and Rodriguez · Adviser: Mr. Anthony D. Aquino · BS Computer Science, FEU Institute of Technology, March 2026.
