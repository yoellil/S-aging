"""
mask.py — Load a YOLOv11-seg mask and initialise an SCA grid from it.

The mask describes which pixels of the leaf are already infected / necrotic
at t = 0.  Supported inputs:

    - 2D NumPy array (any dtype).  Values > `infected_threshold` are treated
      as INFECTED; values > `necrotic_threshold` are treated as NECROTIC.
    - Path to an image file readable by OpenCV (png/jpg/etc).  The image is
      converted to grayscale on load.

The mask is bilinearly resampled to the SCA grid resolution and clipped to
the leaf boundary mask.
"""

from __future__ import annotations

from pathlib import Path
from typing import Tuple, Union

import numpy as np

try:                           # OpenCV is optional — fall back to PIL
    import cv2
    _HAS_CV2 = True
except ImportError:
    _HAS_CV2 = False
    from PIL import Image

from .sca import HEALTHY, INFECTED, NECROTIC


MaskInput = Union[np.ndarray, str, Path]


def _read_mask_image(path: Union[str, Path]) -> np.ndarray:
    """Read an image file as a 2D grayscale array."""
    path = str(path)
    if _HAS_CV2:
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise FileNotFoundError(f"Could not read mask image: {path}")
        return img
    # PIL fallback
    return np.asarray(Image.open(path).convert("L"), dtype=np.uint8)


def _bilinear_resize(src: np.ndarray, out_shape: Tuple[int, int]) -> np.ndarray:
    """
    Bilinear resample `src` (2D) to `out_shape = (rows, cols)`.  Values are
    returned as float32 so that fractional intensities survive.
    """
    src = src.astype(np.float32, copy=False)
    in_h, in_w = src.shape
    out_h, out_w = out_shape

    if (in_h, in_w) == (out_h, out_w):
        return src.copy()

    # Sample centres evenly across the source: map output [0, out-1] -> src
    ys = np.linspace(0.0, in_h - 1.0, out_h, dtype=np.float32)
    xs = np.linspace(0.0, in_w - 1.0, out_w, dtype=np.float32)

    y0 = np.floor(ys).astype(np.int32)
    x0 = np.floor(xs).astype(np.int32)
    y1 = np.clip(y0 + 1, 0, in_h - 1)
    x1 = np.clip(x0 + 1, 0, in_w - 1)
    wy = (ys - y0).reshape(-1, 1)
    wx = (xs - x0).reshape(1, -1)

    Ia = src[np.ix_(y0, x0)]
    Ib = src[np.ix_(y0, x1)]
    Ic = src[np.ix_(y1, x0)]
    Id = src[np.ix_(y1, x1)]

    top    = Ia * (1.0 - wx) + Ib * wx
    bottom = Ic * (1.0 - wx) + Id * wx
    return top * (1.0 - wy) + bottom * wy


def load_mask(
    mask: MaskInput,
    grid_shape: Tuple[int, int],
    infected_threshold: float = 0.5,
    necrotic_threshold: float | None = None,
) -> np.ndarray:
    """
    Return a 2D uint8 SCA grid of shape `grid_shape` initialised from `mask`.

    Thresholds are applied in the mask's own value range; values <= 1 are
    treated as [0, 1] floats, values > 1 are treated as 0-255 and normalised.
    """
    if isinstance(mask, (str, Path)):
        arr = _read_mask_image(mask)
    else:
        arr = np.asarray(mask)
        if arr.ndim == 3:                    # e.g. (H, W, 1) or (H, W, 3)
            arr = arr.mean(axis=-1)
        if arr.ndim != 2:
            raise ValueError(
                f"Mask must be 2D; got shape {arr.shape}"
            )

    resampled = _bilinear_resize(arr, grid_shape)

    # Normalise to [0, 1] if the mask appears to be 0-255.
    if resampled.max() > 1.0:
        resampled = resampled / 255.0

    grid = np.full(grid_shape, HEALTHY, dtype=np.uint8)
    grid[resampled > infected_threshold] = INFECTED
    if necrotic_threshold is not None:
        grid[resampled > necrotic_threshold] = NECROTIC
    return grid
