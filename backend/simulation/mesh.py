"""
mesh.py — Procedural banana-leaf mesh + bilinear UV sampling of the SCA grid.

Two responsibilities:

1. `build_leaf_mesh(...)` constructs a triangulated PyVista PolyData
   resembling a Cavendish banana leaf (elongated lanceolate, central midrib,
   gentle lateral curl).  The mesh carries UV texture coordinates in [0, 1]²
   where u = along-length, v = across-width, midrib at v = 0.5.

2. `load_leaf_mesh(path)` reads an external .obj / .ply mesh and, if it
   doesn't already carry UV coordinates, auto-generates them by projecting
   the bounding box onto its XY plane.

3. `UVSampler` does bilinear sampling of a 2D SCA grid at arbitrary UV
   coordinates using `scipy.interpolate.RegularGridInterpolator`, so each
   mesh vertex can look up its current disease state.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional, Tuple

import numpy as np
import pyvista as pv
from scipy.interpolate import RegularGridInterpolator


# ── Procedural leaf mesh ─────────────────────────────────────────────────────

def _leaf_boundary(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """
    Return a boolean mask of the lanceolate leaf silhouette over a meshgrid
    (U, V) ∈ [-1, 1]².  U is along the leaf length (tip = +1, base = -1).
    """
    U, V = np.meshgrid(u, v)
    half_width = np.clip(1.0 - (np.abs(U) ** 1.6) / (0.96 ** 1.6), 0.0, 1.0)
    # Slight asymmetry: pointier tip, rounder base.
    tip_taper = np.where(U > 0, 1.0 - 0.22 * U, 1.0 + 0.08 * U)
    half_width = np.clip(half_width * tip_taper, 0.0, 1.0)
    return np.abs(V) <= half_width


def build_leaf_mesh(
    cols: int = 200,
    rows: int = 80,
    length: float = 3.4,
    width:  float = 0.85,
) -> pv.PolyData:
    """
    Procedural banana-leaf surface.  Cells outside the lanceolate boundary
    are dropped so the silhouette is leaf-shaped.  UV coords are baked in.
    """
    u = np.linspace(-1.0, 1.0, cols)
    v = np.linspace(-1.0, 1.0, rows)
    U, V = np.meshgrid(u, v)
    inside = _leaf_boundary(u, v)

    # 3-D surface: X along length, Y across width, Z has midrib ridge + curl.
    X = U * length
    Y = V * width
    midrib_ridge = 0.10 * np.exp(-V ** 2 / 0.06)
    lateral_curl = -0.07 * V ** 2
    tip_droop    = -0.04 * np.maximum(0.0, U) ** 2
    Z = midrib_ridge + lateral_curl + tip_droop

    pts = np.column_stack([X.ravel(), Y.ravel(), Z.ravel()]).astype(np.float32)

    # UV coordinates in [0, 1]² — u_tex = along length, v_tex = across width.
    tc_u = ((U + 1.0) / 2.0).ravel()
    tc_v = ((V + 1.0) / 2.0).ravel()
    tcoords = np.column_stack([tc_u, tc_v]).astype(np.float32)

    # Build quads whose four corners are all inside the leaf outline.
    cells = []
    for j in range(rows - 1):
        for i in range(cols - 1):
            if (inside[j,     i] and inside[j,     i + 1] and
                inside[j + 1, i] and inside[j + 1, i + 1]):
                p0 = j       * cols + i
                p1 = j       * cols + i + 1
                p2 = (j + 1) * cols + i + 1
                p3 = (j + 1) * cols + i
                cells.extend([4, p0, p1, p2, p3])

    mesh = pv.PolyData(pts, faces=np.array(cells, dtype=np.int64))
    mesh.active_texture_coordinates = tcoords
    mesh = mesh.clean()
    mesh.compute_normals(inplace=True, auto_orient_normals=True)
    return mesh


def load_leaf_mesh(path: str | Path) -> pv.PolyData:
    """
    Load a real leaf mesh and ensure it has UV texture coordinates.  If the
    file doesn't supply them, generate planar UVs from the XY bounding box.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Mesh file not found: {path}")
    mesh = pv.read(str(path))
    if isinstance(mesh, pv.MultiBlock):
        mesh = mesh.combine()
    mesh = mesh.extract_surface()

    if mesh.active_texture_coordinates is None:
        pts = mesh.points
        xmin, ymin = pts[:, 0].min(), pts[:, 1].min()
        xmax, ymax = pts[:, 0].max(), pts[:, 1].max()
        u = (pts[:, 0] - xmin) / max(xmax - xmin, 1e-9)
        v = (pts[:, 1] - ymin) / max(ymax - ymin, 1e-9)
        mesh.active_texture_coordinates = np.column_stack([u, v]).astype(np.float32)
    return mesh


# ── Leaf-boundary mask matching the procedural mesh (for the SCA grid) ───────

def leaf_mask_for_grid(grid_shape: Tuple[int, int]) -> np.ndarray:
    """
    Boolean mask of shape `grid_shape` marking cells that fall inside the
    procedural leaf silhouette.  This matches `build_leaf_mesh`.
    """
    rows, cols = grid_shape
    u = np.linspace(-1.0, 1.0, cols)
    v = np.linspace(-1.0, 1.0, rows)
    return _leaf_boundary(u, v)


# ── Bilinear UV sampler ──────────────────────────────────────────────────────

class UVSampler:
    """
    Bilinear sampler over the SCA grid.  Input grid indexing is (row, col) =
    (v, u); UV coordinates are in [0, 1] where u → col and v → row.
    """

    def __init__(self, grid_shape: Tuple[int, int]):
        rows, cols = grid_shape
        self._row_axis = np.linspace(0.0, 1.0, rows, dtype=np.float32)
        self._col_axis = np.linspace(0.0, 1.0, cols, dtype=np.float32)

    def sample(self, grid: np.ndarray, uv: np.ndarray) -> np.ndarray:
        """
        Sample `grid` at UV coordinates `uv` of shape (N, 2).  Returns a
        float32 array of length N with the bilinearly-interpolated state
        value in [0, 2].
        """
        interp = RegularGridInterpolator(
            (self._row_axis, self._col_axis),
            grid.astype(np.float32),
            method="linear",
            bounds_error=False,
            fill_value=0.0,
        )
        # RegularGridInterpolator expects (row, col) ordering.
        query = np.stack([uv[:, 1], uv[:, 0]], axis=1)
        return interp(query).astype(np.float32)
