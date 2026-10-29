"""Regras de inconsistência do cadastro.

Gravidade:
- Alta: impede dimensionar ou orçar (material, diâmetro, extensão).
- Média: atrapalha relatórios (bairro, função, pavimento, profundidade, data, anexos).
- Baixa: padronização de texto.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Callable

ALTA, MEDIA, BAIXA = "Alta", "Média", "Baixa"

# Divergência entre EXTENSAO e o comprimento do desenho.
DIVERGENCIA_REL = 0.20
DIVERGENCIA_ABS_M = 5.0


@dataclass(frozen=True)
class Regra:
    codigo: str
    problema: str
    gravidade: str
    acao: str
    teste: Callable[[dict], bool]


def extensao_divergente(t: dict) -> bool:
    ext, comp = t["extensao_m"], t["comprimento_m"]
    if not ext or comp <= 0:
        return False
    dif = abs(ext - comp)
    return dif > DIVERGENCIA_ABS_M and dif / comp > DIVERGENCIA_REL


REGRAS: list[Regra] = [
    Regra(
        "sem_material",
        "Material não informado",
        ALTA,
        "Levantar o material em campo ou no projeto original e atualizar no GIS.",
        lambda t: t["material"] is None,
    ),
    Regra(
        "sem_diametro",
        "Diâmetro não informado (0 ou vazio)",
        ALTA,
        "Informar o diâmetro nominal (mm); 0 hoje significa 'não informado'.",
        lambda t: t["diametro_mm"] is None,
    ),
    Regra(
        "extensao_divergente",
        "Extensão cadastrada difere do desenho (> 20% e > 5 m)",
        ALTA,
        "Conferir o traçado e corrigir o campo EXTENSAO ou a geometria.",
        extensao_divergente,
    ),
    Regra(
        "sem_extensao",
        "Extensão cadastrada vazia ou zero",
        ALTA,
        "Preencher EXTENSAO a partir do comprimento do desenho.",
        lambda t: not t["extensao_m"],
    ),
    Regra(
        "sem_bairro",
        "Bairro não informado",
        MEDIA,
        "Preencher o bairro (vazio, 'n/a' ou 'NULL' hoje).",
        lambda t: t["bairro"] is None,
    ),
    Regra(
        "sem_funcao",
        "Função da rede não informada",
        MEDIA,
        "Classificar como distribuição ou adução.",
        lambda t: t["funcao"] is None,
    ),
    Regra(
        "sem_pavimento",
        "Tipo de pavimento não informado",
        MEDIA,
        "Informar o pavimento para orçar a recomposição.",
        lambda t: t["pavimento"] is None,
    ),
    Regra(
        "sem_profundidade",
        "Profundidade não informada (0 ou vazio)",
        MEDIA,
        "Informar a profundidade (m); 0 hoje significa 'não informado'.",
        lambda t: t["profundidade_m"] is None,
    ),
    Regra(
        "sem_data_cadastro",
        "Data de cadastro no GIS ausente",
        MEDIA,
        "Verificar a origem do registro no GIS.",
        lambda t: t["cadastro"] is None,
    ),
    Regra(
        "link_local",
        "Descrição aponta para arquivo local (link de computador pessoal)",
        MEDIA,
        "Mover o anexo para o repositório corporativo e referenciar pelo GLOBALID.",
        lambda t: t["_link_local"],
    ),
    Regra(
        "link_interno",
        "Descrição contém link interno (SharePoint/Drive)",
        BAIXA,
        "Trocar o link por anexo no GIS; links internos não são publicados.",
        lambda t: t["_link_interno"],
    ),
    Regra(
        "bairro_grafia",
        "Grafia do bairro corrigida automaticamente (ex.: 'Cenrto')",
        BAIXA,
        "Aplicar a correção na base do GIS.",
        lambda t: t["_bairro_corrigido"],
    ),
    Regra(
        "pavimento_grafia",
        "Grafia do pavimento unificada (acentuação)",
        BAIXA,
        "Padronizar o domínio do campo TIPO_PAVIM no GIS.",
        lambda t: t["_pavimento_corrigido"],
    ),
    Regra(
        "material_fora_padrao",
        "Material fora da lista padrão (agrupado em 'Outros')",
        BAIXA,
        "Confirmar o material e usar o domínio padrão do GIS.",
        lambda t: t["material"] == "Outros",
    ),
]

ORDEM_GRAVIDADE = {ALTA: 0, MEDIA: 1, BAIXA: 2}


def avaliar(trechos: list[dict]) -> list[dict]:
    saida = []
    for r in REGRAS:
        afetados = [t for t in trechos if r.teste(t)]
        por_mun = Counter(t["municipio"] or "Sem município" for t in afetados)
        saida.append(
            {
                "codigo": r.codigo,
                "problema": r.problema,
                "gravidade": r.gravidade,
                "acao": r.acao,
                "total": len(afetados),
                "por_municipio": dict(sorted(por_mun.items())),
                "trechos": [t["id"] for t in afetados],
            }
        )
    saida.sort(key=lambda x: (ORDEM_GRAVIDADE[x["gravidade"]], -x["total"]))
    return saida
