"""
environment.py — Environmental factor coefficients for the S-Aging SCA.

Implements the CT (temperature), CRH (relative humidity) and plant-density
coefficients exactly as specified in the S-Aging design document:

    E_ENV(T, RH) = CT * CRH

These values are applied as a multiplier to the per-step disease transition
probability.
"""

from typing import Dict


def temperature_coefficient(temp_c: float) -> float:
    """CT — temperature coefficient for disease spread."""
    if temp_c <= 16:
        return 0.1
    if temp_c <= 24:
        return 0.5          # 17-24 °C
    if temp_c < 29:
        return 1.0          # 25-28 °C  (optimal)
    if temp_c < 34:
        return 0.8          # 29-33 °C
    return 0.1              # >= 34 °C


def humidity_coefficient(rh_pct: float) -> float:
    """CRH — relative-humidity coefficient for disease spread."""
    if rh_pct < 50:
        return 0.2          # 0-50 %
    if rh_pct < 60:
        return 0.4          # 50-60 % (gap fill between spec ranges)
    if rh_pct < 80:
        return 0.6          # 60-80 %
    return 1.0              # 80-100 %


def density_multiplier(density: str) -> float:
    """Plant-density multiplier applied to P_base."""
    return {"low": 0.7, "medium": 1.0, "high": 1.3}.get(density.lower(), 1.0)


def environment(temp_c: float, rh_pct: float, density: str) -> Dict[str, float]:
    ct = temperature_coefficient(temp_c)
    crh = humidity_coefficient(rh_pct)
    dens = density_multiplier(density)
    return {
        "CT": ct,
        "CRH": crh,
        "E_ENV": ct * crh,
        "density": dens,
    }
