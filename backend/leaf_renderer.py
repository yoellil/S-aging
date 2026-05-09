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

try:
    from scipy.ndimage import gaussian_filter1d as _gf1d
    _HAS_GF1D = True
except ImportError:
    _HAS_GF1D = False

pv.OFF_SCREEN = True


def _blur_h(arr: np.ndarray, sigma_x: float, sigma_y: float) -> np.ndarray:
    """
    Anisotropic Gaussian blur with unambiguous axis semantics.
    axis=1 (columns) = horizontal direction = leaf-length direction.
    axis=0 (rows)    = vertical  direction = leaf-width  direction.
    Uses scipy when available; falls back to PIL GaussianBlur (x,y) convention.
    """
    a = arr.astype(np.float32)
    if _HAS_GF1D:
        a = _gf1d(a, sigma=sigma_x, axis=1)  # horizontal
        a = _gf1d(a, sigma=sigma_y, axis=0)  # vertical
        return a
    # PIL fallback — (x_radius, y_radius) per Pillow docs
    img = Image.fromarray(a.clip(0, 255).astype(np.uint8), mode="RGBA")
    img = img.filter(ImageFilter.GaussianBlur(radius=(sigma_x, sigma_y)))
    return np.array(img, dtype=np.float32)


# ── Disease palette (RGB float32) ────────────────────────────────────────────
# Black Sigatoka: pale yellowish-olive early streaks → dark brown/near-black lesions
_BS_INF_LO = np.array([232, 218,  22], dtype=np.float32)   # vivid yellow (early chlorosis)
_BS_INF_HI = np.array([  5,   2,   1], dtype=np.float32)   # near-black (mature "Black" Sigatoka lesion)
_BS_NEC_LO = np.array([  7,   3,   1], dtype=np.float32)   # black necrotic centre
_BS_NEC_HI = np.array([ 52,  48,  45], dtype=np.float32)   # dark ash-grey (desiccated tissue)

# Fusarium Wilt TR4: vivid yellow chlorosis → orange-brown wilting → rust-brown necrosis
_FW_INF_LO = np.array([252, 230,  14], dtype=np.float32)   # sulfur-yellow (chlorosis onset)
_FW_INF_HI = np.array([195,  72,  10], dtype=np.float32)   # warm orange-brown (wilting)
_FW_NEC_LO = np.array([112,  46,  12], dtype=np.float32)   # rust-brown necrosis
_FW_NEC_HI = np.array([ 48,  18,   5], dtype=np.float32)   # dark brown (dead tissue)

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
        self._spot_noise  = self._build_spot_noise()

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

    # ── Pre-computed spot noise for BS irregular blotches ────────────────────

    def _build_spot_noise(self, seed: int = 42) -> np.ndarray:
        """
        Multi-scale organic noise (TEX_H × TEX_W) in [0, 1].
        Used to break up the smooth alpha of BS lesions into irregular spots.
        """
        rng = np.random.default_rng(seed)
        # Coarse blobs
        coarse = rng.random((self.TEX_H // 6, self.TEX_W // 6)).astype(np.float32)
        coarse = np.array(
            Image.fromarray((coarse * 255).astype(np.uint8)).resize(
                (self.TEX_W, self.TEX_H), Image.BILINEAR
            ), dtype=np.float32
        ) / 255.0
        # Fine grain
        fine = rng.random((self.TEX_H, self.TEX_W)).astype(np.float32) * 0.22
        return np.clip(coarse * 0.78 + fine, 0.0, 1.0)

    # ── Disease overlay → RGBA at texture resolution ─────────────────────────

    def _disease_overlay_texture(self, grid, intensity, disease) -> np.ndarray:
        """
        Upsample the SCA state to texture resolution with disease-accurate colours.

        Black Sigatoka — two-pass composite:
          Pass 1 (halo): infected/necrotic cells → bright yellow, blurred widely
                         to produce the characteristic chlorotic ring around each lesion.
          Pass 2 (lesion): infected cells → olive-yellow→dark-brown streak (anisotropic
                           blur + spot noise); necrotic → near-black→grey desiccation.
          The halo is placed under the dark lesion so the yellow only shows at edges.

        Fusarium Wilt — single pass: vivid yellow chlorosis → orange-brown wilting,
                        soft isotropic blur for the margin-inward gradient.
        """
        is_fw = disease == "fusarium_wilt"
        flat  = grid.ravel().astype(np.int32)
        iv    = intensity.ravel().astype(np.float32)

        infected_flat = flat == 1
        necrotic_flat = flat == 2

        # ── Fusarium Wilt: two-pass (yellow chlorosis band + orange-brown wilt) ─
        # FW signature: vivid yellow band sweeping inward from both leaf margins,
        # maturing into orange-brown/rust as the xylem blockage progresses.
        # No spots — smooth gradient bands are the defining visual pattern.
        if is_fw:
            iv2d  = iv.reshape(self.ROWS, self.COLS)
            inf2d = infected_flat.reshape(self.ROWS, self.COLS)
            nec2d = necrotic_flat.reshape(self.ROWS, self.COLS)

            # Pass 1 — vivid yellow chlorosis band.
            # axis=0 (rows = leaf WIDTH = V-axis) gets the wide sigma so the yellow
            # band sweeps from both margins inward toward the midrib.
            # axis=1 (cols = leaf LENGTH) gets a narrow sigma — FW bands run across
            # the leaf, not along it.
            chloro = np.zeros((self.ROWS, self.COLS, 4), dtype=np.uint8)
            if inf2d.any():
                chloro[inf2d] = [252, 230, 14, 230]
            chloro_arr = np.array(
                Image.fromarray(chloro, mode="RGBA")
                .resize((self.TEX_W, self.TEX_H), Image.BICUBIC),
                dtype=np.float32,
            )
            chloro_arr = _blur_h(chloro_arr, sigma_x=5.0, sigma_y=20.0)
            chloro_img = Image.fromarray(chloro_arr.clip(0, 255).astype(np.uint8), mode="RGBA")

            # Pass 2 — orange-brown wilting / rust-brown necrosis overlay.
            # Alpha for infected cells ramps from 0 → 0.88 with intensity so
            # early cells show pure yellow and mature cells show orange-brown.
            wilt = np.zeros((self.ROWS, self.COLS, 4), dtype=np.float32)
            if inf2d.any():
                col = _FW_INF_LO + iv2d[inf2d, np.newaxis] * (_FW_INF_HI - _FW_INF_LO)
                wilt[inf2d, :3] = col
                wilt[inf2d, 3]  = np.clip(0.88 * iv2d[inf2d], 0.0, 0.88) * 255
            if nec2d.any():
                col = _FW_NEC_LO + iv2d[nec2d, np.newaxis] * (_FW_NEC_HI - _FW_NEC_LO)
                wilt[nec2d, :3] = col
                wilt[nec2d, 3]  = np.clip(0.82 + 0.15 * iv2d[nec2d], 0.82, 0.97) * 255
            wilt_arr = np.array(
                Image.fromarray(wilt.astype(np.uint8), mode="RGBA")
                .resize((self.TEX_W, self.TEX_H), Image.BICUBIC),
                dtype=np.float32,
            )
            wilt_arr = _blur_h(wilt_arr, sigma_x=4.0, sigma_y=9.0)
            wilt_img = Image.fromarray(wilt_arr.clip(0, 255).astype(np.uint8), mode="RGBA")

            # Composite: yellow chlorosis base, orange-brown wilt on top
            canvas = Image.alpha_composite(chloro_img, wilt_img)
            return np.array(canvas, dtype=np.uint8)

        # ── Black Sigatoka: two-pass (yellow halo + dark streak lesion) ───────
        iv2d  = iv.reshape(self.ROWS, self.COLS)
        inf2d = infected_flat.reshape(self.ROWS, self.COLS)
        nec2d = necrotic_flat.reshape(self.ROWS, self.COLS)

        # Pass 1 — yellow chlorosis halo.
        # Alpha fades as intensity rises: only the advancing front shows yellow;
        # mature high-intensity lesions are black and no longer chlorotic.
        halo = np.zeros((self.ROWS, self.COLS, 4), dtype=np.float32)
        if inf2d.any():
            # Full yellow at iv=0 (early), fades to 0 at iv≥0.65 (mature black lesion)
            halo_a = np.clip((1.0 - 1.55 * iv2d[inf2d]) * 215, 0, 215)
            halo[inf2d, 0] = 242; halo[inf2d, 1] = 222; halo[inf2d, 2] = 16
            halo[inf2d, 3] = halo_a
        if nec2d.any():
            # Necrotic cells shed a dim yellow only if still young (low intensity)
            halo_a = np.clip((0.5 - iv2d[nec2d]) * 140, 0, 140)
            halo[nec2d, 0] = 210; halo[nec2d, 1] = 185; halo[nec2d, 2] = 10
            halo[nec2d, 3] = halo_a
        halo_arr = np.array(
            Image.fromarray(halo.astype(np.uint8), mode="RGBA")
            .resize((self.TEX_W, self.TEX_H), Image.BICUBIC),
            dtype=np.float32,
        )
        # sigma_x=42 (horizontal = leaf-length): wide halo along veins
        # sigma_y=9  (vertical  = leaf-width):   moderate cross-vein spread
        halo_arr = _blur_h(halo_arr, sigma_x=42, sigma_y=9)
        halo_img = Image.fromarray(halo_arr.clip(0, 255).astype(np.uint8), mode="RGBA")

        # Pass 2 — black spots and streaks.
        # NEAREST upscale preserves cell boundaries so individual SCA cells
        # remain as distinct spots rather than blending into a smooth patch.
        # A very wide horizontal / very narrow vertical blur then elongates
        # each spot into the characteristic vein-parallel black streak.
        lesion = np.zeros((self.ROWS, self.COLS, 4), dtype=np.float32)
        if inf2d.any():
            col = _BS_INF_LO + iv2d[inf2d, np.newaxis] * (_BS_INF_HI - _BS_INF_LO)
            lesion[inf2d, :3] = col
            lesion[inf2d, 3] = np.clip(0.50 + 0.48 * iv2d[inf2d], 0.50, 0.98) * 255
        if nec2d.any():
            col = _BS_NEC_LO + iv2d[nec2d, np.newaxis] * (_BS_NEC_HI - _BS_NEC_LO)
            lesion[nec2d, :3] = col
            lesion[nec2d, 3] = np.clip(0.88 + 0.10 * iv2d[nec2d], 0.88, 0.98) * 255
        lesion_img = Image.fromarray(lesion.astype(np.uint8), mode="RGBA")
        lesion_img = lesion_img.resize((self.TEX_W, self.TEX_H), Image.NEAREST)
        arr = np.array(lesion_img, dtype=np.float32)
        # Elongate along axis=1 (columns = horizontal = leaf-length direction)
        # sigma_x=55px ≈ 9 cells wide; sigma_y=0.9px keeps vertical extent very tight
        arr = _blur_h(arr, sigma_x=55, sigma_y=0.9)
        arr[..., 3] = np.clip(arr[..., 3] * (0.20 + 0.80 * self._spot_noise), 0, 255)
        lesion_img = Image.fromarray(arr.clip(0, 255).astype(np.uint8), mode="RGBA")

        # Composite: yellow chlorosis halo underneath, black streaks on top.
        canvas = Image.alpha_composite(halo_img, lesion_img)
        return np.array(canvas, dtype=np.uint8)

    # ── Public frame render ───────────────────────────────────────────────────

    def render_frame(
        self,
        grid: np.ndarray,
        intensity: np.ndarray,
        disease: str,
        leaf_img_arr=None,   # accepted but unused — leaf is rendered synthetically
        width: int = 960,
        height: int = 480,
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
