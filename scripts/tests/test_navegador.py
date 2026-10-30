"""Ponto de entrada do pipeline usado no navegador (Pyodide).

A conferência de que o Pyodide gera os mesmos arquivos que este Python está em
src/lib/pasta/pipeline.test.ts. Aqui se testa a cola: resposta em JSON e erros esperados.
"""

import json

import build_dataset
import navegador


def _rodar(raw, out, **kw):
    return json.loads(navegador.processar(str(raw), str(out), str(raw / "sem_meta.json"), **kw))


def test_devolve_resumo_e_grava_os_mesmos_arquivos_do_pipeline(fixture_saida, tmp_path):
    r = _rodar(fixture_saida["raw"], tmp_path, sintetico=True)
    assert r["ok"] is True
    assert r["contagens"]["trechos"] == 10
    assert r["base_usada"] == "1002"
    assert sorted(r["arquivos"]) == sorted(p.name for p in fixture_saida["out"].iterdir())

    for nome in r["arquivos"]:
        a = json.loads((tmp_path / nome).read_text(encoding="utf-8"))
        b = json.loads((fixture_saida["out"] / nome).read_text(encoding="utf-8"))
        if nome == "manifest.json":
            a.pop("gerado_em"), b.pop("gerado_em")
        assert a == b, nome


def test_pasta_sem_kmz_vira_mensagem_e_nao_excecao(tmp_path):
    raw = tmp_path / "raw"
    raw.mkdir()
    (raw / "planilha").write_text("não é KMZ", encoding="utf-8")
    r = _rodar(raw, tmp_path / "out")
    assert r["ok"] is False
    assert "Nenhum KMZ/KML" in r["erro"]
    assert not (tmp_path / "out").exists()


def test_saida_com_dado_pessoal_e_bloqueada_e_nada_e_gravado(fixture_saida, tmp_path, monkeypatch):
    original = build_dataset.construir

    def com_email(*a, **kw):
        resultado = original(*a, **kw)
        resultado["saidas"]["zeis.json"][0]["nome"] = "fulano@empresa.com.br"
        return resultado

    monkeypatch.setattr(build_dataset, "construir", com_email)
    r = _rodar(fixture_saida["raw"], tmp_path / "out", sintetico=True)
    assert r["ok"] is False
    assert "privacidade" in r["erro"]
    assert not list((tmp_path / "out").glob("*.json"))
