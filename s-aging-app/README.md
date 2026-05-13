# S-Aging — Banana Disease Spread Simulator

An interactive web application that combines **YOLOv11 instance segmentation** with **Stochastic Cellular Automata (SCA)** to simulate the 3D spatio-temporal progression of banana diseases. Developed as a thesis project at **FEU Institute of Technology (2026)**.

---

## What it does

Upload a photo of a banana leaf (or use a built-in demo sample), configure environmental conditions, and watch a 30-month disease spread simulation rendered in real time using PyVista 3D.

Two pathogens are modeled:

| Disease | Pathogen | Spread model |
|---|---|---|
| **Fusarium Wilt TR4** | *Fusarium oxysporum* f. sp. *cubense* | Marginal-lateral (margin-first chlorosis) |
| **Black Sigatoka** | *Pseudocercospora fijiensis* | Longitudinal σ-β (streak coalescence) |

---

## Tech stack

**Frontend**
- React 19 + Vite
- Motion (Framer Motion v12)
- ONNX Runtime Web — runs YOLOv11-seg inference client-side
- Lucide React icons

**Backend**
- FastAPI (Python)
- Stochastic Cellular Automata engine (Moore 8-cell neighbourhood)
- PyVista — 3D leaf mesh rendering, streamed as NDJSON frames
- CLAHE + Gamma Correction preprocessing

---

## System Architecture

S-Aging uses a modern client-server architecture blending edge AI with a robust backend simulation engine.

### Data Flow Pipeline

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER DEVICES                               │
│  ┌───────────────────────┐                   ┌───────────────────────┐  │
│  │    Desktop Browser    │                   │     Mobile Browser    │  │
│  └───────────┬───────────┘                   └───────────┬───────────┘  │
└──────────────│───────────────────────────────────────────│──────────────┘
               └─────────────────────┬─────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                           CLIENT / FRONTEND                             │
│                                                                         │
│  ┌────────────────┐               ┌──────────────────┐                  │
│  │   React UI     │    Upload     │ Edge Inference   │                  │
│  │  (Three.js)    │ ────────────> │ YOLOv11-seg      │                  │
│  └─┬──┬───▲───────┘               │ (ONNX Web)       │                  │
│    │  │   │                       └────────┬─────────┘                  │
│    │  │   │                                │                            │
│    │  │   │    ┌───────────────────────────▼─────────┐                  │
│    │  │   │    │ Mask Refinement (HSV Color Seg)     │                  │
│    │  │   │    └───────────────────────────┬─────────┘                  │
│    │  │   │                                │                            │
└────│──│───│────────────────────────────────│────────────────────────────┘
     │  │   │                                │
     │  │   │ SSE Stream                     │ POST Request
     │  │   │ (3D Frames)                    │ (Grid+Params)
     │  │   │                                │
     │  │ ┌─│────────────────────────────────│────────────┐
     │  │ │ │         SERVER / BACKEND       │            │
     │  │ │ │                                │            │
     │  │ │ │  ┌───────────────┐    ┌────────▼─────────┐  │
     │  │ │ │  │FastAPI Stream │<───│ SCA Engine       │  │
     │  │ │ │  │Controller     │    │ (Moore 8-cell)   │  │
     │  │ │ │  └──────▲────────┘    └────────┬─────────┘  │
     │  │ │ │         │                      │            │
     │  │ │ │  ┌──────┴──────────────────────▼─────────┐  │
     │  │ │ │  │   PyVista 3D Mesh & Texture Updater   │  │
     │  │ │ │  │       (Bilinear Interpolation)        │  │
     │  │ │ │  └───────────────────────────────────────┘  │
     │  │ └─│─────────────────────────────────────────────┘
     │  │   │
     │  └─┐ │
     │    │ │ Auth & Profiles
     │    ▼ ▼
┌────▼─────────────────┐
│       DATABASE       │
│  Supabase (Postgres) │
│  + Custom Auth API   │
└──────────────────────┘
```

- **Edge Inference:** By using `onnxruntime-web`, the YOLOv11 segmentation runs entirely on the client's device, ensuring privacy and speed without needing image uploads.
- **Mask Processing:** The model's predictions are combined with a custom HSV color-segmentation algorithm (`detection.js`) to generate an accurate 160x100 infection grid.
- **Streaming Engine:** The FastAPI backend takes the grid and simulates the pathogen spread over time. It maps the 2D CA states onto a 3D leaf mesh using **bilinear interpolation** (`mesh.py`, `leaf_renderer.py`) for smooth color transitions, and streams the frames to the React frontend as soon as they are computed.

---

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.10+
- `pip install fastapi uvicorn pyvista numpy pillow`

### Run the frontend

```bash
cd s-aging-app
npm install
npm run dev
```

Opens at `http://localhost:5173` (or the next available port).

### Run the backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

The frontend streams simulation frames from `http://localhost:8001/api/simulate`.

> The simulation still works without the backend using demo-mode seeds, but the 3D PyVista leaf view requires the backend to be running.

---

## Project structure

```
s-aging-app/          # React + Vite frontend
  src/
    App.jsx           # All pages and UI components
    api.js            # SSE stream client for backend
    detection.js      # ONNX Runtime Web inference
    index.css         # Global styles

backend/
  main.py             # FastAPI app + /api/simulate endpoint
  sca_engine.py       # Stochastic CA simulation engine
  leaf_renderer.py    # PyVista 3D mesh renderer
  simulation/         # SCA helpers (environment, mask, mesh)
```

---

## Research team

| Name | Role |
|---|---|
| Jimiel D. Balitayo | BS Computer Science |
| Darryl B. Baranda | BS Computer Science |
| Yoel Dwayne G. Reyes | BS Computer Science |
| Justine Gabriel P. Rodriguez | BS Computer Science |

**Thesis adviser:** Mr. Anthony D. Aquino  
**Institution:** FEU Institute of Technology · March 2026

---

## Evaluation

The system is evaluated against:
- **Detection performance** — Mask mAP, Precision, Recall (YOLOv11-seg)
- **Simulation accuracy** — IoU, SSIM
- **Software quality** — ISO-25010 (Functionality, Performance, Interaction, Maintainability, Security)
