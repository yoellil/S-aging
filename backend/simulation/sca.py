"""
sca.py — Stochastic Cellular Automata step for the S-Aging simulation.

Cell states:
    0 = HEALTHY
    1 = INFECTED
    2 = NECROTIC

Moore 8-neighbourhood.  Per-step transition probability follows the S-Aging
spec:

    P_trans(x, y, t+1) = 1 - (1 - P_base)^N_inf

Disease-specific spatial weights are applied per neighbour:

    Fusarium wilt:
        P_FW = P_trans * max(0, cos(theta))
        theta = angle between spread direction and the leaf midrib (V-axis)

    Black Sigatoka:
        P_BS = P_trans * (sigma * |cos(phi)| + beta * |sin(phi)|)
        phi  = angle between spread direction and the horizontal veins (U-axis)

Necrosis:
    P_nec = base_necrosis_rate * E_ENV * (t / max_t)

Final per-cell probability is multiplied by E_ENV and clipped to [0, 1].
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Tuple

import numpy as np


# 8-cell Moore neighbourhood offsets (dy, dx)
_MOORE_OFFSETS: Tuple[Tuple[int, int], ...] = (
    (-1, -1), (-1, 0), (-1, 1),
    ( 0, -1),          ( 0, 1),
    ( 1, -1), ( 1, 0), ( 1, 1),
)

HEALTHY:  int = 0
INFECTED: int = 1
NECROTIC: int = 2


@dataclass
class SCAParams:
    """Tunable SCA parameters.  Defaults match the S-Aging spec."""
    disease: str                         # "fusarium_wilt" | "black_sigatoka"
    p_base: float = 0.14                 # per-neighbour base infection prob.
    sigma: float = 0.8                   # BS longitudinal weight
    beta: float = 0.3                    # BS transverse weight
    base_necrosis_rate: float = 0.02     # per-step necrotisation base rate
    e_env: float = 1.0                   # environment multiplier (CT * CRH)
    leaf_mask: np.ndarray | None = None  # bool array same shape as grid
    rng: np.random.Generator = field(default_factory=np.random.default_rng)


def _precompute_neighbour_weights(disease: str, sigma: float, beta: float) -> np.ndarray:
    """
    Direction-only weights for each of the 8 Moore offsets.  These depend
    only on (dy, dx), not on position, so they can be precomputed once.

        FW: w = max(0, cos(theta))     theta from vertical (midrib = V-axis)
            cos(theta) = dy / sqrt(dx^2 + dy^2)
        BS: w = sigma*|cos(phi)| + beta*|sin(phi)|   phi from horizontal (U)
            cos(phi) = dx / L,  sin(phi) = dy / L
    """
    w = np.zeros(len(_MOORE_OFFSETS), dtype=np.float32)
    for k, (dy, dx) in enumerate(_MOORE_OFFSETS):
        length = float(np.hypot(dx, dy))
        if disease == "fusarium_wilt":
            cos_theta = dy / length
            w[k] = max(0.0, cos_theta)
        else:  # black_sigatoka
            cos_phi = abs(dx) / length
            sin_phi = abs(dy) / length
            w[k] = sigma * cos_phi + beta * sin_phi
    return w


def _shift(arr: np.ndarray, dy: int, dx: int) -> np.ndarray:
    """Shift `arr` by (dy, dx) with zero-padding (no wrap-around)."""
    out = np.zeros_like(arr)
    H, W = arr.shape
    src_r = slice(max(0, -dy), H + min(0, -dy) or None)
    src_c = slice(max(0, -dx), W + min(0, -dx) or None)
    dst_r = slice(max(0,  dy), H + min(0,  dy) or None)
    dst_c = slice(max(0,  dx), W + min(0,  dx) or None)
    out[dst_r, dst_c] = arr[src_r, src_c]
    return out


class SCAStepper:
    """Stateless-per-grid SCA stepper configured by SCAParams."""

    def __init__(self, params: SCAParams, grid_shape: Tuple[int, int]):
        self.params = params
        self.grid_shape = grid_shape
        self._weights = _precompute_neighbour_weights(
            params.disease, params.sigma, params.beta
        )
        if params.leaf_mask is None:
            self.leaf_mask = np.ones(grid_shape, dtype=bool)
        else:
            self.leaf_mask = params.leaf_mask.astype(bool, copy=False)

    # ── Core step ────────────────────────────────────────────────────────────

    def step(self, grid: np.ndarray, t: int, total_steps: int) -> np.ndarray:
        """
        Advance the grid by one time step.  Returns a NEW array; the input is
        not mutated.  Necrosis and new infections are resolved simultaneously
        from the state at the *start* of the step.
        """
        p = self.params
        rng = p.rng
        H, W = grid.shape
        infected = (grid == INFECTED).astype(np.float32)

        # ── Weighted infection pressure from 8 neighbours ─────────────────
        # For each cell we accumulate sum_k w_k * I(neighbour_k infected).
        # Then P_trans = 1 - (1 - p_base)^N_inf scaled by the mean weight.
        n_inf = np.zeros((H, W), dtype=np.float32)
        w_sum = np.zeros((H, W), dtype=np.float32)

        for k, (dy, dx) in enumerate(_MOORE_OFFSETS):
            neigh = _shift(infected, dy, dx)
            n_inf += neigh
            w_sum += neigh * self._weights[k]

        # Average weight among the infected neighbours (0 when none).
        w_avg = np.where(n_inf > 0, w_sum / np.maximum(n_inf, 1e-9), 0.0)

        p_base_eff = float(np.clip(p.p_base, 0.0, 1.0))
        p_trans = 1.0 - np.power(1.0 - p_base_eff, n_inf)
        p_disease = p_trans * w_avg
        p_final = np.clip(p_disease * p.e_env, 0.0, 1.0)

        healthy = (grid == HEALTHY) & self.leaf_mask & (n_inf > 0)
        roll_inf = rng.random((H, W)).astype(np.float32)
        to_infect = healthy & (roll_inf < p_final)

        # ── Necrosis (infected -> necrotic) ──────────────────────────────
        frac_time = (t / total_steps) if total_steps > 0 else 0.0
        p_nec = float(
            np.clip(p.base_necrosis_rate * p.e_env * frac_time, 0.0, 1.0)
        )
        roll_nec = rng.random((H, W)).astype(np.float32)
        to_necrotize = (grid == INFECTED) & self.leaf_mask & (roll_nec < p_nec)

        new_grid = grid.copy()
        new_grid[to_infect] = INFECTED
        new_grid[to_necrotize] = NECROTIC
        return new_grid


def count_states(grid: np.ndarray, leaf_mask: np.ndarray | None = None) -> dict:
    """Return per-state cell counts and percentages relative to the leaf area."""
    if leaf_mask is None:
        total = int(grid.size)
        inf = int(np.sum(grid == INFECTED))
        nec = int(np.sum(grid == NECROTIC))
    else:
        total = int(np.sum(leaf_mask))
        inf = int(np.sum((grid == INFECTED) & leaf_mask))
        nec = int(np.sum((grid == NECROTIC) & leaf_mask))
    total = max(total, 1)
    return {
        "infected":     inf,
        "necrotic":     nec,
        "healthy":      total - inf - nec,
        "infected_pct": 100.0 * inf / total,
        "necrotic_pct": 100.0 * nec / total,
        "healthy_pct":  100.0 * (total - inf - nec) / total,
    }
