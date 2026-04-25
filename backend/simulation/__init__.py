"""
S-Aging simulation package.

YOLOv11-seg mask  →  SCA grid  →  stochastic disease progression
                              →  bilinear UV sampling
                              →  3-D PyVista leaf mesh with time slider

Public entry point:  SAgingSimulator
"""

from .simulator import (
    SAgingSimulator,
    COLOR_HEALTHY, COLOR_INFECTED, COLOR_NECROTIC,
)
from .sca import HEALTHY, INFECTED, NECROTIC, count_states

__all__ = [
    "SAgingSimulator",
    "COLOR_HEALTHY", "COLOR_INFECTED", "COLOR_NECROTIC",
    "HEALTHY", "INFECTED", "NECROTIC",
    "count_states",
]
