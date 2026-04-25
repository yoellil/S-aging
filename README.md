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
