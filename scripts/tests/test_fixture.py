"""Pipeline de ponta a ponta sobre o portfólio sintético (roda no CI)."""

import json

import make_fixture
import pytest


def carregar(saida, nome):
    return json.loads((saida["out"] / nome).read_text(encoding="utf-8"))


def test_indicadores(fixture_saida):
    e = make_fixture.ESPERADO
    t = carregar(fixture_saida, "indicadores.json")["todos"]
    assert t["trechos"] == e["trechos"]
    assert t["rede_km"] == pytest.approx(e["rede_km"], abs=0.01)
    assert t["extensoes_km"] == pytest.approx(e["extensoes_km"], abs=0.01)
    assert t["extensoes_trechos"] == e["extensoes_trechos"]
    assert t["melhorias_km"] == pytest.approx(e["melhorias_km"], abs=0.01)
    assert t["completude_pct"] == pytest.approx(e["completude_pct"], abs=0.01)


def test_municipio_top(fixture_saida):
    m = carregar(fixture_saida, "indicadores.json")["municipios"]
    assert m[0]["nome"] == make_fixture.ESPERADO["municipio_top"]
    assert m[0]["trechos"] == make_fixture.ESPERADO["municipio_top_trechos"]


def test_mensal_cobre_todos_os_meses(fixture_saida):
    t = carregar(fixture_saida, "indicadores.json")["todos"]
    meses = [m["mes"] for m in t["mensal"]]
    assert meses == ["2024-01", "2024-02", "2024-03"]
    assert sum(m["extensoes_trechos"] for m in t["mensal"]) == 3
    assert t["extensoes_sem_data"] == 0


def test_deduplica_base(fixture_saida):
    p = carregar(fixture_saida, "portfolio.json")
    usos = [x["uso"] for x in p]
    assert usos.count("Excluir") == make_fixture.ESPERADO["vazios"]
    assert usos.count("Projeto") == 1
    assert usos.count("Arquivar") == 1  # uma das duas bases puras
    assert all(x["base_igual_a_usada"] for x in p if x["trechos_base"])


def test_projeto(fixture_saida):
    p = carregar(fixture_saida, "projetos.json")["projetos"]
    assert len(p) == 1
    proj = p[0]
    assert proj["id"] == "P1"
    assert proj["nome"] == "Extensão de Teste"
    assert proj["tracado_m"] == pytest.approx(221, abs=2)
    assert proj["distancia_rede_m"] == pytest.approx(0, abs=1)
    assert proj["etapa"] == "Traçado preliminar" and proj["etapa_inferida"]
    assert proj["ligacoes_previstas"] is None  # "a preencher", nunca inventado


def test_zeis(fixture_saida):
    z = carregar(fixture_saida, "zeis.json")
    assert len(z) == 1
    assert z[0]["area_ha"] == pytest.approx(1.0, abs=0.05)
    assert z[0]["rede_m"] == pytest.approx(80, abs=5)
    assert z[0]["extensoes_m"] == pytest.approx(80, abs=5)


def test_inconsistencias(fixture_saida):
    i = {x["codigo"]: x for x in carregar(fixture_saida, "inconsistencias.json")}
    assert i["extensao_divergente"]["total"] == 1
    assert i["extensao_divergente"]["gravidade"] == "Alta"
    assert i["sem_extensao"]["total"] == 1
    assert i["bairro_grafia"]["total"] == 2
    assert i["pavimento_grafia"]["total"] == 2
    assert i["link_local"]["total"] == 1
    assert i["material_fora_padrao"]["total"] == 1
    assert i["material_chumbo"]["total"] == 1
    trechos = {t["id"] for t in carregar(fixture_saida, "trechos.json")}
    assert set(i["sem_material"]["trechos"]) <= trechos


def test_campos_descartados(fixture_saida):
    t = carregar(fixture_saida, "trechos.json")[0]
    for proibido in ("FUNCAO_1", "DESCRICA_1", "descricao", "notas", "created_us", "last_edite"):
        assert proibido not in t
    assert not any(k.startswith("_") for k in t)


def test_modo_agregado_sem_trechos(tmp_path, fixture_saida):
    import build_dataset

    r = build_dataset.construir(fixture_saida["raw"], "agregado", tmp_path / "x.json")
    build_dataset.escrever(r, tmp_path)
    assert not (tmp_path / "rede.geojson").exists()
    assert not (tmp_path / "trechos.json").exists()
    inc = json.loads((tmp_path / "inconsistencias.json").read_text())
    assert all("trechos" not in x for x in inc)


def test_idempotente(tmp_path, fixture_saida):
    import build_dataset

    r = build_dataset.construir(fixture_saida["raw"], "completo", tmp_path / "x.json")
    build_dataset.escrever(r, tmp_path)
    m1 = (tmp_path / "manifest.json").read_text()
    build_dataset.escrever(build_dataset.construir(fixture_saida["raw"], "completo", tmp_path / "x.json"), tmp_path)
    assert (tmp_path / "manifest.json").read_text() == m1
