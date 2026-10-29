import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parent.parent
RAIZ = SCRIPTS.parent
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_dataset  # noqa: E402
import make_fixture  # noqa: E402
from extract_kmz import listar_fontes  # noqa: E402

RAW_REAL = RAIZ / "data" / "raw"
META_REAL = RAIZ / "data" / "projetos_meta.json"


def _gerar(raw: Path, out: Path, meta: Path, sintetico: bool) -> dict:
    resultado = build_dataset.construir(raw, "completo", meta, sintetico)
    build_dataset.escrever(resultado, out)
    return resultado


@pytest.fixture(scope="session")
def fixture_saida(tmp_path_factory):
    raw = tmp_path_factory.mktemp("raw")
    out = tmp_path_factory.mktemp("out")
    make_fixture.gerar(raw)
    resultado = _gerar(raw, out, raw / "sem_meta.json", True)
    return {"raw": raw, "out": out, **resultado}


@pytest.fixture(scope="session")
def real_saida(tmp_path_factory):
    if not RAW_REAL.exists() or not listar_fontes(RAW_REAL):
        pytest.skip("Dados reais ausentes em data/raw/ (não são versionados).")
    out = tmp_path_factory.mktemp("real")
    resultado = _gerar(RAW_REAL, out, META_REAL, False)
    return {"raw": RAW_REAL, "out": out, **resultado}
