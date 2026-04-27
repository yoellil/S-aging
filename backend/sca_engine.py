"""
sca_engine.py — Stochastic Cellular Automata simulation engine for S-Aging.

Disease-specific parameters are grounded in peer-reviewed literature:
  Black Sigatoka: Maxapress 2024 (Sigatoka leaf spot complex overview)
                  Springer 2024 (black sigatoka standard area diagram)
  Fusarium Wilt:  MDPI Agronomy 2021 (FW agro-environmental factors, Venezuela)

Phase 1 – seed placement from YOLO detection bboxes (or anatomical defaults)
Phase 2 – Moore 8-cell neighbourhood SCA on 160×100 lattice
Phase 3 – disease-specific spatial weighting (FW anisotropic / BS σ-β)
Phase 4 – environmental factors CT (temperature) and CRH (humidity)
"""

import numpy as np
from typing import Optional, List, Dict, Generator

try:
    from scipy.ndimage import binary_erosion, distance_transform_edt
    _HAS_SCIPY = True
except ImportError:
    _HAS_SCIPY = False


class SCAEngine:
    COLS: int = 160
    ROWS: int = 100
    TOTAL_STEPS: int = 55   # iterations spanning 30 simulated months
    TOTAL_MONTHS: int = 30

    # Phase 3 spatial weight constants
    SIGMA_BS: float = 1.65   # BS longitudinal weight (along horizontal leaf veins)
    BETA_BS:  float = 0.52   # BS transverse weight (perpendicular to veins)
    FW_ANISO: float = 1.80   # FW anisotropy strength toward midrib

    def __init__(self):
        self.mid_y = self.ROWS / 2.0

        # Precompute leaf boundary mask (superellipse — narrower at tip, wider at base)
        u = np.linspace(-1, 1, self.COLS)
        v = np.linspace(-1, 1, self.ROWS)
        U, V = np.meshgrid(u, v)
        self.leaf_mask: np.ndarray = (
            np.abs(U) ** 1.7 / 0.92 ** 1.7 + V ** 2 / 0.87 ** 2
        ) <= 1.0

        # y-coordinate grid for FW midrib-directed weight (broadcast-ready)
        self.y_grid: np.ndarray = (
            np.arange(self.ROWS, dtype=np.float32)[:, np.newaxis]
            * np.ones((1, self.COLS), dtype=np.float32)
        )

        # Precompute leaf margin mask and per-cell distance from the boundary.
        # margin_dist[r,c] = Euclidean distance (cells) from the nearest background
        # pixel — 0 at the leaf edge, ~43 at the midrib centre.
        if _HAS_SCIPY:
            _interior = binary_erosion(self.leaf_mask)
            self.margin_mask: np.ndarray = self.leaf_mask & ~_interior
            self.margin_dist: np.ndarray = distance_transform_edt(self.leaf_mask).astype(np.float32)
        else:
            # 4-connected approximation without scipy
            lm = self.leaf_mask.astype(np.uint8)
            padded = np.pad(lm, 1, constant_values=0)
            eroded = (
                padded[:-2, 1:-1] & padded[2:, 1:-1] &
                padded[1:-1, :-2] & padded[1:-1, 2:]
            ).astype(bool)
            self.margin_mask = self.leaf_mask & ~eroded
            self.margin_dist = np.where(self.leaf_mask, 10.0, 0.0).astype(np.float32)

    # ── Phase 4: Environmental coefficients ──────────────────────────────────

    def compute_env(self, disease: str, temp: float, rh: float, density: str) -> Dict:
        """
        Compute literature-grounded CT, CRH, E_ENV, and p_base for the given
        disease and environmental conditions.
        """
        is_fw = disease == "fusarium_wilt"

        # Cardinal temperatures (°C)
        # BS:  Tmin=16.6, Topt=27.2, Tmax=30.3  (Maxapress 2024)
        # FW:  Tmin=20.0, Topt=27.5, Tmax=35.0  (MDPI Agronomy 2021)
        T_MIN = 20.0 if is_fw else 16.6
        T_OPT = 27.5 if is_fw else 27.2
        T_MAX = 35.0 if is_fw else 30.3

        # CT: beta-polynomial — 0 at Tmin, peaks 1.0 at Topt, near-0 at Tmax
        if temp <= T_MIN:
            CT = 0.0
        elif temp >= T_MAX:
            CT = 0.05
        elif temp <= T_OPT:
            CT = ((temp - T_MIN) / (T_OPT - T_MIN)) ** (1.0 if is_fw else 1.2)
        else:
            CT = ((T_MAX - temp) / (T_MAX - T_OPT)) ** (0.9 if is_fw else 0.8)

        # RH onset thresholds (%)
        # BS: ascospore formation onset ≥70% RH; P. fijiensis favoured by 90-100% RH
        #     (Maxapress 2024 — "highest incidence at RH ~79-80%"; favoured by 90-100%)
        # FW: mycelial growth onset ≥75% RH; optimal soil moisture → proxy RH_OPT=85
        #     (MDPI Agronomy 2021 — Venezuelan production system)
        RH_MIN = 75.0 if is_fw else 70.0
        RH_OPT = 85.0 if is_fw else 90.0

        # CRH: 0.05 below RH_MIN, ramp to 1.0 at RH_OPT, cap above
        if rh <= RH_MIN:
            CRH = 0.05
        elif rh < RH_OPT:
            CRH = 0.15 + ((rh - RH_MIN) / (RH_OPT - RH_MIN)) * 0.85
        else:
            cap = 1.20 if is_fw else 1.25
            slope = 0.010 if is_fw else 0.012
            CRH = min(cap, 1.0 + (rh - RH_OPT) * slope)

        E_ENV = CT * CRH

        density_factor = {"high": 1.5, "low": 0.55}.get(density, 1.0)

        # P_BASE calibrated to disease epidemiology:
        # FW: soil-borne vascular, 2–6 month incubation → slow per-step base rate
        # BS: aerially transmitted ascospores/conidia, 10–30 dpi lesion onset → faster
        P_BASE = 0.010 if is_fw else 0.017
        p_base = P_BASE * E_ENV * density_factor

        return {
            "is_fw": is_fw,
            "T_MIN": T_MIN, "T_OPT": T_OPT, "T_MAX": T_MAX,
            "RH_MIN": RH_MIN, "RH_OPT": RH_OPT,
            "CT": CT, "CRH": CRH, "E_ENV": E_ENV,
            "density_factor": density_factor,
            "P_BASE": P_BASE, "p_base": p_base,
        }

    # ── Phase 1: Seed placement ───────────────────────────────────────────────

    def seed_grid(
        self,
        grid: np.ndarray,
        intensity: np.ndarray,
        disease: str,
        is_fw: bool,
        detections: Optional[List[Dict]] = None,
        img_w: Optional[int] = None,
        img_h: Optional[int] = None,
        mask_grid: Optional[List[int]] = None,
    ) -> None:
        # ── Fusarium Wilt: margin-first seeding ───────────────────────────────
        # FW (Foc TR4) causes chlorosis at the leaf margins first — xylem blockage
        # starves the marginal cells furthest from the vascular supply.
        # Seeding strategy:
        #   1. If a YOLO mask is provided, restrict it to the outer margin zone
        #      (margin_dist ≤ 20 cells) so only correctly-placed marginal lesions
        #      are used.  Any mask pixels in the leaf interior are discarded.
        #   2. If no usable mask pixels survive after filtering, fall back to seeding
        #      the ENTIRE computed leaf margin so the simulation always starts with
        #      the characteristic yellow-green band at both leaf edges.
        # Ref: MDPI Agronomy 2021 (Venezuelan FW); frontiersin.org/fpls/2019/1395
        if is_fw:
            # Phase 1A – use YOLO mask restricted to the margin zone
            if mask_grid is not None and len(mask_grid) == self.ROWS * self.COLS:
                mask_arr = np.array(mask_grid, dtype=np.uint8).reshape(self.ROWS, self.COLS)
                mask_arr[~self.leaf_mask] = 0
                margin_zone = self.margin_dist <= 20.0
                mask_arr[~margin_zone] = 0
                infected = mask_arr == 1
                necrotic = mask_arr == 2
                if infected.any() or necrotic.any():
                    n_inf = int(np.sum(infected))
                    if n_inf > 0:
                        grid[infected] = 1
                        intensity[infected] = (
                            0.3 + np.random.random(n_inf).astype(np.float32) * 0.4
                        )
                    if necrotic.any():
                        grid[necrotic] = 2
                        intensity[necrotic] = 1.0
                    return

            # Fallback – seed the full computed leaf margin
            ys, xs = np.where(self.margin_mask)
            rng = np.random.default_rng()
            base_int = (rng.random(len(ys)) * 0.35 + 0.15).astype(np.float32)
            for i, (y, x) in enumerate(zip(ys, xs)):
                grid[y, x] = 1
                intensity[y, x] = float(base_int[i])
            return

        # ── Black Sigatoka: use YOLO mask → bbox → anatomical defaults ────────

        # Phase 1A: YOLO segmentation mask grid (BS lesions can start anywhere)
        if mask_grid is not None and len(mask_grid) == self.ROWS * self.COLS:
            mask_arr = np.array(mask_grid, dtype=np.uint8).reshape(self.ROWS, self.COLS)
            mask_arr[~self.leaf_mask] = 0
            infected = mask_arr == 1
            necrotic = mask_arr == 2
            n_inf = int(np.sum(infected))
            n_nec = int(np.sum(necrotic))
            if n_inf + n_nec > 0:
                grid[infected] = 1
                if n_inf > 0:
                    intensity[infected] = 0.5 + np.random.random(n_inf).astype(np.float32) * 0.5
                grid[necrotic] = 2
                intensity[necrotic] = 1.0
                return

        # Phase 1B: YOLO detection bboxes
        seeds = None
        if detections and img_w and img_h:
            matching = [
                d for d in detections
                if d.get("diseaseKey") == disease and d.get("diseaseKey") != "healthy"
            ]
            if not matching:
                matching = [d for d in detections if d.get("diseaseKey") != "healthy"]
            if matching:
                matching.sort(key=lambda d: d.get("score", 0), reverse=True)
                seeds = []
                for det in matching[:3]:
                    gx1 = max(1, round(det["x1"] / img_w * self.COLS))
                    gy1 = max(1, round(det["y1"] / img_h * self.ROWS))
                    gx2 = min(self.COLS - 2, round(det["x2"] / img_w * self.COLS))
                    gy2 = min(self.ROWS - 2, round(det["y2"] / img_h * self.ROWS))
                    count = max(4, round(det.get("score", 0.5) * 12))
                    rng = np.random.default_rng()
                    for _ in range(count):
                        seeds.append((
                            int(gx1 + rng.integers(0, max(1, gx2 - gx1))),
                            int(gy1 + rng.integers(0, max(1, gy2 - gy1))),
                        ))

        # Phase 1C: BS anatomical defaults — lesions can initiate anywhere on the leaf
        # Ref: Maxapress 2024 — BS lesions appear throughout the blade on both surfaces
        if not seeds:
            rng = np.random.default_rng()
            interior_ys, interior_xs = np.where(self.leaf_mask)
            n = min(14, len(interior_ys))
            chosen = rng.choice(len(interior_ys), size=n, replace=False)
            seeds = [(int(interior_xs[i]), int(interior_ys[i])) for i in chosen]

        for cx, cy in seeds:
            for dy in range(-1, 2):
                for dx in range(-1, 2):
                    sx, sy = cx + dx, cy + dy
                    if 0 <= sx < self.COLS and 0 <= sy < self.ROWS:
                        grid[sy, sx] = 1
                        intensity[sy, sx] = float(0.5 + np.random.random() * 0.5)

    # ── Phase 2 + 3: Moore neighbourhood + spatial weighting ─────────────────

    def _compute_neighbors(
        self, grid: np.ndarray, is_fw: bool
    ):
        """
        Vectorised Moore 8-neighbourhood scan.
        Returns (n_inf, w_sum) arrays of shape (ROWS, COLS).
        """
        infected = (grid >= 1).astype(np.float64)
        n_inf = np.zeros((self.ROWS, self.COLS), dtype=np.float64)
        w_sum = np.zeros((self.ROWS, self.COLS), dtype=np.float64)

        OFFSETS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

        for dy, dx in OFFSETS:
            length = np.sqrt(dx * dx + dy * dy)

            # Shift without wrapping (boundary = 0)
            neighbor = np.zeros_like(infected)
            src_r = slice(max(0, -dy), self.ROWS + min(0, -dy) or None)
            src_c = slice(max(0, -dx), self.COLS + min(0, -dx) or None)
            dst_r = slice(max(0, dy),  self.ROWS + min(0, dy)  or None)
            dst_c = slice(max(0, dx),  self.COLS + min(0, dx)  or None)
            neighbor[dst_r, dst_c] = infected[src_r, src_c]
            n_inf += neighbor

            if is_fw:
                # Phase 3 — FW: chlorosis expands ALONG the leaf margins first
                # (xylem blockage kills margin cells furthest from vascular supply).
                # Primary spread: lateral along leaf length (dx component).
                # Secondary: slow inward drift from margin toward midrib.
                # This keeps yellow bands at the margins rather than rushing to centre.
                cos_horiz = abs(float(dx)) / length
                to_midrib = self.mid_y - self.y_grid
                sign_m = np.where(to_midrib == 0, 1.0, np.sign(to_midrib))
                cos_inward = (float(dy) * sign_m) / length
                w = 0.3 + self.FW_ANISO * cos_horiz + 0.25 * np.maximum(0.0, cos_inward)
            else:
                # Phase 3 — BS: σ-β model (primary=longitudinal / secondary=transverse)
                denom = float(dx * dx + dy * dy)
                cos2 = (dx * dx) / denom   # cos²θ along horizontal veins
                sin2 = (dy * dy) / denom   # sin²θ transverse
                w = self.SIGMA_BS * cos2 + self.BETA_BS * sin2

            w_sum += neighbor * w

        return n_inf, w_sum

    def _step(
        self,
        grid: np.ndarray,
        intensity: np.ndarray,
        is_fw: bool,
        p_base: float,
        step_idx: int,
    ):
        """One SCA iteration. Necrotisation and new infections are resolved
        simultaneously from the state at the *start* of the step."""
        new_grid = grid.copy()
        new_intensity = intensity.copy()

        # Necrotic transition — rate increases as disease matures
        was_infected = (grid == 1) & self.leaf_mask
        nec_rate = (
            0.004 + (step_idx / self.TOTAL_STEPS) * 0.012
            if is_fw
            else 0.002 + (step_idx / self.TOTAL_STEPS) * 0.005
        )
        to_necrotize = was_infected & (np.random.random((self.ROWS, self.COLS)) < nec_rate)
        new_grid[to_necrotize] = 2
        new_intensity[to_necrotize] = 1.0

        # New infections via Phase 2 formula: P_trans = [1-(1-pBase)^N_inf] × w
        n_inf, w_sum = self._compute_neighbors(grid, is_fw)
        was_healthy = (grid == 0) & self.leaf_mask & (n_inf > 0)

        w_avg = np.where(n_inf > 0, w_sum / np.maximum(n_inf, 1e-9), 0.0)
        p_trans = (1.0 - np.power(np.maximum(0.0, 1.0 - p_base), n_inf)) * w_avg

        if is_fw:
            # FW spreads fastest at the leaf margin (margin_dist ≈ 0) and
            # much slower toward the midrib (margin_dist ≈ 40).
            # Factor: 1.0 at edge → ~0.18 at midrib, creating the characteristic
            # band of chlorosis that widens slowly inward over months.
            margin_factor = np.exp(-self.margin_dist / 10.0)
            p_trans = p_trans * (0.15 + 0.85 * margin_factor)

        to_infect = was_healthy & (np.random.random((self.ROWS, self.COLS)) < p_trans)
        new_grid[to_infect] = 1
        n_new = int(np.sum(to_infect))
        if n_new > 0:
            new_intensity[to_infect] = 0.4 + np.random.random(n_new) * 0.6

        return new_grid, new_intensity

    # ── Public API ────────────────────────────────────────────────────────────

    def run(
        self,
        disease: str,
        temp: float,
        rh: float,
        density: str,
        detections: Optional[List[Dict]] = None,
        img_w: Optional[int] = None,
        img_h: Optional[int] = None,
        mask_grid: Optional[List[int]] = None,
    ) -> Generator[Dict, None, None]:
        """
        Run the full 30-month SCA simulation and yield one frame dict per month.
        Each frame: { step, month, grid, intensity, stats, env }
        """
        env = self.compute_env(disease, temp, rh, density)
        is_fw = env["is_fw"]
        p_base = env["p_base"]

        grid = np.zeros((self.ROWS, self.COLS), dtype=np.uint8)
        intensity = np.zeros((self.ROWS, self.COLS), dtype=np.float32)
        self.seed_grid(grid, intensity, disease, is_fw, detections, img_w, img_h, mask_grid)

        leaf_count = int(np.sum(self.leaf_mask))
        last_month = -1

        for step_idx in range(self.TOTAL_STEPS + 1):
            month = round(step_idx / self.TOTAL_STEPS * self.TOTAL_MONTHS)

            if month != last_month:
                last_month = month
                inf_count = int(np.sum((grid == 1) & self.leaf_mask))
                nec_count = int(np.sum((grid == 2) & self.leaf_mask))
                inf_pct = inf_count / max(leaf_count, 1) * 100.0
                nec_pct = nec_count / max(leaf_count, 1) * 100.0

                yield {
                    "step":  step_idx,
                    "month": month,
                    "grid":  grid.copy(),
                    "intensity": intensity.copy(),
                    "stats": {
                        "infected_pct":  inf_pct,
                        "necrotic_pct":  nec_pct,
                        "healthy_pct":   max(0.0, 100.0 - inf_pct - nec_pct),
                    },
                    "env": {k: v for k, v in env.items() if isinstance(v, (int, float, bool))},
                }

            if step_idx < self.TOTAL_STEPS:
                grid, intensity = self._step(grid, intensity, is_fw, p_base, step_idx)
