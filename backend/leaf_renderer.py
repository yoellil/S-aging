"""
leaf_renderer.py — PyVista 3D banana-leaf renderer for S-Aging.

Phase 5 of the plan: bilinear interpolation of the 160×100 SCA grid onto a
3-D PyVista mesh of the Cavendish banana leaf.  The mesh is trimmed to the
lanceolate leaf boundary (no rectangular corners), and a PIL-painted RGBA
texture is applied via proper UV texture mapping so the surface appears as
a real banana leaf with midrib + lateral veins + disease overlay, never as
a grid of cell colours.
"""

import io
import numpy as np
import pyvista as pv
from PIL import Image, ImageFilter

pv.OFF_SCREEN = True


# ── Disease palette (RGB uint8) ───────────────────────────────────────────────
_FW_INF_LO = np.array([225, 220,  70], dtype=np.float32)
_FW_INF_HI = np.array([185, 120,  25], dtype=np.float32)
_BS_INF_LO = np.array([160, 140,  45], dtype=np.float32)
_BS_INF_HI = np.array([ 80,  40,  10], dtype=np.float32)
_NEC_LO    = np.array([ 95,  55,  18], dtype=np.float32)
_NEC_HI    = np.array([ 25,  12,   4], dtype=np.float32)

_BG_HEX  = "#0B180B"


class LeafRenderer:
    # SCA grid (matches SCAEngine)
    COLS: int = 160
    ROWS: int = 100

    # Texture resolution (painted leaf image)
    TEX_W: int = 960
    TEX_H: int = 320

    # 3-D mesh resolution — dense enough to be smooth, trimmed to leaf shape
    MESH_COLS: int = 200
    MESH_ROWS: int = 80

    def __init__(self):
        self.mesh         = self._build_leaf_mesh()
        self.base_texture = self._build_base_leaf_texture()

    # ── 3D leaf mesh (Phase 5) ────────────────────────────────────────────────

    def _build_leaf_mesh(self) -> pv.PolyData:
        """
        Lanceolate Musa-acuminata leaf surface built as a triangulated
        PolyData.  Only cells inside the leaf boundary are retained so the
        rendered silhouette is leaf-shaped (not a rectangle).
        UV texture coordinates are baked in for texture mapping.
        """
        u = np.linspace(-1.0, 1.0, self.MESH_COLS)
        v = np.linspace(-1.0, 1.0, self.MESH_ROWS)
        U, V = np.meshgrid(u, v)

        # Banana-leaf silhouette: high exponent keeps the middle wide and flat,
        # then tapers sharply toward both tip and base — much closer to real
        # Cavendish geometry than a low-exponent ellipse.
        half_width = np.clip(1.0 - (np.abs(U) ** 2.8) / (0.97 ** 2.8), 0.0, 1.0)
        tip_taper  = np.where(U > 0, 1.0 - 0.30 * U, 1.0 + 0.06 * U)
        half_width = np.clip(half_width * tip_taper, 0.0, 1.0)
        inside = np.abs(V) <= half_width

        # 3-D coordinates: gentle curl + midrib lift
        X = U * 3.4
        Y = V * 1.15
        midrib_ridge = 0.10 * np.exp(-V ** 2 / 0.06)
        lateral_curl = -0.07 * V ** 2
        tip_droop    = -0.04 * np.maximum(0.0, U) ** 2
        Z = midrib_ridge + lateral_curl + tip_droop

        # Build points (flattened)
        pts = np.column_stack([X.ravel(), Y.ravel(), Z.ravel()]).astype(np.float32)

        # UV texture coordinates: u → [0, 1] along length, v → [0, 1] across width
        tc_u = ((U + 1.0) / 2.0).ravel()
        tc_v = ((V + 1.0) / 2.0).ravel()
        tcoords = np.column_stack([tc_u, tc_v]).astype(np.float32)

        # Build quad cells, but ONLY include quads whose four corners are all
        # inside the leaf boundary — this removes the rectangular outline.
        cells = []
        for j in range(self.MESH_ROWS - 1):
            for i in range(self.MESH_COLS - 1):
                if (inside[j,     i] and inside[j,     i + 1] and
                    inside[j + 1, i] and inside[j + 1, i + 1]):
                    p0 = j       * self.MESH_COLS + i
                    p1 = j       * self.MESH_COLS + i + 1
                    p2 = (j + 1) * self.MESH_COLS + i + 1
                    p3 = (j + 1) * self.MESH_COLS + i
                    cells.extend([4, p0, p1, p2, p3])

        mesh = pv.PolyData(pts, faces=np.array(cells, dtype=np.int64))
        mesh.active_texture_coordinates = tcoords
        mesh = mesh.clean()                           # drop unused points
        mesh.compute_normals(inplace=True, auto_orient_normals=True)
        return mesh

    # ── Paint the base banana-leaf texture (midrib + veins + green blade) ────

    def _build_base_leaf_texture(self) -> np.ndarray:
        """Returns (TEX_H, TEX_W, 3) uint8 — used as the leaf's base texture."""
        W, H = self.TEX_W, self.TEX_H
        u = np.linspace(-1.0, 1.0, W)
        v = np.linspace(-1.0, 1.0, H)
        U, V = np.meshgrid(u, v)

        half_width = np.clip(1.0 - (np.abs(U) ** 2.8) / (0.97 ** 2.8), 0.0, 1.0)
        tip_taper  = np.where(U > 0, 1.0 - 0.30 * U, 1.0 + 0.06 * U)
        half_width = np.clip(half_width * tip_taper, 0.0, 1.0)
        leaf_mask  = np.abs(V) <= half_width

        # Base green
        v_norm     = np.clip(np.abs(V) / np.maximum(half_width, 1e-3), 0.0, 1.0)
        edge_shade = 1.0 - 0.38 * (v_norm ** 1.6)
        tip_warm   = 1.0 + 0.12 * np.clip(U, -0.2, 1.0)

        base = np.zeros((H, W, 3), dtype=np.float32)
        base[..., 0] = 54  * edge_shade * tip_warm
        base[..., 1] = 136 * edge_shade
        base[..., 2] = 38  * edge_shade

        # Lateral veins — ~44 parallel lines, tilted slightly back toward base
        vein_freq  = 22.0
        vein_phase = U * vein_freq + v_norm * 0.22 * vein_freq
        vein_band  = np.cos(vein_phase * np.pi)
        vein_strip = np.clip(np.abs(vein_band) ** 10, 0.0, 1.0)
        vein_boost = 24.0 * vein_strip * (1.0 - v_norm * 0.5)
        base[..., 0] += vein_boost * 0.55
        base[..., 1] += vein_boost * 1.05
        base[..., 2] += vein_boost * 0.30

        # Midrib band
        mdist       = np.abs(V)
        midrib_core = np.exp(-(mdist ** 2) / 0.0020)
        midrib_halo = np.exp(-(mdist ** 2) / 0.010)
        base[..., 0] -= 30.0 * midrib_halo + 14.0 * midrib_core
        base[..., 1] -= 45.0 * midrib_halo + 26.0 * midrib_core
        base[..., 2] -= 22.0 * midrib_halo + 10.0 * midrib_core

        rng = np.random.default_rng(11)
        base += rng.integers(-5, 6, base.shape).astype(np.float32)
        base = np.clip(base, 0, 255).astype(np.uint8)

        # Outside leaf → the mesh doesn't cover this, but paint it anyway
        base[~leaf_mask] = (11, 24, 10)
        return base

    # ── Disease overlay → RGBA at texture resolution ─────────────────────────

    def _disease_overlay_texture(self, grid, intensity, disease) -> np.ndarray:
        """Bilinear-upsample the SCA state to texture resolution as RGBA."""
        n    = self.ROWS * self.COLS
        flat = grid.ravel().astype(np.int32)
        iv   = intensity.ravel().astype(np.float32)

        ov = np.zeros((n, 4), dtype=np.float32)

        infected = flat == 1
        if infected.any():
            ivf = iv[infected, np.newaxis]
            if disease == "fusarium_wilt":
                col = _FW_INF_LO + ivf * (_FW_INF_HI - _FW_INF_LO)
            else:
                col = _BS_INF_LO + ivf * (_BS_INF_HI - _BS_INF_LO)
            ov[infected, :3] = col
            ov[infected,  3] = np.clip(0.50 + 0.45 * iv[infected], 0.50, 0.92) * 255

        necrotic = flat == 2
        if necrotic.any():
            ivn = iv[necrotic, np.newaxis]
            col = _NEC_LO + ivn * (_NEC_HI - _NEC_LO)
            ov[necrotic, :3] = col
            ov[necrotic,  3] = np.clip(0.78 + 0.18 * iv[necrotic], 0.78, 0.96) * 255

        rgba_sca = ov.reshape(self.ROWS, self.COLS, 4).astype(np.uint8)

        pil = Image.fromarray(rgba_sca, mode="RGBA").resize(
            (self.TEX_W, self.TEX_H), Image.BICUBIC
        )
        pil = pil.filter(ImageFilter.GaussianBlur(radius=2.0))
        return np.array(pil, dtype=np.uint8)

    # ── Public frame render ───────────────────────────────────────────────────

    def render_frame(
        self,
        grid: np.ndarray,
        intensity: np.ndarray,
        disease: str,
        leaf_img_arr=None,
        width: int = 900,
        height: int = 320,
        jpeg_quality: int = 90,
        **kwargs,
    ) -> bytes:
        # 1. Compose overlay over base → final RGB texture
        ov   = self._disease_overlay_texture(grid, intensity, disease)
        base = self.base_texture.astype(np.float32)
        ov_rgb = ov[..., :3].astype(np.float32)
        ov_a   = ov[..., 3:4].astype(np.float32) / 255.0
        blended = (1.0 - ov_a) * base + ov_a * ov_rgb
        rgb = np.clip(blended, 0, 255).astype(np.uint8)

        # 2. Build PyVista texture from numpy RGB
        texture = pv.numpy_to_texture(rgb)

        # 3. Render on 3-D mesh
        pl = pv.Plotter(off_screen=True, window_size=[width, height])
        pl.set_background(_BG_HEX)

        pl.add_mesh(
            self.mesh,
            texture=texture,
            smooth_shading=True,
            show_edges=False,
            ambient=0.80,
            diffuse=0.30,
            specular=0.06,
        )

        # Orthographic-ish camera looking down on the leaf surface.
        # Leaf X spans ±3.4; window ratio 900/320 ≈ 2.81 → parallel_scale
        # must satisfy 3.4 / 2.81 ≤ parallel_scale → use 1.25 for margin.
        pl.camera.enable_parallel_projection()
        pl.camera_position = [
            (0.0, -0.8, 8.0),     # slightly in front + above for subtle 3-D
            (0.0,  0.0, 0.0),
            (0.0,  1.0, 0.1),     # X is screen-horizontal (long axis)
        ]
        pl.camera.parallel_scale = 1.30

        pl.remove_all_lights()
        pl.add_light(pv.Light(
            position=(0, 0, 12), focal_point=(0, 0, 0),
            intensity=0.9, light_type="scene light",
        ))
        pl.add_light(pv.Light(
            position=(4, -3, 8), focal_point=(0, 0, 0),
            intensity=0.35, light_type="scene light",
        ))

        img_out = pl.screenshot(return_img=True)
        pl.close()

        buf = io.BytesIO()
        Image.fromarray(img_out).save(
            buf, format="JPEG", quality=jpeg_quality, optimize=True
        )
        return buf.getvalue()
