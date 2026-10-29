"""Leitura e identificação dos arquivos KMZ/KML do portfólio.

A leitura fica isolada aqui: o resto do pipeline só conhece `Fonte` e `Feicao`.
Para trocar a origem pelo FeatureServer do ArcGIS, basta escrever outro leitor
que devolva `Fonte` com as mesmas feições (ver `ler_fonte`).

Uso: python scripts/extract_kmz.py [--raw data/raw]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from lxml import etree
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon
from shapely.geometry.base import BaseGeometry

# Campos que identificam um trecho da base cadastral.
CAMPOS_BASE = {"EXTENSAO", "MUNICIPIO", "GLOBALID"}
NOME_PASTA_BASE = "rede_interior_cadtec"

TIPO_BASE_PROJETO = "base_projeto"
TIPO_BASE = "base"
TIPO_ZEIS = "zeis"
TIPO_RELEVO = "relevo"
TIPO_VAZIO = "vazio"
TIPO_OUTRO = "outro"


@dataclass
class Feicao:
    nome: str
    geometria: BaseGeometry
    atributos: dict[str, str]
    pastas: tuple[str, ...]
    descricao: str = ""

    @property
    def eh_trecho_base(self) -> bool:
        return CAMPOS_BASE.issubset(self.atributos) or any(
            p.lower() == NOME_PASTA_BASE for p in self.pastas
        )


@dataclass
class Fonte:
    arquivo: str
    sha256: str
    documento: str
    feicoes: list[Feicao] = field(default_factory=list)

    @property
    def trechos_base(self) -> list[Feicao]:
        return [f for f in self.feicoes if f.eh_trecho_base]

    @property
    def soltas(self) -> list[Feicao]:
        return [f for f in self.feicoes if not f.eh_trecho_base]

    def contagem(self) -> dict[str, int]:
        c = {"pontos": 0, "linhas": 0, "poligonos": 0}
        for f in self.feicoes:
            t = f.geometria.geom_type
            if "Point" in t:
                c["pontos"] += 1
            elif "LineString" in t:
                c["linhas"] += 1
            elif "Polygon" in t:
                c["poligonos"] += 1
        return c


# --- KML -------------------------------------------------------------------

_PARSER = etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=True, recover=True)


def _local(el: etree._Element) -> str:
    return etree.QName(el).localname if isinstance(el.tag, str) else ""


def _filho(el: etree._Element, nome: str) -> etree._Element | None:
    for c in el:
        if _local(c) == nome:
            return c
    return None


def _texto(el: etree._Element | None) -> str:
    return (el.text or "").strip() if el is not None else ""


def _coords(texto: str) -> list[tuple[float, float]]:
    pts = []
    for tupla in texto.split():
        partes = tupla.split(",")
        if len(partes) >= 2:
            try:
                pts.append((float(partes[0]), float(partes[1])))
            except ValueError:
                continue
    return pts


def _geometrias(el: etree._Element) -> Iterable[BaseGeometry]:
    nome = _local(el)
    if nome == "Point":
        pts = _coords(_texto(_desc(el, "coordinates")))
        if pts:
            yield Point(pts[0])
    elif nome == "LineString":
        pts = _coords(_texto(_desc(el, "coordinates")))
        if len(pts) >= 2:
            yield LineString(pts)
    elif nome == "Polygon":
        externo = None
        internos = []
        for anel in el.iter():
            if _local(anel) in ("outerBoundaryIs", "innerBoundaryIs"):
                pts = _coords(_texto(_desc(anel, "coordinates")))
                if len(pts) >= 3:
                    if _local(anel) == "outerBoundaryIs":
                        externo = pts
                    else:
                        internos.append(pts)
        if externo:
            yield Polygon(externo, internos)
    elif nome == "MultiGeometry":
        for c in el:
            yield from _geometrias(c)


def _desc(el: etree._Element, nome: str) -> etree._Element | None:
    for d in el.iter():
        if _local(d) == nome:
            return d
    return None


def _juntar(geoms: list[BaseGeometry]) -> BaseGeometry | None:
    if not geoms:
        return None
    if len(geoms) == 1:
        return geoms[0]
    tipos = {g.geom_type for g in geoms}
    if tipos == {"LineString"}:
        return MultiLineString(geoms)
    if tipos == {"Polygon"}:
        return MultiPolygon(geoms)
    return geoms[0]


def _atributos(pm: etree._Element) -> dict[str, str]:
    attrs: dict[str, str] = {}
    ext = _filho(pm, "ExtendedData")
    if ext is None:
        return attrs
    for el in ext.iter():
        loc = _local(el)
        if loc == "SimpleData" and el.get("name"):
            attrs[el.get("name")] = (el.text or "").strip()
        elif loc == "Data" and el.get("name"):
            attrs[el.get("name")] = _texto(_filho(el, "value"))
    return attrs


def _percorrer(el: etree._Element, pastas: tuple[str, ...], saida: list[Feicao]) -> None:
    for c in el:
        loc = _local(c)
        if loc in ("Folder", "Document"):
            nome = _texto(_filho(c, "name"))
            _percorrer(c, pastas + (nome,), saida)
        elif loc == "Placemark":
            geoms = [g for gc in c if isinstance(gc.tag, str) for g in _geometrias(gc)]
            geom = _juntar(geoms)
            if geom is None or geom.is_empty:
                continue
            saida.append(
                Feicao(
                    nome=_texto(_filho(c, "name")),
                    geometria=geom,
                    atributos=_atributos(c),
                    pastas=pastas,
                    descricao=_texto(_filho(c, "description")),
                )
            )


def ler_kml_bytes(conteudo: bytes) -> tuple[str, list[Feicao]]:
    raiz = etree.fromstring(conteudo, parser=_PARSER)
    if raiz is None:
        return "", []
    doc = _desc(raiz, "Document")
    nome_doc = _texto(_filho(doc, "name")) if doc is not None else ""
    feicoes: list[Feicao] = []
    inicio = doc if doc is not None else raiz
    _percorrer(inicio, (), feicoes)
    return nome_doc, feicoes


def ler_kmz(caminho: Path) -> Fonte:
    dados = caminho.read_bytes()
    sha = hashlib.sha256(dados).hexdigest()
    if not dados.startswith(b"PK"):
        conteudo = dados
    else:
        with zipfile.ZipFile(caminho) as z:
            kmls = [n for n in z.namelist() if n.lower().endswith(".kml")]
            nome = "doc.kml" if "doc.kml" in kmls else (kmls[0] if kmls else None)
            if nome is None:
                return Fonte(caminho.name, sha, "", [])
            conteudo = z.read(nome)
    documento, feicoes = ler_kml_bytes(conteudo)
    return Fonte(caminho.name, sha, documento, feicoes)


def ler_fonte(caminho: Path) -> Fonte:
    """Ponto único de leitura. Substituir aqui para ler do FeatureServer."""
    return ler_kmz(caminho)


def _eh_kml_ou_kmz(p: Path) -> bool:
    """Identifica pelo conteúdo: os arquivos do Google Earth podem vir sem extensão."""
    if not p.is_file():
        return False
    with p.open("rb") as fh:
        inicio = fh.read(512)
    if inicio.startswith(b"PK"):
        try:
            with zipfile.ZipFile(p) as z:
                return any(n.lower().endswith(".kml") for n in z.namelist())
        except zipfile.BadZipFile:
            return False
    return b"<kml" in inicio or (inicio.lstrip().startswith(b"<?xml") and p.suffix.lower() == ".kml")


def listar_fontes(raw: Path) -> list[Path]:
    arquivos = [p for p in raw.iterdir() if _eh_kml_ou_kmz(p)]

    def chave(p: Path):
        m = re.match(r"(\d+)", p.stem)
        return (0, int(m.group(1)), p.name) if m else (1, 0, p.name)

    return sorted(arquivos, key=chave)


# --- Identificação -----------------------------------------------------------


def hash_base(trechos: list[Feicao]) -> str:
    """Hash estável de atributos + coordenadas, independente da ordem."""
    linhas = []
    for f in trechos:
        attrs = json.dumps(f.atributos, sort_keys=True, ensure_ascii=False)
        linhas.append(attrs + "|" + f.geometria.wkt)
    h = hashlib.sha256()
    for linha in sorted(linhas):
        h.update(linha.encode("utf-8"))
    return h.hexdigest()


def classificar(fonte: Fonte) -> str:
    if not fonte.feicoes:
        return TIPO_VAZIO
    if fonte.trechos_base:
        return TIPO_BASE_PROJETO if fonte.soltas else TIPO_BASE
    nomes = " ".join([fonte.documento, *(p for f in fonte.feicoes for p in f.pastas)]).upper()
    if "ZEIS" in nomes:
        return TIPO_ZEIS
    descricoes = " ".join(f.descricao for f in fonte.feicoes[:20]).upper()
    if "PADRAO" in descricoes or "DECLIVIDADE" in descricoes:
        return TIPO_RELEVO
    return TIPO_OUTRO


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw", type=Path, default=Path(__file__).resolve().parent.parent / "data" / "raw")
    args = ap.parse_args()
    for p in listar_fontes(args.raw):
        f = ler_fonte(p)
        c = f.contagem()
        print(
            f"{f.arquivo:<28} {classificar(f):<13} base={len(f.trechos_base):>5} "
            f"soltas={len(f.soltas):>3} pontos={c['pontos']:>4} linhas={c['linhas']:>5} "
            f"poligonos={c['poligonos']:>4}  {f.documento}"
        )


if __name__ == "__main__":
    main()
