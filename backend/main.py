"""
main.py — S-Aging FastAPI simulation backend.

Streams 31 PyVista-rendered frames (months 0-30) as NDJSON over HTTP.
Start with:  uvicorn main:app --reload --host 0.0.0.0 --port 8001
"""

import io
import json
import base64
import queue
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional, List

import numpy as np
from PIL import Image as PILImage

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from sca_engine import SCAEngine
from leaf_renderer import LeafRenderer

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(title="S-Aging Simulation API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ── Renderer pool (one instance per worker thread, shared across requests) ────

_RENDER_WORKERS = 10
_renderer_queue: Optional[queue.Queue] = None
_renderer_init_lock = threading.Lock()


def _get_renderer_queue() -> queue.Queue:
    global _renderer_queue
    if _renderer_queue is None:
        with _renderer_init_lock:
            if _renderer_queue is None:
                q: queue.Queue = queue.Queue()
                for _ in range(_RENDER_WORKERS):
                    q.put(LeafRenderer())
                _renderer_queue = q
    return _renderer_queue


# ── Request schema ────────────────────────────────────────────────────────────

class DetectionItem(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    score: float
    diseaseKey: str
    className: str = ""


class SimRequest(BaseModel):
    disease: str = "black_sigatoka"
    temp: float = 26.0
    rh: float = 85.0
    density: str = "medium"
    months: int = 30
    detections: Optional[List[DetectionItem]] = None
    imgWidth: Optional[int] = None
    imgHeight: Optional[int] = None
    imageData: Optional[str] = None
    maskGrid: Optional[List[int]] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "S-Aging Simulation API"}


@app.post("/api/simulate")
async def simulate(req: SimRequest):
    """
    Run the full SCA simulation and stream 31 NDJSON frames (one per month).
    Each line:
      { step, month, image: "<base64-JPEG>", stats: {...}, env: {...} }

    Strategy: collect all SCA steps first (fast, pure numpy), then render
    all frames in parallel using a pool of LeafRenderer instances, then
    stream results in order.
    """
    engine = SCAEngine()
    dets = (
        [d.model_dump() for d in req.detections]
        if req.detections else None
    )

    def generate():
        # Step 1: run all SCA steps eagerly (fast — pure numpy, ~1-2s)
        frames = list(engine.run(
            disease=req.disease,
            temp=req.temp,
            rh=req.rh,
            density=req.density,
            months=req.months,
            detections=dets,
            img_w=req.imgWidth,
            img_h=req.imgHeight,
            mask_grid=req.maskGrid,
        ))

        # Step 2: render all frames in parallel using the renderer pool
        rq = _get_renderer_queue()
        disease = req.disease

        def render_one(frame):
            renderer = rq.get()
            try:
                img_bytes = renderer.render_frame(
                    frame["grid"], frame["intensity"], disease
                )
                return frame, img_bytes
            except Exception as e:
                print(f"[render_one] frame {frame.get('step')} failed: {e}")
                return None
            finally:
                rq.put(renderer)

        # Step 3: stream frames in order as each finishes rendering
        # pending holds completed-but-not-yet-emitted frames keyed by index
        pending = {}
        next_to_emit = 0

        with ThreadPoolExecutor(max_workers=_RENDER_WORKERS) as pool:
            futures = {pool.submit(render_one, f): i for i, f in enumerate(frames)}
            for fut in as_completed(futures):
                idx = futures[fut]
                try:
                    pending[idx] = fut.result()
                except Exception as e:
                    print(f"[simulate] future {idx} raised: {e}")
                    pending[idx] = None

                # emit any consecutive frames we now have in order
                while next_to_emit in pending:
                    result = pending.pop(next_to_emit)
                    next_to_emit += 1

                    if result is None:
                        continue  # skip frames that failed to render

                    frame, img_bytes = result
                    img_b64 = base64.b64encode(img_bytes).decode()
                    grid_u8      = frame["grid"].astype(np.uint8)
                    intensity_u8 = (frame["intensity"] * 255).clip(0, 255).astype(np.uint8)
                    gridData_b64      = base64.b64encode(grid_u8.ravel().tobytes()).decode()
                    intensityData_b64 = base64.b64encode(intensity_u8.ravel().tobytes()).decode()

                    yield json.dumps({
                        "step":          frame["step"],
                        "month":         frame["month"],
                        "image":         img_b64,
                        "gridData":      gridData_b64,
                        "intensityData": intensityData_b64,
                        "stats":         frame["stats"],
                        "env":           frame["env"],
                    }) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
