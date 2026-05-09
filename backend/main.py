"""
main.py — S-Aging FastAPI simulation backend.

Streams 31 PyVista-rendered frames (months 0-30) as NDJSON over HTTP.
Start with:  uvicorn main:app --reload --host 0.0.0.0 --port 8001
"""

import io
import json
import base64
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

# Renderer is expensive to initialise (builds the 3-D mesh once)
_renderer: Optional[LeafRenderer] = None


def get_renderer() -> LeafRenderer:
    global _renderer
    if _renderer is None:
        _renderer = LeafRenderer()
    return _renderer


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
    imageData: Optional[str] = None   # base64-encoded leaf photo from frontend
    maskGrid: Optional[List[int]] = None  # YOLO seg mask as flat 160×100 array (0/1/2)


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
    """
    engine = SCAEngine()
    renderer = get_renderer()

    dets = (
        [d.model_dump() for d in req.detections]
        if req.detections else None
    )

    # imageData is accepted but no longer used — the leaf is now rendered
    # synthetically for a clean, recognizable banana-leaf appearance.
    def generate():
        for frame in engine.run(
            disease=req.disease,
            temp=req.temp,
            rh=req.rh,
            density=req.density,
            months=req.months,
            detections=dets,
            img_w=req.imgWidth,
            img_h=req.imgHeight,
            mask_grid=req.maskGrid,
        ):
            img_bytes = renderer.render_frame(
                frame["grid"],
                frame["intensity"],
                req.disease,
            )
            img_b64 = base64.b64encode(img_bytes).decode()

            grid_u8       = frame["grid"].astype(np.uint8)
            intensity_u8  = (frame["intensity"] * 255).clip(0, 255).astype(np.uint8)
            gridData_b64      = base64.b64encode(grid_u8.ravel().tobytes()).decode()
            intensityData_b64 = base64.b64encode(intensity_u8.ravel().tobytes()).decode()

            payload = {
                "step":          frame["step"],
                "month":         frame["month"],
                "image":         img_b64,
                "gridData":      gridData_b64,
                "intensityData": intensityData_b64,
                "stats":         frame["stats"],
                "env":           frame["env"],
            }
            yield json.dumps(payload) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
