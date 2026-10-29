"""Valores de referência da seção 4 do escopo.

Os números valem para a versão da base usada no escopo (out/2026). Rodam só quando os
KMZ reais estão em data/raw/ e a base é exatamente essa versão, identificada pelo hash
de atributos + coordenadas (manifest.base_hash). Com uma base atualizada, os testes
são pulados: novas extensões mudam os totais e isso não é erro.
"""

import json

import pytest

# Hash da base cadastral do escopo (5.480 trechos, LAST_EDI_1 até 12/03/2025).
HASH_BASE_REFERENCIA = "ed1af2909c9dc03cfa9a4dcc68c7c647af8e674aa28583ffacec69b88bca7b57"


@pytest.fixture(autouse=True)
def _so_com_a_base_de_referencia(real_saida):
    if real_saida["manifest"]["base_hash"] != HASH_BASE_REFERENCIA:
        pytest.skip("Base cadastral diferente da usada no escopo: valores de referência não se aplicam.")


def carregar(saida, nome):
    return json.loads((saida["out"] / nome).read_text(encoding="utf-8"))


def test_base(real_saida):
    t = carregar(real_saida, "indicadores.json")["todos"]
    assert t["trechos"] == 5480
    assert t["rede_km"] == pytest.approx(1198.2, abs=0.1)
    assert t["extensoes_km"] == pytest.approx(63.0, abs=0.1)
    assert t["extensoes_trechos"] == 453
    assert t["extensoes_pct"] == pytest.approx(5.3, abs=0.1)
    assert t["melhorias_km"] == pytest.approx(297.5, abs=0.1)
    assert t["completude_pct"] == pytest.approx(54.3, abs=0.1)


def test_municipio_top(real_saida):
    m = carregar(real_saida, "indicadores.json")["municipios"][0]
    assert m["nome"] == "São Francisco de Itabapoana"
    assert m["trechos"] == 896


def test_portfolio(real_saida):
    p = carregar(real_saida, "portfolio.json")
    assert len(p) == 12
    tipos = [x["tipo"] for x in p]
    assert tipos.count("base_projeto") == 3
    assert tipos.count("base") == 2
    assert tipos.count("zeis") == 1
    assert tipos.count("relevo") == 1
    assert tipos.count("vazio") == 5
    # as cinco cópias da base são idênticas
    assert all(x["base_igual_a_usada"] for x in p if x["trechos_base"])


def _projetos(real_saida):
    return {p["id"]: p for p in carregar(real_saida, "projetos.json")["projetos"]}


def test_p1_prainha(real_saida):
    p = _projetos(real_saida)["P1"]
    assert p["nome"] == "Extensão de Rede Prainha"
    # O escopo cita 1.314 m; o geodésico (GRS80) dá 1.315,7 m (0,1%).
    assert p["tracado_m"] == pytest.approx(1314, rel=0.005)
    # O escopo cita ~140 m, mas esse valor é a distância até o VÉRTICE mais próximo.
    # A distância até o trecho (definição da seção 8) é ~1 m: o ponto está sobre a adutora.
    assert p["distancia_rede_m"] < 5


def test_p2_rio_bonito_centro(real_saida):
    p = _projetos(real_saida)["P2"]
    assert p["municipio"] == "Rio Bonito"
    assert p["bairro"] == "Centro"
    assert p["tracado_m"] == pytest.approx(51, abs=1)


def test_p3_rio_dos_indios(real_saida):
    p = _projetos(real_saida)["P3"]
    assert p["bairro"] == "Rio dos Índios"
    assert p["areas"] == 2
    assert p["area_ha"] == pytest.approx(6.5, abs=0.1)
    assert p["tracado_m"] == 0


def test_zeis_rio_bonito(real_saida):
    z = carregar(real_saida, "zeis.json")
    assert [x["municipio"] for x in z] == ["Rio Bonito"] * 3
    for valor, esperado in zip([x["area_ha"] for x in z], [18.2, 10.0, 12.1]):
        assert valor == pytest.approx(esperado, abs=0.1)
