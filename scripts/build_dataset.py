"""Gera public/data/ a partir dos KMZ em data/raw/.

Uso:
    python scripts/build_dataset.py                       # modo agregado (padrão, seguro)
    python scripts/build_dataset.py --modo completo       # inclui rede.geojson e trechos.json

O modo agregado não publica geometria nem atributos por trecho da base cadastral.
Use o modo completo só depois de confirmar que a base de rede pode ficar pública.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from shapely.geometry import mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union
from shapely.strtree import STRtree

sys.path.insert(0, str(Path(__file__).resolve().parent))

import geo  # noqa: E402
import limpeza as L  # noqa: E402
import quality  # noqa: E402
from extract_kmz import (  # noqa: E402
    TIPO_BASE,
    TIPO_BASE_PROJETO,
    TIPO_RELEVO,
    TIPO_VAZIO,
    TIPO_ZEIS,
    Feicao,
    Fonte,
    classificar,
    hash_base,
    ler_fonte,
    listar_fontes,
)

VERSAO = "1.0.0"
RAIZ = Path(__file__).resolve().parent.parent
CASAS = 5  # ~1,1 m no Equador

ETAPAS = [
    "Estudo",
    "Traçado preliminar",
    "Projeto executivo",
    "Aprovado",
    "Em obra",
    "Concluído",
    "Cadastrado no GIS",
]

CAMPOS_A_PREENCHER = [
    "solicitante",
    "motivo",
    "ligacoes_previstas",
    "custo_estimado_brl",
    "responsavel",
    "data_prevista",
    "data_real",
]

# Distância a partir da qual a interligação precisa ser confirmada em campo.
LIMITE_INTERLIGACAO_M = 50.0

NOME_GENERICO = re.compile(
    r"sem t[ií]tulo|^arquivo kml|^marcador|^caminho|^pol[ií]gono|^ponto de interliga|"
    r"^in[ií]cio da extens|^final da extens|^$",
    re.I,
)


# --- Utilidades --------------------------------------------------------------


def _arred(coords: Any) -> Any:
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (int, float)):
        return [round(coords[0], CASAS), round(coords[1], CASAS)]
    saida = [_arred(c) for c in coords]
    # remove pontos repetidos depois do arredondamento
    if saida and isinstance(saida[0], list) and saida[0] and isinstance(saida[0][0], float):
        limpo = [saida[0]]
        for p in saida[1:]:
            if p != limpo[-1]:
                limpo.append(p)
        return limpo
    return saida


def geojson_geom(geom: BaseGeometry) -> dict:
    g = mapping(geom)
    return {"type": g["type"], "coordinates": _arred(g["coordinates"])}


def feature(geom: BaseGeometry, props: dict) -> dict:
    return {"type": "Feature", "properties": props, "geometry": geojson_geom(geom)}


def colecao(features: list[dict]) -> dict:
    return {"type": "FeatureCollection", "features": features}


def bbox(geoms: Iterable[BaseGeometry]) -> list[float] | None:
    geoms = list(geoms)
    if not geoms:
        return None
    xs0, ys0, xs1, ys1 = zip(*(g.bounds for g in geoms))
    return [round(min(xs0), CASAS), round(min(ys0), CASAS), round(max(xs1), CASAS), round(max(ys1), CASAS)]


def r(v: float | None, casas: int = 2) -> float | None:
    return None if v is None else round(v, casas)


def pct(parte: float, total: float) -> float:
    return round(parte / total * 100, 2) if total else 0.0


# --- Rede ------------------------------------------------------------------


def ultima_edicao(f: Fonte) -> date:
    """Data mais recente de edição ou cadastro entre os trechos da base."""
    datas = (
        L.data(t.atributos.get(campo))
        for t in f.trechos_base
        for campo in ("LAST_EDI_1", "CREATED_DA")
    )
    return max((d for d in datas if d), default=date.min)


def escolher_base(fontes: list[Fonte]) -> tuple[Fonte | None, dict[str, str], list[str]]:
    """Agrupa as cópias da base por hash e escolhe uma. Devolve (fonte, hashes, avisos).

    Vence a versão com a edição mais recente, mesmo que versões antigas apareçam em
    mais arquivos (ex.: projetos desenhados sobre uma cópia antiga da base). Entre
    cópias da mesma versão, prefere uma pura (sem projeto desenhado).
    """
    com_base = [f for f in fontes if f.trechos_base]
    hashes = {f.arquivo: hash_base(f.trechos_base) for f in com_base}
    if not com_base:
        return None, hashes, ["Nenhuma base cadastral encontrada."]
    grupos = Counter(hashes.values())
    edicao = {f.arquivo: ultima_edicao(f) for f in com_base}
    escolhida = max(
        com_base,
        key=lambda f: (edicao[f.arquivo], grupos[hashes[f.arquivo]], not f.soltas, len(f.trechos_base)),
    )
    avisos: list[str] = []
    if len(grupos) > 1:
        anteriores = sorted(f.arquivo for f in com_base if hashes[f.arquivo] != hashes[escolhida.arquivo])
        avisos.append(
            f"{len(grupos)} versões diferentes da base cadastral. Usada a de edição mais recente "
            f"({escolhida.arquivo}, {edicao[escolhida.arquivo].strftime('%d/%m/%Y')}). "
            f"Com versão anterior: {', '.join(anteriores)}."
        )
    return escolhida, hashes, avisos


def limpar_trecho(i: int, f: Feicao) -> dict:
    a = f.atributos
    mat, mat_cod = L.material(a.get("MATERIAL"))
    bai, bai_corr = L.bairro(a.get("BAIRRO"))
    pav, pav_corr = L.pavimento(a.get("TIPO_PAVIM"))
    desc = a.get("DESCRICAO") or ""
    cadastro = L.data(a.get("CREATED_DA"))
    return {
        "id": f"T{i:05d}",
        "globalid": L.nulo(a.get("GLOBALID")),
        "municipio": L.municipio(a.get("MUNICIPIO")),
        "bairro": bai,
        "tipo": L.tipo_obra(a.get("Classsific"), a.get("NOTAS")),
        "extensao_m": r(L.numero(a.get("EXTENSAO"))),
        "comprimento_m": round(geo.comprimento_m(f.geometria), 2),
        "diametro_mm": L.positivo(a.get("DIAMETRO_N")),
        "material": mat,
        "material_codigo": mat_cod,
        "pavimento": pav,
        "funcao": L.funcao(a.get("FUNCAO")),
        "profundidade_m": L.positivo(a.get("PROFUNDIDA")),
        "situacao": L.nulo(a.get("SITUACAO")),
        "cadastro": cadastro.isoformat() if cadastro else None,
        # campos internos (prefixo _) não são publicados
        "_geom": f.geometria,
        "_link_local": bool(L.LINK_LOCAL.search(desc)),
        "_link_interno": bool(L.LINK_INTERNO.search(desc)),
        "_bairro_corrigido": bai_corr,
        "_pavimento_corrigido": pav_corr,
        "_ultima_edicao": L.data(a.get("LAST_EDI_1")),
    }


def publico(t: dict) -> dict:
    return {k: v for k, v in t.items() if not k.startswith("_")}


class IndiceRede:
    """Busca do trecho mais próximo em coordenadas métricas (UTM local)."""

    def __init__(self, trechos: list[dict]):
        self.trechos = trechos
        self._por_epsg: dict[int, tuple[STRtree, list[BaseGeometry]]] = {}

    def _arvore(self, epsg: int) -> tuple[STRtree, list[BaseGeometry]]:
        if epsg not in self._por_epsg:
            geoms = [geo.projetar(t["_geom"], epsg) for t in self.trechos]
            self._por_epsg[epsg] = (STRtree(geoms), geoms)
        return self._por_epsg[epsg]

    def mais_proximo(self, geom: BaseGeometry) -> tuple[dict | None, float | None]:
        if not self.trechos:
            return None, None
        epsg = geo.epsg_de(geom)
        arvore, geoms = self._arvore(epsg)
        alvo = geo.projetar(geom, epsg)
        idx = int(arvore.nearest(alvo))
        return self.trechos[idx], float(alvo.distance(geoms[idx]))

    def dentro(self, poligono: BaseGeometry) -> list[tuple[dict, float]]:
        """Trechos que cruzam o polígono, com o comprimento interno (m)."""
        if not self.trechos:
            return []
        epsg = geo.epsg_de(poligono)
        arvore, geoms = self._arvore(epsg)
        alvo = geo.projetar(poligono, epsg)
        saida = []
        for idx in arvore.query(alvo, predicate="intersects"):
            comp = geoms[int(idx)].intersection(alvo).length
            if comp > 0:
                saida.append((self.trechos[int(idx)], comp))
        return saida


# --- Indicadores -------------------------------------------------------------

ATRIBUTOS_PREENCHIMENTO = {
    "material": "material",
    "diametro": "diametro_mm",
    "funcao": "funcao",
    "pavimento": "pavimento",
    "profundidade": "profundidade_m",
    "bairro": "bairro",
}


def meses_entre(inicio: str, fim: str) -> list[str]:
    a, m = int(inicio[:4]), int(inicio[5:7])
    saida = []
    while f"{a:04d}-{m:02d}" <= fim:
        saida.append(f"{a:04d}-{m:02d}")
        m += 1
        if m > 12:
            a, m = a + 1, 1
    return saida


def agregar(nome: str, ts: list[dict], projetos: list[dict], meses: list[str]) -> dict:
    n = len(ts)
    km = lambda lista: sum(t["extensao_m"] or 0 for t in lista) / 1000  # noqa: E731
    rede_km = km(ts)
    por_tipo: dict[str, dict] = {}
    for tipo in L.ROTULO_TIPO:
        sel = [t for t in ts if t["tipo"] == tipo]
        por_tipo[tipo] = {"km": round(km(sel), 3), "trechos": len(sel)}
    ext = [t for t in ts if t["tipo"] == L.TIPO_EXTENSAO]
    mensal_km: dict[str, float] = defaultdict(float)
    mensal_n: Counter = Counter()
    for t in ext:
        if t["cadastro"]:
            mensal_km[t["cadastro"][:7]] += (t["extensao_m"] or 0) / 1000
            mensal_n[t["cadastro"][:7]] += 1
    completos = sum(1 for t in ts if t["material"] and t["diametro_mm"])
    return {
        "nome": nome,
        "trechos": n,
        "rede_km": round(rede_km, 3),
        "extensoes_km": por_tipo[L.TIPO_EXTENSAO]["km"],
        "extensoes_trechos": por_tipo[L.TIPO_EXTENSAO]["trechos"],
        "extensoes_pct": pct(km(ext), rede_km),
        "melhorias_km": por_tipo[L.TIPO_MELHORIA]["km"],
        "completude_pct": pct(completos, n),
        "trechos_completos": completos,
        "por_tipo": por_tipo,
        "mensal": [
            {"mes": m, "extensoes_km": round(mensal_km[m], 3), "extensoes_trechos": mensal_n[m]}
            for m in meses
        ],
        "extensoes_sem_data": sum(1 for t in ext if not t["cadastro"]),
        "preenchimento": {
            rotulo: pct(sum(1 for t in ts if t[campo] is not None), n)
            for rotulo, campo in ATRIBUTOS_PREENCHIMENTO.items()
        },
        "projetos": len(projetos),
        "projetos_tracado_m": round(sum(p["tracado_m"] for p in projetos), 1),
        "bbox": bbox(t["_geom"] for t in ts) or bbox(shape(p["_geom"]) for p in projetos),
    }


# --- ZEIS e sedes ------------------------------------------------------------


def montar_zeis(fonte: Fonte | None, indice: IndiceRede) -> tuple[list[dict], list[dict]]:
    if fonte is None:
        return [], []
    poligonos = [f for f in fonte.feicoes if "Polygon" in f.geometria.geom_type]
    nomes_zeis = {f.nome for f in poligonos}
    sedes = [
        f for f in fonte.feicoes if f.geometria.geom_type == "Point" and f.nome not in nomes_zeis
    ]
    zeis = []
    for i, f in enumerate(poligonos, start=1):
        geom = f.geometria if f.geometria.is_valid else f.geometria.buffer(0)
        trecho, dist = indice.mais_proximo(geom)
        municipio = trecho["municipio"] if trecho and dist is not None and dist < 5000 else None
        if municipio is None and sedes:
            sede = min(sedes, key=lambda s: s.geometria.distance(geom))
            municipio = sede.nome
        internos = indice.dentro(geom)
        rede_m = sum(c for _, c in internos)
        ext_m = sum(c for t, c in internos if t["tipo"] == L.TIPO_EXTENSAO)
        area = geo.area_ha(geom)
        zeis.append(
            {
                "id": f"Z{i}",
                "nome": f.nome.strip().rstrip(".") or f"ZEIS {i}",
                "municipio": municipio,
                "area_ha": round(area, 2),
                "rede_m": round(rede_m, 1),
                "densidade_m_ha": round(rede_m / area, 1) if area else None,
                "extensoes_m": round(ext_m, 1),
                "trechos": len(internos),
                "bbox": bbox([geom]),
                "_geom": geom,
            }
        )
    sedes_saida = [{"nome": s.nome, "_geom": s.geometria} for s in sedes]
    return zeis, sedes_saida


# --- Projetos ------------------------------------------------------------------


def papel(f: Feicao) -> str:
    k = L.chave(f.nome)
    t = f.geometria.geom_type
    if "Point" in t:
        if "interliga" in k:
            return "interligacao"
        if k.startswith("inicio"):
            return "inicio"
        if k.startswith("final"):
            return "final"
        return "marcador"
    if "LineString" in t:
        return "tracado"
    return "area"


ROTULO_PAPEL = {
    "interligacao": "Ponto de interligação",
    "inicio": "Início da extensão",
    "final": "Final da extensão",
    "marcador": "Marcador",
    "tracado": "Traçado",
    "area": "Área",
}


def nome_projeto(fonte: Fonte) -> tuple[str, bool]:
    if fonte.documento and not NOME_GENERICO.search(fonte.documento.strip()):
        return fonte.documento.strip(), True
    for p in {p for f in fonte.soltas for p in f.pastas}:
        if p and not NOME_GENERICO.search(p):
            return p, True
    for f in fonte.soltas:
        if f.nome and not NOME_GENERICO.search(f.nome):
            return f.nome, True
    return "Sem título", False


def montar_projetos(
    fontes: list[Fonte], indice: IndiceRede, zeis: list[dict], meta: dict
) -> list[dict]:
    projetos = []
    for fonte in fontes:
        soltas = fonte.soltas
        if not soltas:
            continue
        m = meta.get(fonte.arquivo, {})
        nome, tem_nome = nome_projeto(fonte)
        feicoes = [{"papel": papel(f), "f": f} for f in soltas]
        linhas = [x["f"].geometria for x in feicoes if x["papel"] == "tracado"]
        areas = [x["f"].geometria for x in feicoes if x["papel"] == "area"]
        pontos_inter = [x["f"].geometria for x in feicoes if x["papel"] == "interligacao"]
        uniao = unary_union([f.geometria for f in soltas])
        ref = pontos_inter[0] if pontos_inter else soltas[0].geometria.representative_point()
        trecho, dist_rede = indice.mais_proximo(ref)
        # município/bairro: trecho cadastrado mais próximo do centro do projeto
        trecho_centro, _ = indice.mais_proximo(uniao.representative_point())
        dist_zeis = None
        zeis_proxima = None
        if zeis:
            epsg = geo.epsg_de(uniao)
            alvo = geo.projetar(uniao, epsg)
            dists = [(alvo.distance(geo.projetar(z["_geom"], epsg)), z) for z in zeis]
            d, zeis_proxima = min(dists, key=lambda x: x[0])
            dist_zeis = round(d, 1)
        tracado = sum(geo.comprimento_m(g) for g in linhas)
        area = sum(geo.area_ha(g) for g in areas)
        ficha = {c: m.get(c) for c in CAMPOS_A_PREENCHER}
        etapa = m.get("etapa")
        etapa_inferida = etapa not in ETAPAS
        if etapa_inferida:
            etapa = "Traçado preliminar" if linhas else "Estudo"

        pend: list[dict] = []
        if not tem_nome:
            pend.append({"codigo": "sem_nome", "texto": "Dar um nome ao projeto no Google Earth."})
        if not pontos_inter:
            pend.append(
                {"codigo": "sem_interligacao", "texto": "Marcar o ponto de interligação com a rede."}
            )
        if not linhas:
            pend.append({"codigo": "sem_tracado", "texto": "Desenhar o traçado proposto."})
        if dist_rede is not None and dist_rede > LIMITE_INTERLIGACAO_M:
            pend.append(
                {
                    "codigo": "interligacao_distante",
                    "texto": f"Interligação a {dist_rede:.0f} m da rede cadastrada: "
                    "confirmar o ponto em campo ou cadastrar a rede que falta.",
                }
            )
        if trecho and (trecho["diametro_mm"] is None or trecho["material"] is None):
            pend.append(
                {
                    "codigo": "rede_sem_atributos",
                    "texto": f"Trecho de interligação ({trecho['id']}) sem "
                    + " e ".join(
                        x
                        for x, v in (("material", trecho["material"]), ("diâmetro", trecho["diametro_mm"]))
                        if v is None
                    )
                    + ": necessário para dimensionar.",
                }
            )
        if etapa_inferida:
            pend.append({"codigo": "etapa_inferida", "texto": "Confirmar a etapa do projeto."})
        vazios = [c for c, v in ficha.items() if v in (None, "")]
        if vazios:
            pend.append(
                {
                    "codigo": "ficha_incompleta",
                    "texto": f"Preencher a ficha: {len(vazios)} de {len(ficha)} campos a preencher.",
                }
            )

        lig = ficha.get("ligacoes_previstas")
        custo = ficha.get("custo_estimado_brl")
        projetos.append(
            {
                "id": m.get("id"),
                "nome": nome,
                "arquivo": fonte.arquivo,
                "municipio": trecho_centro["municipio"] if trecho_centro else None,
                "bairro": trecho_centro["bairro"] if trecho_centro else None,
                "etapa": etapa,
                "etapa_inferida": etapa_inferida,
                "tracado_m": round(tracado, 1),
                "area_ha": round(area, 2),
                "areas": len(areas),
                "distancia_rede_m": r(dist_rede, 1),
                "trecho_interligacao": trecho["id"] if trecho else None,
                "distancia_zeis_m": dist_zeis,
                "zeis_proxima": zeis_proxima["id"] if zeis_proxima else None,
                "dentro_zeis": dist_zeis == 0,
                "ponto_referencia": [round(ref.x, CASAS), round(ref.y, CASAS)],
                "referencia_e_interligacao": bool(pontos_inter),
                "feicoes": dict(Counter(x["papel"] for x in feicoes)),
                "bbox": bbox([uniao]),
                **ficha,
                "custo_por_ligacao_brl": r(custo / lig) if custo and lig else None,
                "custo_por_metro_brl": r(custo / tracado) if custo and tracado else None,
                "pendencias": pend,
                "_feicoes": feicoes,
                "_geom": mapping(uniao),
            }
        )
    # IDs: os definidos em data/projetos_meta.json; os demais por traçado (desc) e nome.
    usados = {p["id"] for p in projetos if p["id"]}
    seq = 1
    for p in sorted(projetos, key=lambda p: (-p["tracado_m"], -p["area_ha"], p["nome"])):
        if not p["id"]:
            while f"P{seq}" in usados:
                seq += 1
            p["id"] = f"P{seq}"
            usados.add(p["id"])
    projetos.sort(key=lambda p: (len(p["id"]), p["id"]))
    return projetos


# --- Relevo --------------------------------------------------------------------

_CELULA = re.compile(r"<td>\s*([^<]+?)\s*</td>\s*<td>\s*([^<]*?)\s*</td>", re.I)


def montar_relevo(fonte: Fonte | None) -> list[dict]:
    if fonte is None:
        return []
    saida = []
    for f in fonte.feicoes:
        if "Polygon" not in f.geometria.geom_type:
            continue
        campos = {k.strip().upper(): v.strip() for k, v in _CELULA.findall(f.descricao)}
        geom = geo.simplificar(f.geometria, 5.0)
        saida.append(
            feature(
                geom,
                {
                    "padrao": campos.get("PADRAO") or None,
                    "codigo": campos.get("COD_REL") or None,
                    "amplitude": campos.get("AMPLITUDE") or None,
                    "declividade": campos.get("DECLIVIDAD") or None,
                    "declividade_pct": campos.get("DECLIVID_1") or None,
                    "municipio": campos.get("MUNICIPIO") or f.nome or None,
                },
            )
        )
    return saida


# --- Privacidade ---------------------------------------------------------------


def coletar_sensiveis(fontes: list[Fonte]) -> set[str]:
    valores = set()
    for f in fontes:
        for t in f.feicoes:
            for campo in ("CREATED_US", "LAST_EDITE"):
                v = L.nulo(t.atributos.get(campo))
                if v and len(v) >= 4:
                    valores.add(v)
    return valores


URL = re.compile(r"https?://", re.I)


def verificar_privacidade(textos: dict[str, str], sensiveis: set[str]) -> list[str]:
    problemas = []
    for nome, texto in textos.items():
        if L.EMAIL.search(texto):
            problemas.append(f"{nome}: contém e-mail")
        if L.LINK_INTERNO.search(texto) or L.LINK_LOCAL.search(texto) or URL.search(texto):
            problemas.append(f"{nome}: contém link")
        for v in sensiveis:
            if json.dumps(v, ensure_ascii=False) in texto:
                problemas.append(f"{nome}: contém usuário do GIS")
                break
    return problemas


# --- Principal -------------------------------------------------------------------


def carregar_meta(caminho: Path) -> dict:
    if not caminho.exists():
        return {}
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    return dados.get("projetos", {})


def construir(raw: Path, modo: str, meta_path: Path, sintetico: bool = False) -> dict[str, Any]:
    caminhos = listar_fontes(raw)
    if not caminhos:
        raise SystemExit(f"Nenhum KMZ/KML encontrado em {raw}.")
    fontes = [ler_fonte(p) for p in caminhos]
    tipos = {f.arquivo: classificar(f) for f in fontes}
    base, hashes, avisos = escolher_base(fontes)

    trechos = [limpar_trecho(i, f) for i, f in enumerate(base.trechos_base if base else [], 1)]
    indice = IndiceRede(trechos)

    zeis_fonte = next((f for f in fontes if tipos[f.arquivo] == TIPO_ZEIS), None)
    relevo_fonte = next((f for f in fontes if tipos[f.arquivo] == TIPO_RELEVO), None)
    zeis, sedes = montar_zeis(zeis_fonte, indice)
    meta = carregar_meta(meta_path)
    projetos = montar_projetos(
        [f for f in fontes if tipos[f.arquivo] == TIPO_BASE_PROJETO], indice, zeis, meta
    )

    datas = sorted(t["cadastro"] for t in trechos if t["cadastro"])
    meses = meses_entre(datas[0][:7], datas[-1][:7]) if datas else []
    por_mun: dict[str, list[dict]] = defaultdict(list)
    for t in trechos:
        por_mun[t["municipio"] or "Sem município"].append(t)
    proj_mun: dict[str, list[dict]] = defaultdict(list)
    for p in projetos:
        proj_mun[p["municipio"] or "Sem município"].append(p)
    municipios = sorted(
        (agregar(m, ts, proj_mun.get(m, []), meses) for m, ts in por_mun.items()),
        key=lambda x: (-x["trechos"], x["nome"]),
    )
    todos = agregar("Todos os municípios", trechos, projetos, meses)

    inconsist = quality.avaliar(trechos)

    # Inventário do portfólio
    hash_usado = hashes.get(base.arquivo) if base else None
    ja_referencia = False
    portfolio = []
    for f in fontes:
        tipo = tipos[f.arquivo]
        c = f.contagem()
        dup = None
        if tipo == TIPO_BASE_PROJETO:
            proj = next(p for p in projetos if p["arquivo"] == f.arquivo)
            uso, conteudo = "Projeto", f"Base cadastral + projeto {proj['id']} ({proj['nome']})"
        elif tipo == TIPO_BASE:
            if hashes[f.arquivo] == hash_usado and not ja_referencia and base and base.arquivo == f.arquivo:
                uso, conteudo = "Referência", "Base cadastral (cópia usada no painel)"
                ja_referencia = True
            elif hashes[f.arquivo] != hash_usado:
                uso, conteudo = "Arquivar", "Base cadastral (versão anterior)"
            else:
                uso, conteudo = "Arquivar", "Base cadastral duplicada"
                dup = base.arquivo if base else None
        elif tipo == TIPO_ZEIS:
            uso, conteudo = "Referência", f"ZEIS preliminar: {len(zeis)} polígonos + {len(sedes)} sedes"
        elif tipo == TIPO_RELEVO:
            uso, conteudo = "Referência", "Geomorfologia (relevo)"
        elif tipo == TIPO_VAZIO:
            uso, conteudo = "Excluir", "Arquivo sem feições"
        else:
            uso, conteudo = "Arquivar", "Conteúdo não identificado"
        portfolio.append(
            {
                "arquivo": f.arquivo,
                "documento": f.documento or None,
                "tipo": tipo,
                "conteudo": conteudo,
                "feicoes": len(f.feicoes),
                "trechos_base": len(f.trechos_base),
                "pontos": c["pontos"],
                "linhas": c["linhas"],
                "poligonos": c["poligonos"],
                "base_igual_a_usada": (hashes.get(f.arquivo) == hash_usado) if f.arquivo in hashes else None,
                "duplicado_de": dup,
                "uso": uso,
            }
        )

    # Rede (só no modo completo)
    rede_features = [
        feature(
            geo.simplificar(t["_geom"], 1.0),
            {"id": t["id"], "t": t["tipo"], "f": L.faixa_diametro(t["diametro_mm"]), "m": t["municipio"]},
        )
        for t in trechos
    ]
    projetos_features = []
    for p in projetos:
        for x in p["_feicoes"]:
            projetos_features.append(
                feature(
                    x["f"].geometria,
                    {
                        "projeto": p["id"],
                        "papel": x["papel"],
                        "rotulo": ROTULO_PAPEL[x["papel"]],
                        "comprimento_m": round(geo.comprimento_m(x["f"].geometria), 1)
                        if x["papel"] == "tracado"
                        else None,
                    },
                )
            )
    zeis_features = [
        feature(z["_geom"], {"id": z["id"], "nome": z["nome"], "area_ha": z["area_ha"]}) for z in zeis
    ]
    sedes_features = [feature(s["_geom"], {"nome": s["nome"]}) for s in sedes]

    ultima = max((t["_ultima_edicao"] for t in trechos if t["_ultima_edicao"]), default=None)
    usar_rede = modo == "completo"
    saidas: dict[str, Any] = {
        "indicadores.json": {"todos": todos, "municipios": municipios, "rotulos_tipo": L.ROTULO_TIPO},
        "projetos.json": {"etapas": ETAPAS, "projetos": [publico(p) for p in projetos]},
        "projetos.geojson": colecao(projetos_features),
        "zeis.json": [publico(z) for z in zeis],
        "zeis.geojson": colecao(zeis_features),
        "sedes.geojson": colecao(sedes_features),
        "inconsistencias.json": [
            i if usar_rede else {k: v for k, v in i.items() if k != "trechos"} for i in inconsist
        ],
        "portfolio.json": portfolio,
    }
    if relevo_fonte is not None:
        saidas["relevo.geojson"] = colecao(montar_relevo(relevo_fonte))
    if usar_rede:
        saidas["rede.geojson"] = colecao(rede_features)
        saidas["trechos.json"] = [publico(t) for t in trechos]

    for p in saidas["projetos.json"]["projetos"]:
        p.pop("_feicoes", None)

    contagens = {
        "fontes": len(fontes),
        "trechos": len(trechos),
        "projetos": len(projetos),
        "zeis": len(zeis),
        "relevo": len(saidas.get("relevo.geojson", {}).get("features", [])),
        "por_tipo_arquivo": dict(Counter(tipos.values())),
    }
    codigos_material = Counter(
        t["material_codigo"] for t in trechos if t["material"] == L.MATERIAL_OUTROS
    )
    manifest = {
        "produto": "Painel de Extensões de Rede R4",
        "organizacao": "Regional R4 – Interior (RJ)",
        "versao_pipeline": VERSAO,
        "modo": modo,
        "sintetico": sintetico,
        "dados_ate": ultima.isoformat() if ultima else None,
        "base_usada": base.arquivo if base else None,
        # hash de atributos + coordenadas: identifica a versão da base, mesmo reexportada
        "base_hash": hash_usado,
        "avisos": avisos,
        "fontes": [
            {"arquivo": f.arquivo, "sha256": f.sha256, "tipo": tipos[f.arquivo], "feicoes": len(f.feicoes)}
            for f in fontes
        ],
        "contagens": contagens,
        "materiais_outros": dict(codigos_material.most_common()),
        "arquivos": sorted(saidas),
    }
    return {"saidas": saidas, "manifest": manifest, "sensiveis": coletar_sensiveis(fontes)}


def serializar(obj: Any) -> str:
    def padrao(o: Any) -> Any:
        if isinstance(o, (date, datetime)):
            return o.isoformat()
        raise TypeError(type(o))

    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), default=padrao)


def escrever(resultado: dict, out: Path) -> list[str]:
    out.mkdir(parents=True, exist_ok=True)
    textos = {nome: serializar(dados) for nome, dados in resultado["saidas"].items()}
    manifest = resultado["manifest"]
    problemas = verificar_privacidade(textos, resultado["sensiveis"])
    if problemas:
        raise SystemExit("Saída bloqueada por privacidade:\n  " + "\n  ".join(problemas))

    conteudo_hash = hashlib.sha256(
        "".join(textos[n] for n in sorted(textos)).encode("utf-8")
    ).hexdigest()
    anterior = out / "manifest.json"
    gerado_em = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    if anterior.exists():
        try:
            velho = json.loads(anterior.read_text(encoding="utf-8"))
            if velho.get("conteudo_sha256") == conteudo_hash:
                gerado_em = velho.get("gerado_em", gerado_em)  # idempotente
        except json.JSONDecodeError:
            pass
    manifest = {**manifest, "gerado_em": gerado_em, "conteudo_sha256": conteudo_hash}
    manifest["tamanhos_bytes"] = {n: len(t.encode("utf-8")) for n, t in sorted(textos.items())}
    textos["manifest.json"] = json.dumps(manifest, ensure_ascii=False, indent=2)

    # remove saídas antigas que não fazem mais parte do modo atual
    for velho in out.glob("*.json"):
        if velho.name not in textos:
            velho.unlink()
    for velho in out.glob("*.geojson"):
        if velho.name not in textos:
            velho.unlink()
    for nome, texto in textos.items():
        (out / nome).write_text(texto + "\n", encoding="utf-8")
    return sorted(textos)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", type=Path, default=RAIZ / "data" / "raw")
    ap.add_argument("--out", type=Path, default=RAIZ / "public" / "data")
    ap.add_argument("--meta", type=Path, default=RAIZ / "data" / "projetos_meta.json")
    ap.add_argument(
        "--modo",
        choices=["agregado", "completo"],
        default="agregado",
        help="agregado (padrão): sem geometria/atributos por trecho; completo: tudo",
    )
    ap.add_argument("--sintetico", action="store_true", help="marca a saída como dados de teste")
    args = ap.parse_args(argv)
    resultado = construir(args.raw, args.modo, args.meta, args.sintetico)
    arquivos = escrever(resultado, args.out)
    m = resultado["manifest"]
    print(f"Modo {args.modo}: {m['contagens']['trechos']} trechos, {m['contagens']['projetos']} projetos.")
    for a in m["avisos"]:
        print("Aviso:", a)
    print("Gerados em", args.out, ":", ", ".join(arquivos))


if __name__ == "__main__":
    main()
