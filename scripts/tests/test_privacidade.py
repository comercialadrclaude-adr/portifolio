"""Nenhum e-mail, usuário do GIS ou link interno pode sair no public/data."""

import re
from pathlib import Path

import build_dataset
import pytest

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
# Nenhuma URL deve sair nos dados publicados (links internos, SharePoint, Drive, file:///).
LINKS = re.compile(r"file:///|https?://", re.I)
RAIZ = Path(__file__).resolve().parents[2]


def _verificar_pasta(pasta: Path):
    arquivos = list(pasta.glob("*.json")) + list(pasta.glob("*.geojson"))
    assert arquivos
    for a in arquivos:
        texto = a.read_text(encoding="utf-8")
        assert not EMAIL.search(texto), f"e-mail em {a.name}"
        assert not LINKS.search(texto), f"link interno em {a.name}"


def test_fixture_sem_dados_pessoais(fixture_saida):
    _verificar_pasta(fixture_saida["out"])
    for usuario in fixture_saida["sensiveis"]:
        for a in fixture_saida["out"].iterdir():
            assert usuario not in a.read_text(encoding="utf-8")


def test_real_sem_dados_pessoais(real_saida):
    _verificar_pasta(real_saida["out"])


def test_public_data_versionado_sem_dados_pessoais():
    pasta = RAIZ / "public" / "data"
    if not any(pasta.glob("*.json")):
        pytest.skip("public/data ainda vazio")
    _verificar_pasta(pasta)


def test_bloqueia_saida_com_email():
    problemas = build_dataset.verificar_privacidade(
        {"x.json": '{"a":"fulano@empresa.com.br"}', "y.json": '{"b":"jsilva"}'}, {"jsilva"}
    )
    assert any("e-mail" in p for p in problemas)
    assert any("usuário" in p for p in problemas)
