"""Cálculos geodésicos e projeções locais (SIRGAS 2000 / UTM)."""

from __future__ import annotations

from functools import lru_cache

import numpy as np
import shapely
from pyproj import Geod, Transformer
from shapely.geometry.base import BaseGeometry

GEOD = Geod(ellps="GRS80")


def comprimento_m(geom: BaseGeometry) -> float:
    """Comprimento geodésico (m) de uma linha em lon/lat."""
    return float(GEOD.geometry_length(geom))


def area_ha(geom: BaseGeometry) -> float:
    """Área geodésica (ha) de um polígono em lon/lat."""
    area, _ = GEOD.geometry_area_perimeter(geom)
    return abs(float(area)) / 10_000


def epsg_utm(lon: float, lat: float) -> int:
    """SIRGAS 2000 / UTM da zona do ponto (18S–25S). Fora do Brasil, WGS 84 / UTM."""
    zona = int((lon + 180) // 6) + 1
    if lat < 0 and 18 <= zona <= 25:
        return 31960 + zona
    return (32700 if lat < 0 else 32600) + zona


@lru_cache(maxsize=16)
def _transformadores(epsg: int) -> tuple[Transformer, Transformer]:
    ida = Transformer.from_crs(4326, epsg, always_xy=True)
    volta = Transformer.from_crs(epsg, 4326, always_xy=True)
    return ida, volta


def epsg_de(geom: BaseGeometry) -> int:
    c = geom.representative_point()
    return epsg_utm(c.x, c.y)


def _aplicar(geom: BaseGeometry, t: Transformer) -> BaseGeometry:
    def f(xy: np.ndarray) -> np.ndarray:
        x, y = t.transform(xy[:, 0], xy[:, 1])
        return np.column_stack([x, y])

    return shapely.transform(geom, f)


def projetar(geom: BaseGeometry, epsg: int) -> BaseGeometry:
    return _aplicar(geom, _transformadores(epsg)[0])


def desprojetar(geom: BaseGeometry, epsg: int) -> BaseGeometry:
    return _aplicar(geom, _transformadores(epsg)[1])


def simplificar(geom: BaseGeometry, tolerancia_m: float = 1.0) -> BaseGeometry:
    """Simplifica com tolerância em metros, preservando os extremos."""
    epsg = epsg_de(geom)
    simples = projetar(geom, epsg).simplify(tolerancia_m, preserve_topology=False)
    if simples.is_empty:
        return geom
    return desprojetar(simples, epsg)
