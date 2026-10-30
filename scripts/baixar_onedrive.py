"""Baixa os KMZ de uma pasta do OneDrive da empresa (Microsoft Graph) para data/raw/.

Roda na automação "Atualizar dados" do GitHub Actions. As credenciais vêm de segredos
do repositório, nunca do código:

    AZURE_TENANT_ID       id do diretório (tenant) da empresa
    AZURE_CLIENT_ID       id do aplicativo registrado no Azure pela TI
    AZURE_CLIENT_SECRET   segredo do aplicativo
    ONEDRIVE_LINK_PASTA   link de compartilhamento da pasta com os KMZ

O aplicativo precisa da permissão de aplicativo Files.Read.All (ou Sites.Selected
restrita ao OneDrive/site da pasta), com consentimento do administrador.
Ver docs/ONEDRIVE.md.

Uso: python scripts/baixar_onedrive.py [--destino data/raw]
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Callable

GRAPH = "https://graph.microsoft.com/v1.0"
VARIAVEIS = ("AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "ONEDRIVE_LINK_PASTA")
LIMITE_ARQUIVO = 200 * 1024 * 1024  # 200 MB por arquivo
NOME_SEGURO = re.compile(r"^[\w .()\-]+$", re.UNICODE)

# (url, dados, cabeçalhos) -> bytes. Injetável para os testes.
Requisicao = Callable[[str, bytes | None, dict[str, str]], bytes]


class ErroConfiguracao(SystemExit):
    pass


def _requisicao_padrao(url: str, dados: bytes | None, cabecalhos: dict[str, str]) -> bytes:
    req = urllib.request.Request(url, data=dados, headers=cabecalhos)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read(LIMITE_ARQUIVO + 1)
    except urllib.error.HTTPError as e:
        corpo = e.read(2000).decode("utf-8", "replace")
        # Não repete a URL inteira: links de download trazem tokens temporários.
        raise SystemExit(f"Erro {e.code} ao acessar {urllib.parse.urlsplit(url).netloc}: {corpo}") from None


def codificar_link(link: str) -> str:
    """Link de compartilhamento -> id aceito em /shares/{id} (Graph)."""
    b64 = base64.urlsafe_b64encode(link.strip().encode("utf-8")).decode("ascii").rstrip("=")
    return "u!" + b64


def obter_token(tenant: str, cliente: str, segredo: str, req: Requisicao) -> str:
    corpo = urllib.parse.urlencode(
        {
            "client_id": cliente,
            "client_secret": segredo,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
    ).encode()
    url = f"https://login.microsoftonline.com/{urllib.parse.quote(tenant)}/oauth2/v2.0/token"
    resposta = json.loads(req(url, corpo, {"Content-Type": "application/x-www-form-urlencoded"}))
    if "access_token" not in resposta:
        raise SystemExit("O Azure não devolveu token: confira tenant, client id e segredo.")
    return resposta["access_token"]


def listar_pasta(link: str, token: str, req: Requisicao) -> list[dict]:
    """Arquivos da pasta compartilhada (sem subpastas), seguindo a paginação."""
    cab = {"Authorization": f"Bearer {token}"}
    url = f"{GRAPH}/shares/{codificar_link(link)}/driveItem/children?$top=200"
    itens: list[dict] = []
    while url:
        pagina = json.loads(req(url, None, cab))
        itens.extend(i for i in pagina.get("value", []) if "file" in i)
        url = pagina.get("@odata.nextLink")
    return itens


def nome_valido(nome: str) -> bool:
    return bool(NOME_SEGURO.match(nome)) and nome not in (".", "..")


def interessa(nome: str) -> bool:
    """KMZ, KML, zip ou arquivo sem extensão (o Google Earth exporta assim)."""
    ext = Path(nome).suffix.lower()
    return ext in ("", ".kmz", ".kml", ".zip")


def extrair_zip(conteudo: bytes, destino: Path) -> list[str]:
    """Extrai só arquivos do primeiro nível, com nomes seguros (sem caminhos)."""
    salvos = []
    with zipfile.ZipFile(io.BytesIO(conteudo)) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            nome = Path(info.filename).name
            if not nome_valido(nome) or not interessa(nome) or nome.lower().endswith(".zip"):
                continue
            if info.file_size > LIMITE_ARQUIVO:
                raise SystemExit(f"{nome}: arquivo grande demais dentro do zip.")
            (destino / nome).write_bytes(z.read(info))
            salvos.append(nome)
    return salvos


def baixar(destino: Path, ambiente: dict[str, str], req: Requisicao = _requisicao_padrao) -> list[str]:
    faltando = [v for v in VARIAVEIS if not ambiente.get(v)]
    if faltando:
        raise ErroConfiguracao(
            "Conexão com o OneDrive não configurada. Faltam os segredos: "
            + ", ".join(faltando)
            + ". Veja docs/ONEDRIVE.md."
        )
    token = obter_token(
        ambiente["AZURE_TENANT_ID"], ambiente["AZURE_CLIENT_ID"], ambiente["AZURE_CLIENT_SECRET"], req
    )
    itens = listar_pasta(ambiente["ONEDRIVE_LINK_PASTA"], token, req)
    destino.mkdir(parents=True, exist_ok=True)
    salvos: list[str] = []
    for item in sorted(itens, key=lambda i: i.get("name", "")):
        nome = item.get("name", "")
        if not nome_valido(nome) or not interessa(nome):
            print(f"Ignorado: {nome!r}")
            continue
        if item.get("size", 0) > LIMITE_ARQUIVO:
            raise SystemExit(f"{nome}: arquivo grande demais ({item['size']} bytes).")
        url = item.get("@microsoft.graph.downloadUrl")
        if not url:
            raise SystemExit(f"{nome}: o Graph não devolveu link de download.")
        conteudo = req(url, None, {})  # link pré-autenticado e temporário
        if nome.lower().endswith(".zip"):
            salvos.extend(extrair_zip(conteudo, destino))
        else:
            (destino / nome).write_bytes(conteudo)
            salvos.append(nome)
    if not salvos:
        raise SystemExit("Nenhum KMZ/KML encontrado na pasta do OneDrive.")
    return salvos


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--destino", type=Path, default=Path(__file__).resolve().parent.parent / "data" / "raw")
    args = ap.parse_args(argv)
    salvos = baixar(args.destino, dict(os.environ))
    print(f"{len(salvos)} arquivo(s) baixado(s) para {args.destino}.")


if __name__ == "__main__":
    sys.exit(main())
