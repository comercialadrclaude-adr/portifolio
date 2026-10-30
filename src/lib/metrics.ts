// Fonte única das definições de métricas (seção 8). Os textos são os mesmos de
// docs/DICIONARIO_DADOS.md. O pipeline calcula; o front só exibe. As funções de
// cálculo abaixo existem para conferir o pipeline nos testes (Vitest).

import type { IndicadorMunicipio, Trecho } from '@/types/data';
import { fmtKm, fmtMes, fmtPct } from './format';

export const DEFINICOES = {
  rede_km: 'Soma do campo EXTENSAO de todos os trechos cadastrados, em km.',
  extensoes_km:
    'Soma de EXTENSAO dos trechos classificados como Extensão (campo Classsific ou, se vazio, NOTAS).',
  extensoes_pct: 'Extensões validadas (km) ÷ rede cadastrada (km) × 100.',
  melhorias_km: 'Soma de EXTENSAO dos trechos classificados como Melhoria.',
  completude_pct:
    'Trechos com material e diâmetro (> 0) informados ÷ total de trechos. Diâmetro 0 conta como não informado.',
  projetos:
    'Propostas desenhadas no Google Earth fora da base cadastral. Metros = comprimento geodésico do traçado.',
  distancia_rede:
    'Menor distância (m) entre o ponto de interligação (ou a primeira feição) e qualquer trecho cadastrado.',
  distancia_zeis: 'Menor distância (m) entre o projeto e um polígono de ZEIS; 0 = dentro.',
  rede_interna_zeis: 'Comprimento dos trechos recortados pelo polígono da ZEIS.',
  densidade_zeis: 'Rede interna (m) ÷ área da ZEIS (ha).',
  data_cadastro: 'CREATED_DA: data em que o trecho foi cadastrado no GIS. Não é a data da obra.',
} as const;

export type ChaveDefinicao = keyof typeof DEFINICOES;

/** Recalcula os indicadores a partir dos trechos (mesmas fórmulas do pipeline). */
export function calcularIndicadores(trechos: Trecho[]) {
  const km = (lista: Trecho[]) => lista.reduce((s, t) => s + (t.extensao_m ?? 0), 0) / 1000;
  const rede_km = km(trechos);
  const ext = trechos.filter((t) => t.tipo === 'extensao');
  const extensoes_km = km(ext);
  const completos = trechos.filter((t) => t.material && t.diametro_mm).length;
  return {
    trechos: trechos.length,
    rede_km,
    extensoes_km,
    extensoes_trechos: ext.length,
    extensoes_pct: rede_km ? (extensoes_km / rede_km) * 100 : 0,
    melhorias_km: km(trechos.filter((t) => t.tipo === 'melhoria')),
    completude_pct: trechos.length ? (completos / trechos.length) * 100 : 0,
  };
}

export interface ParteFrase {
  texto: string;
  destaque?: boolean;
}

/** Frase-resumo da visão geral, com os números marcados para negrito. */
export function fraseResumo(ind: IndicadorMunicipio, todos: boolean): ParteFrase[] {
  const sujeito = todos ? 'A Regional R4 – Interior tem' : `${ind.nome}:`;
  const partes: ParteFrase[] = [
    { texto: `${sujeito} ` },
    { texto: fmtKm(ind.rede_km), destaque: true },
    { texto: ' de rede cadastrada, dos quais ' },
    { texto: fmtKm(ind.extensoes_km), destaque: true },
    { texto: ' são extensões validadas (' },
    { texto: fmtPct(ind.extensoes_pct), destaque: true },
    { texto: '). ' },
    { texto: fmtPct(ind.completude_pct, 0), destaque: true },
    { texto: ' dos trechos têm material e diâmetro informados.' },
  ];
  return partes;
}

/** Mês com mais km de extensão (para o resumo em texto do gráfico). */
export function picoMensal(ind: IndicadorMunicipio) {
  return ind.mensal.reduce<IndicadorMunicipio['mensal'][number] | null>(
    (pico, m) => (m.extensoes_km > (pico?.extensoes_km ?? 0) ? m : pico),
    null,
  );
}

/** Limiar de alerta para preenchimento de atributos (seção 6.4). */
export const LIMIAR_PREENCHIMENTO = 50;

export type Granularidade = 'mes' | 'trimestre' | 'acumulado';

export interface PontoSerie {
  chave: string;
  rotulo: string;
  km: number;
  trechos: number;
}

/**
 * Série de extensões para o gráfico. Começa no primeiro mês com extensão e termina no
 * último (o pipeline cobre o período de toda a base, o que deixava meses vazios no início).
 */
export function serieExtensoes(
  mensal: IndicadorMunicipio['mensal'],
  g: Granularidade,
): PontoSerie[] {
  const ini = mensal.findIndex((m) => m.extensoes_trechos > 0);
  if (ini < 0) return [];
  let fim = mensal.length - 1;
  while (fim > ini && (mensal[fim]?.extensoes_trechos ?? 0) === 0) fim--;
  const meses = mensal.slice(ini, fim + 1);

  if (g === 'trimestre') {
    const porTri = new Map<string, PontoSerie>();
    for (const m of meses) {
      const [a, mm] = m.mes.split('-');
      const t = Math.floor((Number(mm) - 1) / 3) + 1;
      const chave = `${a}-T${t}`;
      const p = porTri.get(chave) ?? { chave, rotulo: `T${t}/${a}`, km: 0, trechos: 0 };
      p.km += m.extensoes_km;
      p.trechos += m.extensoes_trechos;
      porTri.set(chave, p);
    }
    return [...porTri.values()];
  }

  let acumKm = 0;
  let acumN = 0;
  return meses.map((m) => {
    acumKm += m.extensoes_km;
    acumN += m.extensoes_trechos;
    return {
      chave: m.mes,
      rotulo: fmtMes(m.mes),
      km: g === 'acumulado' ? acumKm : m.extensoes_km,
      trechos: g === 'acumulado' ? acumN : m.extensoes_trechos,
    };
  });
}
