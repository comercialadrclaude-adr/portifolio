"""Gera um portfólio SINTÉTICO de KMZ com a mesma estrutura do real.

Serve para testar o pipeline e o front no CI sem publicar dados reais.
Os valores esperados estão em `ESPERADO` e são verificados em test_fixture.py.

Uso: python scripts/tests/make_fixture.py <pasta_saida>
"""

from __future__ import annotations

import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

# lon/lat de partida (área fictícia no oceano, longe de qualquer município real)
LON0, LAT0 = -40.0, -23.5
GRAU_M = 111_195  # metros por grau de latitude (aprox.)


def _linha(i: int, comprimento_m: float) -> list[tuple[float, float]]:
    lat = LAT0 + i * 0.001
    dlon = comprimento_m / (GRAU_M * 0.917)  # cos(23,5°) ≈ 0,917
    return [(LON0, lat), (LON0 + dlon / 2, lat), (LON0 + dlon, lat)]


# (municipio, bairro, extensao, comprimento_real, diametro, material, pavim, classsific, notas, created, descricao, usuario)
TRECHOS = [
    ("Município A", "Cenrto", "100", 100, "60", "PVC_Policloreto_de_vinila", "Paralelepipedo", "EXTENSÃO;VALIDADA", "", "2024/01/10", "", "fulano@exemplo.com.br"),
    ("Município A", "Centro", "200", 200, "0", "PEAD_Polietileno_alta_densidade", "Paralelepípedo", "", "EXTENSÃO;VALIDADA", "2024/03/05", "file:///C:/Users/fulano/obra.pdf", ""),
    ("Município A", "n/a", "300", 300, "100", "", "Calcada", "MELHORIA;VALIDADA", "", "2024/03/20", "https://empresa.sharepoint.com/sites/x", "beltrano@exemplo.com.br"),
    ("Município A", "NULL", "400", 250, "200", "FF_Ferro_fundido", "", "", "", "2024/02/01", "", ""),
    ("Município A", "<NULL>", "500", 500, "75", "Chumbo", "Asfalto", "REDE DOADA", "", "2024/02/02", "", ""),
    ("Município A", "Vila Nova", "0", 50, "150", "MPVC_DEFOFO", "Terra", "SUBSTITUIÇÃO;VALIDADA", "", "", "", ""),
    ("Município B", "Barra De São João", "1000", 1000, "250", "CA_Cimento_amianto", "Calçada", "EXTENSÃOENG;VALIDADA", "", "2024/03/15", "", ""),
    ("Município B", "", "600", 600, "0", "", "", "REDE ENCONTRADA", "", "2024/01/30", "", ""),
    ("Município B", "Jardim", "700", 700, "50", "FD_Ferro_ductil", "Bloquete", "", "", "2024/02/10", "", ""),
    ("Município B", "Jardim", "800", 800, "110", "PVC_Policloreto_de_vinila", "Asfalto", "MELHORIA;VALIDADA", "", "2024/02/11", "", ""),
]

ESPERADO = {
    "trechos": 10,
    "rede_km": 4.6,
    "extensoes_km": 1.3,
    "extensoes_trechos": 3,
    "melhorias_km": 1.1,
    "completude_pct": 70.0,
    "municipio_top": "Município A",
    "municipio_top_trechos": 6,
    "projetos": 1,
    "zeis": 1,
    "vazios": 5,
}

CAMPOS = [
    "REGIONAL", "UF", "UN", "SUP", "MUNICIPIO", "BAIRRO", "EXTENSAO", "DESCRICAO", "MATERIAL",
    "PROFUNDIDA", "TIPO_PAVIM", "FUNCAO", "ALINHAMENT", "ALINHAME_1", "SITUACAO", "GLOBALID",
    "DIAMETRO_N", "CREATED_US", "CREATED_DA", "LAST_EDITE", "LAST_EDI_1", "NOTAS", "DESCRICA_1",
    "Classsific", "FUNCAO_1", "Shape__Len",
]


def _coords(pts) -> str:
    return " ".join(f"{x:.8f},{y:.8f},0" for x, y in pts)


def _placemark_trecho(i: int, t: tuple) -> str:
    mun, bai, ext, comp, diam, mat, pav, cls, notas, criado, desc, usuario = t
    attrs = {
        "REGIONAL": "R4", "UF": "RJ", "UN": "UN-TESTE", "SUP": "", "MUNICIPIO": mun, "BAIRRO": bai,
        "EXTENSAO": ext, "DESCRICAO": desc, "MATERIAL": mat, "PROFUNDIDA": "1.0" if i % 2 else "0",
        "TIPO_PAVIM": pav, "FUNCAO": "Distribuicao" if i < 5 else "", "ALINHAMENT": "0",
        "ALINHAME_1": "0", "SITUACAO": "Operante", "GLOBALID": f"{{00000000-0000-0000-0000-{i:012d}}}",
        "DIAMETRO_N": diam, "CREATED_US": usuario, "CREATED_DA": criado, "LAST_EDITE": usuario,
        "LAST_EDI_1": "2024/04/01", "NOTAS": notas, "DESCRICA_1": desc, "Classsific": cls,
        "FUNCAO_1": "", "Shape__Len": "0.001",
    }
    dados = "".join(f'<SimpleData name="{k}">{escape(attrs[k])}</SimpleData>' for k in CAMPOS)
    return (
        f"<Placemark><ExtendedData><SchemaData schemaUrl=\"#S\">{dados}</SchemaData></ExtendedData>"
        f"<LineString><coordinates>{_coords(_linha(i, comp))}</coordinates></LineString></Placemark>"
    )


def _base() -> str:
    pms = "".join(_placemark_trecho(i, t) for i, t in enumerate(TRECHOS))
    return f"<Folder><name>rede_interior_cadtec</name>{pms}</Folder>"


def _ponto(nome: str, x: float, y: float) -> str:
    return f"<Placemark><name>{escape(nome)}</name><Point><coordinates>{x},{y},0</coordinates></Point></Placemark>"


def _caminho(nome: str, pts) -> str:
    return f"<Placemark><name>{escape(nome)}</name><LineString><coordinates>{_coords(pts)}</coordinates></LineString></Placemark>"


def _poligono(nome: str, pts, descricao: str = "") -> str:
    d = f"<description><![CDATA[{descricao}]]></description>" if descricao else ""
    return (
        f"<Placemark><name>{escape(nome)}</name>{d}<Polygon><outerBoundaryIs><LinearRing>"
        f"<coordinates>{_coords(pts)}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>"
    )


def _kml(nome: str, corpo: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>'
        f"<name>{escape(nome)}</name>{corpo}</Document></kml>"
    )


def _quadrado(x: float, y: float, lado_m: float):
    d = lado_m / GRAU_M
    dx = d / 0.917
    return [(x, y), (x + dx, y), (x + dx, y + d), (x, y + d), (x, y)]


def gerar(destino: Path) -> None:
    destino.mkdir(parents=True, exist_ok=True)
    y = LAT0 - 0.0002
    projeto = (
        _ponto("Ponto de Interligação", LON0, LAT0 + 0.0000)
        + _caminho("Caminho sem título", [(LON0, LAT0), (LON0, LAT0 - 0.002)])
        + _ponto("Final da Extensão", LON0, LAT0 - 0.002)
    )
    zeis = _ponto("Município A", LON0, LAT0) + _poligono(
        "ZEIS 1 - Teste.", _quadrado(LON0 + 0.0002, y, 100)
    )
    relevo = _poligono(
        "Município A",
        _quadrado(LON0 - 0.01, LAT0 - 0.01, 500),
        "<table><tr><td>MUNICIPIO</td><td>Município A</td></tr><tr><td>PADRAO</td><td>Morros Baixos</td></tr>"
        "<tr><td>Amplitude</td><td>50 a 120m</td></tr><tr><td>Declividad</td><td>5-20°</td></tr></table>",
    )
    arquivos = {
        "1001": _kml("Extensão de Teste", _base() + projeto),
        "1002": _kml("", _base()),
        "1003": _kml("", _base()),
        "1004": _kml("Municipios_ZEIS_Teste", zeis),
        "1005": _kml("relevo_teste", f"<Folder><name>relevo_teste</name>{relevo}</Folder>"),
    }
    for i in range(5):
        arquivos[f"20{i:02d}"] = _kml("Arquivo KML sem título", "")
    for nome, kml in arquivos.items():
        with zipfile.ZipFile(destino / nome, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("doc.kml", kml)


if __name__ == "__main__":
    gerar(Path(sys.argv[1] if len(sys.argv) > 1 else ".fixture/raw"))
