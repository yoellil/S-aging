"""
simulator.py — Top-level SAgingSimulator class.

Glues together mask loading, the SCA stepper, environment coefficients,
the 3-D leaf mesh, and PyVista interactive visualisation into a single
callable interface.

Typical use:

    sim = SAgingSimulator(
        mask="detections/leaf_mask.png",
        disease="black_sigatoka",
        temperature=27, humidity=85, plant_density="medium",
        grid_size=(256, 256), total_steps=50,
    )
    sim.initialize()
    sim.run_all()
    sim.visualize()
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import pyvista as pv

from .environment import environment
from .mask import MaskInput, load_mask
from .mesh import UVSampler, build_leaf_mesh, leaf_mask_for_grid, load_leaf_mesh
from .sca import (
    HEALTHY, INFECTED, NECROTIC,
    SCAParams, SCAStepper, count_states,
)


# State → RGB color palette (uint8) exactly per the S-Aging spec.
COLOR_HEALTHY  = np.array([ 34, 139,  34], dtype=np.uint8)   # forest green
COLOR_INFECTED = np.array([255, 165,   0], dtype=np.uint8)   # orange
COLOR_NECROTIC = np.array([ 30,  20,  10], dtype=np.uint8)   # near black-brown


def _state_to_rgb(state_values: np.ndarray) -> np.ndarray:
    """
    Map a float array of per-vertex state samples in [0, 2] to RGB uint8.
    Linear blend healthy→infected on [0, 1] and infected→necrotic on [1, 2]
    so bilinear UV sampling produces smooth colour transitions.
    """
    s = np.clip(state_values, 0.0, 2.0).astype(np.float32)

    # Stage 1: healthy -> infected for s in [0, 1]
    t1 = np.clip(s, 0.0, 1.0)[:, None]
    stage1 = (1.0 - t1) * COLOR_HEALTHY + t1 * COLOR_INFECTED

    # Stage 2: infected -> necrotic for s in [1, 2]
    t2 = np.clip(s - 1.0, 0.0, 1.0)[:, None]
    stage2 = (1.0 - t2) * COLOR_INFECTED + t2 * COLOR_NECROTIC

    # Choose stage2 when s > 1, else stage1
    use2 = (s > 1.0)[:, None]
    rgb = np.where(use2, stage2, stage1)
    return np.clip(rgb, 0, 255).astype(np.uint8)


class SAgingSimulator:
    """Mask → 3-D disease progression simulator on a banana leaf."""

    def __init__(
        self,
        mask: MaskInput,
        disease: str = "black_sigatoka",
        temperature: float = 27.0,
        humidity: float = 85.0,
        plant_density: str = "medium",
        grid_size: Tuple[int, int] = (256, 256),
        total_steps: int = 50,
        mesh_path: Optional[str] = None,
        *,
        p_base: float = 0.14,
        sigma: float = 0.8,
        beta: float = 0.3,
        base_necrosis_rate: float = 0.02,
        infected_threshold: float = 0.5,
        necrotic_threshold: Optional[float] = None,
        seed: Optional[int] = None,
    ):
        disease = disease.lower()
        if disease not in ("fusarium_wilt", "black_sigatoka"):
            raise ValueError(
                f"disease must be 'fusarium_wilt' or 'black_sigatoka' (got {disease!r})"
            )
        self.mask_input      = mask
        self.disease         = disease
        self.temperature     = float(temperature)
        self.humidity        = float(humidity)
        self.plant_density   = plant_density
        self.grid_size       = tuple(grid_size)
        self.total_steps     = int(total_steps)
        self.mesh_path       = mesh_path
        self.infected_threshold = infected_threshold
        self.necrotic_threshold = necrotic_threshold

        self._env = environment(self.temperature, self.humidity, self.plant_density)
        self._rng = np.random.default_rng(seed)

        self._sca_params = SCAParams(
            disease=disease,
            p_base=p_base * self._env["density"],
            sigma=sigma,
            beta=beta,
            base_necrosis_rate=base_necrosis_rate,
            e_env=self._env["E_ENV"],
            leaf_mask=None,          # filled in during initialize()
            rng=self._rng,
        )

        # Populated by initialize()
        self.mesh: Optional[pv.PolyData] = None
        self.initial_grid: Optional[np.ndarray] = None
        self.history: List[np.ndarray] = []
        self._stepper: Optional[SCAStepper] = None
        self._sampler: Optional[UVSampler] = None
        self._leaf_mask: Optional[np.ndarray] = None

    # ── Setup ────────────────────────────────────────────────────────────────

    def initialize(self) -> None:
        """Load the mask, build the mesh, and set up the SCA grid at t=0."""
        # 1. Leaf-boundary mask for the SCA grid.
        self._leaf_mask = leaf_mask_for_grid(self.grid_size)
        self._sca_params.leaf_mask = self._leaf_mask

        # 2. Initial SCA grid from the input mask.
        grid = load_mask(
            self.mask_input,
            self.grid_size,
            infected_threshold=self.infected_threshold,
            necrotic_threshold=self.necrotic_threshold,
        )
        # Clip any mask area outside the leaf outline.
        grid[~self._leaf_mask] = HEALTHY
        self.initial_grid = grid
        self.history = [grid.copy()]

        # 3. 3-D leaf mesh (procedural or loaded).
        if self.mesh_path:
            self.mesh = load_leaf_mesh(self.mesh_path)
        else:
            self.mesh = build_leaf_mesh()

        # 4. SCA stepper + UV sampler.
        self._stepper = SCAStepper(self._sca_params, self.grid_size)
        self._sampler = UVSampler(self.grid_size)

    # ── Stepping ─────────────────────────────────────────────────────────────

    def step(self, t: int) -> np.ndarray:
        """
        Advance from the latest cached state by one time step using `t` as the
        time index for the necrosis schedule.  Returns the new grid.
        """
        if self._stepper is None or not self.history:
            raise RuntimeError("Call initialize() before step().")
        if t >= self.total_steps:
            return self.history[-1]
        new_grid = self._stepper.step(self.history[-1], t=t, total_steps=self.total_steps)
        self.history.append(new_grid)
        return new_grid

    def run_all(self) -> List[np.ndarray]:
        """Run all `total_steps` iterations and cache the history."""
        if self._stepper is None:
            self.initialize()
        self.history = [self.initial_grid.copy()]
        grid = self.initial_grid
        for t in range(self.total_steps):
            grid = self._stepper.step(grid, t=t, total_steps=self.total_steps)
            self.history.append(grid)
        return self.history

    # ── Stats ────────────────────────────────────────────────────────────────

    def stats_at(self, t: int) -> dict:
        grid = self.history[min(max(t, 0), len(self.history) - 1)]
        return count_states(grid, self._leaf_mask)

    # ── Rendering helpers ────────────────────────────────────────────────────

    def _vertex_colors(self, grid: np.ndarray) -> np.ndarray:
        """Per-vertex RGB colours for the current mesh sampled from `grid`."""
        uv = np.asarray(self.mesh.active_texture_coordinates)
        sampled = self._sampler.sample(grid, uv)
        return _state_to_rgb(sampled)

    def _apply_colors(self, grid: np.ndarray) -> None:
        colors = self._vertex_colors(grid)
        self.mesh.point_data["colors"] = colors

    # ── Interactive visualisation ────────────────────────────────────────────

    def visualize(
        self,
        interactive: bool = True,
        window_size: Tuple[int, int] = (1100, 700),
        background: str = "#0B0E14",
    ) -> None:
        """
        Launch a PyVista plotter showing disease progression on the 3-D leaf.
        If `interactive=True`, adds a time slider widget (t = 0 .. total_steps).
        """
        if not self.history or self.mesh is None:
            raise RuntimeError("Call initialize() and run_all() before visualize().")

        plotter = pv.Plotter(off_screen=not interactive, window_size=list(window_size))
        plotter.set_background(background)

        self._apply_colors(self.history[0])

        plotter.add_mesh(
            self.mesh,
            scalars="colors",
            rgb=True,
            smooth_shading=True,
            show_edges=False,
            ambient=0.55,
            diffuse=0.55,
            specular=0.15,
            specular_power=12,
        )

        plotter.add_text(
            "S-Aging: Disease Progression Simulation",
            position="upper_edge",
            font_size=14,
            color="white",
            shadow=True,
        )
        plotter.add_legend(
            labels=[
                ("Healthy",  [c / 255.0 for c in COLOR_HEALTHY]),
                ("Infected", [c / 255.0 for c in COLOR_INFECTED]),
                ("Necrotic", [c / 255.0 for c in COLOR_NECROTIC]),
            ],
            bcolor="#101820",
            border=False,
            size=(0.18, 0.12),
            loc="upper right",
        )

        info_actor = {"actor": None}

        def _update_info_text(t: int) -> None:
            s = self.stats_at(t)
            txt = (
                f"Step: {t}/{self.total_steps}   "
                f"T={self.temperature:g}°C  RH={self.humidity:g}%  "
                f"density={self.plant_density}\n"
                f"Healthy: {s['healthy_pct']:5.1f}%   "
                f"Infected: {s['infected_pct']:5.1f}%   "
                f"Necrotic: {s['necrotic_pct']:5.1f}%"
            )
            if info_actor["actor"] is not None:
                plotter.remove_actor(info_actor["actor"])
            info_actor["actor"] = plotter.add_text(
                txt, position="lower_edge", font_size=10,
                color="white", shadow=True,
            )

        _update_info_text(0)

        if interactive:
            def slider_cb(value):
                t = int(round(value))
                t = max(0, min(t, len(self.history) - 1))
                self._apply_colors(self.history[t])
                _update_info_text(t)

            plotter.add_slider_widget(
                slider_cb,
                rng=[0, self.total_steps],
                value=0,
                title="Time step",
                pointa=(0.25, 0.08), pointb=(0.75, 0.08),
                style="modern",
                color="#E2E8F0",
            )

        plotter.camera_position = "xy"
        plotter.camera.elevation = 25
        plotter.camera.zoom(1.1)

        if interactive:
            plotter.show()
        else:
            plotter.close()

    # ── Frame export ─────────────────────────────────────────────────────────

    def export_frames(
        self,
        output_dir: str | Path,
        window_size: Tuple[int, int] = (1100, 700),
        background: str = "#0B0E14",
    ) -> List[Path]:
        """Render each cached frame as a PNG screenshot into `output_dir`."""
        if not self.history or self.mesh is None:
            raise RuntimeError("Call initialize() and run_all() before export_frames().")

        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        paths: List[Path] = []

        plotter = pv.Plotter(off_screen=True, window_size=list(window_size))
        plotter.set_background(background)

        self._apply_colors(self.history[0])
        plotter.add_mesh(
            self.mesh, scalars="colors", rgb=True,
            smooth_shading=True, show_edges=False,
            ambient=0.55, diffuse=0.55, specular=0.15,
        )
        plotter.camera_position = "xy"
        plotter.camera.elevation = 25
        plotter.camera.zoom(1.1)

        for t, grid in enumerate(self.history):
            self._apply_colors(grid)
            frame_path = out / f"frame_{t:04d}.png"
            plotter.screenshot(str(frame_path))
            paths.append(frame_path)

        plotter.close()
        return paths
