import { describe, expect, it } from 'vitest';
import { calcularPrioridade, PESOS } from './priority';

const base = {
  distancia_rede_m: null,
  distancia_zeis_m: null,
  ligacoes_previstas: null,
  custo_por_metro_brl: null,
};

describe('índice de prioridade', () => {
  it('não inventa valor sem nenhum critério', () => {
    const p = calcularPrioridade(base);
    expect(p.indice).toBeNull();
    expect(p.pesoUsado).toBe(0);
  });

  it('usa só os critérios com dado e renormaliza os pesos', () => {
    const p = calcularPrioridade({ ...base, distancia_rede_m: 0, distancia_zeis_m: 2000 });
    // proximidade = 1 (peso 35), zeis = 0 (peso 25) → 35/60
    expect(p.indice).toBe(Math.round((35 / 60) * 100));
    expect(p.pesoUsado).toBe(PESOS.proximidadeRede + PESOS.zeis);
  });

  it('vai a 100 com todos os critérios no máximo', () => {
    const p = calcularPrioridade({
      distancia_rede_m: 0,
      distancia_zeis_m: 0,
      ligacoes_previstas: 500,
      custo_por_metro_brl: 100,
    });
    expect(p.indice).toBe(100);
    expect(p.pesoUsado).toBe(p.pesoTotal);
  });

  it('limita as notas entre 0 e 1', () => {
    const p = calcularPrioridade({ ...base, distancia_rede_m: 99999, custo_por_metro_brl: 5000 });
    expect(p.parcelas.every((x) => x.nota == null || (x.nota >= 0 && x.nota <= 1))).toBe(true);
    expect(p.indice).toBe(0);
  });
});
