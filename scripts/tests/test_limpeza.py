from datetime import date

import limpeza as L
import pytest


@pytest.mark.parametrize(
    "entrada,esperado,corrigido",
    [
        ("Cenrto", "Centro", True),
        ("n/a", None, False),
        ("NULL", None, False),
        ("<NULL>", None, False),
        ("", None, False),
        ("Barra De São João", "Barra de São João", True),
        ("Centro", "Centro", False),
    ],
)
def test_bairro(entrada, esperado, corrigido):
    assert L.bairro(entrada) == (esperado, corrigido)


@pytest.mark.parametrize(
    "entrada,esperado",
    [
        ("Paralelepipedo", "Paralelepípedo"),
        ("Paralelepípedo", "Paralelepípedo"),
        ("Calcada", "Calçada"),
        ("Calçada", "Calçada"),
        ("Terra", "Terra"),
    ],
)
def test_pavimento_unificado(entrada, esperado):
    assert L.pavimento(entrada)[0] == esperado


@pytest.mark.parametrize(
    "codigo,rotulo",
    [
        ("PVC_Policloreto_de_vinila", "PVC"),
        ("PEAD_Polietileno_alta_densidade", "PEAD"),
        ("FF_Ferro_fundido", "Ferro fundido"),
        ("MPVC_DEFOFO", "DEFOFO"),
        ("DEFOFO", "DEFOFO"),
        ("CA_Cimento_amianto", "Cimento amianto"),
        ("FD_Ferro_ductil", "Ferro dúctil"),
        ("Chumbo", "Outros"),
        ("", None),
    ],
)
def test_material(codigo, rotulo):
    assert L.material(codigo)[0] == rotulo


@pytest.mark.parametrize(
    "classsific,notas,tipo",
    [
        ("EXTENSÃO;VALIDADA", "", "extensao"),
        ("EXTENSÃOENG;VALIDADA", "", "extensao"),
        ("", "EXTENSÃO;VALIDADA", "extensao"),
        ("MELHORIA;VALIDADA", "EXTENSÃO", "melhoria"),  # Classsific tem prioridade
        ("SUBSTITUIÇÃO;VALIDADA", "", "substituicao"),
        ("REDE ENCONTRADA", "", "encontrada"),
        ("REDE DOADA", "", "doada"),
        ("", "VALIDADO", "existente"),
        (None, None, "existente"),
    ],
)
def test_tipo_obra(classsific, notas, tipo):
    assert L.tipo_obra(classsific, notas) == tipo


def test_zero_e_nao_informado():
    assert L.positivo("0") is None
    assert L.positivo("0.00000000000") is None
    assert L.positivo("60") == 60
    assert L.numero("1,5") == 1.5
    assert L.numero("1.234,5") == 1234.5


def test_data_cadastro():
    assert L.data("2023/08/15") == date(2023, 8, 15)
    assert L.data("15/08/2023") == date(2023, 8, 15)
    assert L.data("1692057600000") == date(2023, 8, 15)
    assert L.data("") is None


@pytest.mark.parametrize("d,faixa", [(None, 0), (60, 1), (75, 1), (76, 2), (150, 2), (151, 3)])
def test_faixa_diametro(d, faixa):
    assert L.faixa_diametro(d) == faixa


def test_municipio_caixa_alta():
    assert L.municipio("SAO FRANCISCO DE ITABAPOANA") == "Sao Francisco de Itabapoana"
    assert L.municipio("Rio Bonito") == "Rio Bonito"
