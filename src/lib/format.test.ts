import { describe, expect, it } from 'vitest';
import {
  A_PREENCHER,
  fmtBRL,
  fmtData,
  fmtDistancia,
  fmtKm,
  fmtMes,
  fmtNum,
  fmtPct,
  ouAPreencher,
  SEM_DADO,
} from './format';

describe('format pt-BR', () => {
  it('usa ponto de milhar e vírgula decimal', () => {
    expect(fmtNum(1198.216)).toBe('1.198,2');
    expect(fmtKm(63.0)).toBe('63,0 km');
    expect(fmtPct(5.26)).toBe('5,3%');
  });

  it('formata datas como dd/mm/aaaa sem fuso', () => {
    expect(fmtData('2026-10-29')).toBe('29/10/2026');
    expect(fmtData('2025-01-01T00:00:00+00:00')).toBe('01/01/2025');
    expect(fmtData(null)).toBe(SEM_DADO);
  });

  it('abrevia meses em minúsculas', () => {
    expect(fmtMes('2024-03')).toBe('mar/2024');
    expect(fmtMes('2023-12')).toBe('dez/2023');
  });

  it('escolhe m ou km para distâncias', () => {
    expect(fmtDistancia(140)).toBe('140 m');
    expect(fmtDistancia(9142.2)).toBe('9,1 km');
    expect(fmtDistancia(null)).toBe(SEM_DADO);
  });

  it('mostra "a preencher" quando o campo não existe nos dados', () => {
    expect(ouAPreencher(null)).toBe(A_PREENCHER);
    expect(ouAPreencher('')).toBe(A_PREENCHER);
    expect(ouAPreencher(12, (x) => `${x} lig.`)).toBe('12 lig.');
  });

  it('formata moeda', () => {
    expect(fmtBRL(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
  });
});
