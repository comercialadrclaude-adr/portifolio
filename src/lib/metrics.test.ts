// Confere as fórmulas de metrics.ts e, quando há dados gerados, cruza com o pipeline.
// DATA_DIR aponta para a saída do pipeline (padrão: public/data).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Indicadores, Manifest, Trecho } from '@/types/data';
import { calcularIndicadores, fraseResumo } from './metrics';

const t = (p: Partial<Trecho>): Trecho => ({
  id: 'T1',
  globalid: null,
  municipio: 'A',
  bairro: null,
  tipo: 'existente',
  extensao_m: 100,
  comprimento_m: 100,
  diametro_mm: null,
  material: null,
  material_codigo: null,
  pavimento: null,
  funcao: null,
  profundidade_m: null,
  situacao: null,
  cadastro: null,
  ...p,
});

describe('métricas', () => {
  it('calcula rede, extensões, melhorias e completude', () => {
    const r = calcularIndicadores([
      t({ extensao_m: 1000, tipo: 'extensao', material: 'PVC', diametro_mm: 60 }),
      t({ extensao_m: 3000, tipo: 'melhoria', material: 'PVC' }), // sem diâmetro: incompleto
      t({ extensao_m: null }),
      t({ extensao_m: 1000, material: 'PEAD', diametro_mm: 50 }),
    ]);
    expect(r.rede_km).toBe(5);
    expect(r.extensoes_km).toBe(1);
    expect(r.extensoes_pct).toBe(20);
    expect(r.melhorias_km).toBe(3);
    expect(r.completude_pct).toBe(50);
  });

  it('monta a frase-resumo com números em destaque', () => {
    const ind = {
      nome: 'Rio Bonito',
      rede_km: 1234.5,
      extensoes_km: 12.3,
      extensoes_pct: 1.0,
      completude_pct: 61,
    };
    const partes = fraseResumo(ind as never, false);
    expect(partes.map((p) => p.texto).join('')).toBe(
      'Rio Bonito: 1.234,5 km de rede cadastrada, dos quais 12,3 km são extensões validadas (1,0%). 61% dos trechos têm material e diâmetro informados.',
    );
    expect(partes.filter((p) => p.destaque)).toHaveLength(4);
  });
});

const dir = resolve(process.env.DATA_DIR ?? 'public/data');
const temDados = existsSync(resolve(dir, 'indicadores.json'));
const ler = <T>(n: string): T => JSON.parse(readFileSync(resolve(dir, n), 'utf-8')) as T;

describe.skipIf(!temDados)(`dados gerados em ${dir}`, () => {
  it('front e pipeline usam a mesma fórmula', () => {
    if (!existsSync(resolve(dir, 'trechos.json'))) return; // modo agregado
    const ind = ler<Indicadores>('indicadores.json').todos;
    const r = calcularIndicadores(ler<Trecho[]>('trechos.json'));
    expect(r.trechos).toBe(ind.trechos);
    expect(r.rede_km).toBeCloseTo(ind.rede_km, 2);
    expect(r.extensoes_km).toBeCloseTo(ind.extensoes_km, 2);
    expect(r.melhorias_km).toBeCloseTo(ind.melhorias_km, 2);
    expect(r.completude_pct).toBeCloseTo(ind.completude_pct, 1);
  });

  it('valores de referência da seção 4 (dados reais)', () => {
    if (ler<Manifest>('manifest.json').sintetico) return;
    const ind = ler<Indicadores>('indicadores.json');
    expect(ind.todos.trechos).toBe(5480);
    expect(ind.todos.rede_km).toBeCloseTo(1198.2, 1);
    expect(ind.todos.extensoes_km).toBeCloseTo(63.0, 1);
    expect(ind.todos.extensoes_trechos).toBe(453);
    expect(ind.todos.melhorias_km).toBeCloseTo(297.5, 1);
    expect(ind.todos.completude_pct).toBeCloseTo(54.3, 1);
    expect(ind.municipios[0]).toMatchObject({ nome: 'São Francisco de Itabapoana', trechos: 896 });
  });
});
