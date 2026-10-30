"""Download da pasta do OneDrive (Graph simulado, sem rede)."""

import io
import json
import zipfile

import baixar_onedrive as od
import pytest

AMBIENTE = {
    "AZURE_TENANT_ID": "tenant",
    "AZURE_CLIENT_ID": "cliente",
    "AZURE_CLIENT_SECRET": "segredo",
    "ONEDRIVE_LINK_PASTA": "https://empresa-my.sharepoint.com/:f:/g/personal/x/abc",
}


def _zip(arquivos: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for nome, dados in arquivos.items():
            z.writestr(nome, dados)
    return buf.getvalue()


def graph_falso(itens: list[dict], downloads: dict[str, bytes]):
    chamadas = []

    def req(url, dados, cab):
        chamadas.append(url)
        if "login.microsoftonline.com" in url:
            assert b"client_credentials" in dados
            return json.dumps({"access_token": "tok"}).encode()
        if "/shares/" in url:
            assert cab["Authorization"] == "Bearer tok"
            return json.dumps({"value": itens}).encode()
        return downloads[url]

    return req, chamadas


def test_codifica_link_de_compartilhamento():
    # exemplo da documentação do Microsoft Graph
    link = "https://onedrive.live.com/redir?resid=1231244193912!12&authKey=1201919!12921!1"
    assert od.codificar_link(link) == (
        "u!aHR0cHM6Ly9vbmVkcml2ZS5saXZlLmNvbS9yZWRpcj9yZXNpZD0xMjMxMjQ0MTkzOTEyITEyJmF1dGhLZXk9MTIwMTkxOSExMjkyMSEx"
    )


def test_baixa_kmz_e_extrai_zip(tmp_path):
    itens = [
        {"name": "744407516885019490", "size": 3, "file": {}, "@microsoft.graph.downloadUrl": "https://d/1"},
        {"name": "Projetos.zip", "size": 10, "file": {}, "@microsoft.graph.downloadUrl": "https://d/2"},
        {"name": "planilha.xlsx", "size": 1, "file": {}, "@microsoft.graph.downloadUrl": "https://d/3"},
    ]
    downloads = {
        "https://d/1": b"PK1",
        "https://d/2": _zip({"pasta/111": b"PKa", "222.kmz": b"PKb", "leia.txt": b"x", "../fora": b"y"}),
    }
    req, chamadas = graph_falso(itens, downloads)
    salvos = od.baixar(tmp_path, AMBIENTE, req)
    # caminhos dentro do zip são descartados: "../fora" vira "fora", dentro do destino
    assert sorted(salvos) == ["111", "222.kmz", "744407516885019490", "fora"]
    assert (tmp_path / "111").read_bytes() == b"PKa"
    assert (tmp_path / "fora").exists() and not (tmp_path.parent / "fora").exists()
    assert not (tmp_path / "leia.txt").exists()
    assert "https://d/3" not in chamadas  # .xlsx nem é baixado


def test_sem_segredos_explica_o_que_falta(tmp_path):
    with pytest.raises(SystemExit, match="AZURE_CLIENT_SECRET"):
        od.baixar(tmp_path, {**AMBIENTE, "AZURE_CLIENT_SECRET": ""})


def test_pasta_vazia_falha(tmp_path):
    req, _ = graph_falso([], {})
    with pytest.raises(SystemExit, match="Nenhum KMZ"):
        od.baixar(tmp_path, AMBIENTE, req)


@pytest.mark.parametrize("nome,ok", [("744407516885019490", True), ("a.kmz", True), ("a.KML", True), ("b.zip", True), ("c.pdf", False)])
def test_filtro_de_arquivos(nome, ok):
    assert od.interessa(nome) is ok


@pytest.mark.parametrize("nome", ["../x", "a/b", "", ".."])
def test_rejeita_nomes_com_caminho(nome):
    assert not od.nome_valido(nome)
