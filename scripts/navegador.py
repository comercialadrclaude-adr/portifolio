"""Ponto de entrada do pipeline para rodar dentro do navegador (Pyodide).

O painel lê a pasta dos KMZ direto no navegador do usuário: os arquivos são copiados
para o sistema de arquivos virtual do Pyodide, este módulo roda o mesmo pipeline do
`build_dataset.py` e o painel lê a saída de volta. Nada é enviado a servidor algum.

Não há regra de negócio aqui: só a chamada a `build_dataset` e a tradução dos erros
esperados (pasta sem KMZ, saída bloqueada por privacidade) em mensagens para a tela.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_dataset as B  # noqa: E402


def processar(raw: str, out: str, meta: str, modo: str = "completo", sintetico: bool = False) -> str:
    """Roda o pipeline e devolve um JSON: {"ok": true, ...} ou {"ok": false, "erro": "..."}."""
    try:
        resultado = B.construir(Path(raw), modo, Path(meta), sintetico)
        arquivos = B.escrever(resultado, Path(out))
    except SystemExit as e:  # erros esperados do pipeline (pasta vazia, privacidade)
        return json.dumps({"ok": False, "erro": str(e.code)}, ensure_ascii=False)
    m = resultado["manifest"]
    return json.dumps(
        {
            "ok": True,
            "arquivos": arquivos,
            "avisos": m["avisos"],
            "contagens": m["contagens"],
            "dados_ate": m["dados_ate"],
            "base_usada": m["base_usada"],
        },
        ensure_ascii=False,
    )
