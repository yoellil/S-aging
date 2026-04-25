"""
run_simulation.py — Demo entry point for the S-Aging simulation package.

Usage:
    python run_simulation.py                         # synthetic demo mask
    python run_simulation.py path/to/mask.png        # YOLOv11-seg mask
    python run_simulation.py mask.png fusarium_wilt  # override disease

This builds an SAgingSimulator, runs all time steps, and opens an interactive
PyVista window with a time slider.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

from simulation import SAgingSimulator


def _synthetic_mask(h: int = 200, w: int = 400) -> np.ndarray:
    """Small infected blobs so the simulation has something to spread from."""
    mask = np.zeros((h, w), dtype=np.float32)

    def blob(cy: int, cx: int, r: int, v: float = 1.0) -> None:
        y, x = np.ogrid[:h, :w]
        mask[(y - cy) ** 2 + (x - cx) ** 2 <= r * r] = v

    blob(h // 2 - 20, w // 4, 10)
    blob(h // 2 + 15, w // 2, 8)
    blob(h // 2,      3 * w // 4, 12)
    return mask


def main() -> None:
    argv = sys.argv[1:]
    mask_arg   = argv[0] if len(argv) >= 1 else None
    disease    = argv[1] if len(argv) >= 2 else "black_sigatoka"

    if mask_arg and Path(mask_arg).exists():
        mask = mask_arg
        print(f"[S-Aging] Using YOLO mask: {mask}")
    else:
        mask = _synthetic_mask()
        print("[S-Aging] No mask provided — using synthetic blob mask")

    sim = SAgingSimulator(
        mask=mask,
        disease=disease,
        temperature=27.0,
        humidity=85.0,
        plant_density="medium",
        grid_size=(200, 400),
        total_steps=50,
        seed=42,
    )

    print(f"[S-Aging] Initialising ({disease}, {sim.grid_size}, {sim.total_steps} steps)...")
    sim.initialize()

    print("[S-Aging] Running simulation...")
    sim.run_all()

    final = sim.stats_at(sim.total_steps)
    print(
        f"[S-Aging] Final: healthy={final['healthy_pct']:.1f}%  "
        f"infected={final['infected_pct']:.1f}%  "
        f"necrotic={final['necrotic_pct']:.1f}%"
    )
    print("[S-Aging] Opening interactive viewer...  (drag the time slider)")
    sim.visualize(interactive=True)


if __name__ == "__main__":
    main()
