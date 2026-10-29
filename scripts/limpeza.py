"""Normalização dos atributos da base cadastral (regras da seção 3 do escopo)."""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timezone

NULOS = {"", "n/a", "na", "null", "<null>", "<nulo>", "nulo", "none", "-", "--", "sem informacao"}

# Grafias conhecidas que precisam de correção (Baixa: padronização de texto).
CORRECOES_BAIRRO = {"cenrto": "Centro"}

PARTICULAS = {"de", "da", "do", "das", "dos", "e"}

TIPO_EXTENSAO = "extensao"
TIPO_MELHORIA = "melhoria"
TIPO_SUBSTITUICAO = "substituicao"
TIPO_ENCONTRADA = "encontrada"
TIPO_DOADA = "doada"
TIPO_EXISTENTE = "existente"

ROTULO_TIPO = {
    TIPO_EXTENSAO: "Extensão",
    TIPO_MELHORIA: "Melhoria",
    TIPO_SUBSTITUICAO: "Substituição",
    TIPO_ENCONTRADA: "Rede encontrada",
    TIPO_DOADA: "Rede doada",
    TIPO_EXISTENTE: "Rede existente / sem classificação",
}


def sem_acento(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )


def chave(texto: str) -> str:
    return sem_acento(texto).casefold().strip()


def nulo(valor: str | None) -> str | None:
    if valor is None:
        return None
    v = re.sub(r"\s+", " ", valor).strip()
    return None if chave(v) in NULOS else v


def numero(valor: str | None) -> float | None:
    v = nulo(valor)
    if v is None:
        return None
    v = v.replace(" ", "")
    if "," in v and "." in v:
        v = v.replace(".", "").replace(",", ".")
    elif "," in v:
        v = v.replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None


def positivo(valor: str | None) -> float | None:
    """0 significa 'não informado' em DIAMETRO_N e PROFUNDIDA."""
    n = numero(valor)
    return n if n is not None and n > 0 else None


def titulo(texto: str) -> str:
    """Caixa de título em pt-BR: preposições em minúsculas, exceto no início."""
    palavras = texto.lower().split(" ")
    saida = []
    for i, p in enumerate(palavras):
        saida.append(p if (i > 0 and p in PARTICULAS) else p[:1].upper() + p[1:])
    return " ".join(saida)


def bairro(valor: str | None) -> tuple[str | None, bool]:
    """Devolve (bairro limpo, houve correção de grafia)."""
    v = nulo(valor)
    if v is None:
        return None, False
    corrigido = CORRECOES_BAIRRO.get(chave(v))
    if corrigido:
        return corrigido, True
    novo = titulo(v)
    return novo, novo != v


def municipio(valor: str | None) -> str | None:
    v = nulo(valor)
    if v is None:
        return None
    return titulo(v) if v.isupper() else v


PAVIMENTOS = {
    "paralelepipedo": "Paralelepípedo",
    "calcada": "Calçada",
    "terra": "Terra",
    "asfalto": "Asfalto",
    "bloquete": "Bloquete",
    "concreto": "Concreto",
    "outro": "Outro",
}


def pavimento(valor: str | None) -> tuple[str | None, bool]:
    v = nulo(valor)
    if v is None:
        return None, False
    novo = PAVIMENTOS.get(chave(v), v)
    return novo, novo != v


FUNCOES = {
    "distribuicao": "Distribuição",
    "aducao": "Adução",
    "aducao tratada": "Adução de água tratada",
    "aducao bruta": "Adução de água bruta",
}


def funcao(valor: str | None) -> str | None:
    v = nulo(valor)
    if v is None:
        return None
    return FUNCOES.get(chave(v), v)


# Ordem importa: DEFOFO contém "FOFO"; PVC orientado e com fibra seguem como PVC.
MATERIAIS: list[tuple[str, str]] = [
    (r"DEFOFO", "DEFOFO"),
    (r"^PEAD|POLIETILENO_ALTA|POLIETILENO ALTA", "PEAD"),
    (r"^PVC|POLICLORETO", "PVC"),
    (r"^FD_|DUCTIL", "Ferro dúctil"),
    (r"^FF_|^FOFO|FERRO_FUNDIDO|FERRO FUNDIDO", "Ferro fundido"),
    (r"^CA_|AMIANTO|FIBROCIMENTO", "Cimento amianto"),
]
MATERIAL_OUTROS = "Outros"


def material(valor: str | None) -> tuple[str | None, str | None]:
    """Devolve (rótulo curto, código original)."""
    v = nulo(valor)
    if v is None:
        return None, None
    k = sem_acento(v).upper()
    for padrao, rotulo in MATERIAIS:
        if re.search(padrao, k):
            return rotulo, v
    return MATERIAL_OUTROS, v


def tipo_obra(classsific: str | None, notas: str | None) -> str:
    """Classsific (três 's') e, se vazio, NOTAS."""
    fonte = nulo(classsific) or nulo(notas) or ""
    k = sem_acento(fonte).upper()
    if "EXTENS" in k:
        return TIPO_EXTENSAO
    if "MELHORIA" in k:
        return TIPO_MELHORIA
    if "SUBSTITU" in k:
        return TIPO_SUBSTITUICAO
    if "ENCONTRADA" in k:
        return TIPO_ENCONTRADA
    if "DOADA" in k:
        return TIPO_DOADA
    return TIPO_EXISTENTE


_FORMATOS_DATA = ("%Y/%m/%d", "%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S")


def data(valor: str | None) -> date | None:
    """Data de cadastro no GIS (CREATED_DA). Não é a data da obra."""
    v = nulo(valor)
    if v is None:
        return None
    if re.fullmatch(r"\d{12,13}", v):  # epoch em ms (export do ArcGIS)
        return datetime.fromtimestamp(int(v) / 1000, tz=timezone.utc).date()
    base = v.split(".")[0].replace("Z", "")
    for fmt in _FORMATOS_DATA:
        try:
            return datetime.strptime(base, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.strptime(base[:10], "%Y/%m/%d").date()
    except ValueError:
        return None


LINK_LOCAL = re.compile(r"file:///", re.I)
LINK_INTERNO = re.compile(r"sharepoint\.com|drive\.google\.com|docs\.google\.com|onedrive", re.I)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")


def faixa_diametro(diametro_mm: float | None) -> int:
    """0 = não informado · 1 = até 75 mm · 2 = 76 a 150 mm · 3 = acima de 150 mm."""
    if diametro_mm is None:
        return 0
    if diametro_mm <= 75:
        return 1
    if diametro_mm <= 150:
        return 2
    return 3
