// Índice de prioridade (0–100) dos projetos. Ajuste os pesos e as referências aqui.
//
// Cada critério vira uma nota de 0 a 1. O índice é a média ponderada só dos
// critérios que têm dado; os que estão "a preencher" ficam de fora e o painel
// mostra quantos entraram no cálculo (cobertura). Nunca se inventa valor.

import type { Projeto } from '@/types/data';

export const PESOS = {
  proximidadeRede: 35,
  zeis: 25,
  ligacoes: 25,
  custoPorMetro: 15,
} as const;

export const REFERENCIAS = {
  /** A partir desta distância (m) da rede, a nota de proximidade é 0. */
  distanciaRedeMaxM: 1000,
  /** Dentro da ZEIS = 1; a partir desta distância (m), 0. */
  distanciaZeisMaxM: 2000,
  /** Nº de ligações que dá nota máxima. */
  ligacoesMax: 200,
  /** Faixa de custo por metro (R$/m): mínimo → nota 1, máximo → nota 0. */
  custoPorMetroMin: 150,
  custoPorMetroMax: 800,
} as const;

export type Criterio = keyof typeof PESOS;

export const ROTULO_CRITERIO: Record<Criterio, string> = {
  proximidadeRede: 'Proximidade da rede',
  zeis: 'Dentro ou perto de ZEIS',
  ligacoes: 'Ligações previstas',
  custoPorMetro: 'Custo por metro',
};

export interface ParcelaPrioridade {
  criterio: Criterio;
  peso: number;
  nota: number | null; // 0–1, null = sem dado
  detalhe: string;
}

export interface Prioridade {
  indice: number | null;
  parcelas: ParcelaPrioridade[];
  pesoUsado: number;
  pesoTotal: number;
}

const limitar = (v: number) => Math.min(1, Math.max(0, v));

export function notaDistancia(dist: number | null, max: number): number | null {
  if (dist == null) return null;
  return limitar(1 - dist / max);
}

export function calcularPrioridade(
  p: Pick<
    Projeto,
    'distancia_rede_m' | 'distancia_zeis_m' | 'ligacoes_previstas' | 'custo_por_metro_brl'
  >,
  pesos: Record<Criterio, number> = PESOS,
  ref = REFERENCIAS,
): Prioridade {
  const custoNota =
    p.custo_por_metro_brl == null
      ? null
      : limitar(
          1 -
            (p.custo_por_metro_brl - ref.custoPorMetroMin) /
              (ref.custoPorMetroMax - ref.custoPorMetroMin),
        );
  const parcelas: ParcelaPrioridade[] = [
    {
      criterio: 'proximidadeRede',
      peso: pesos.proximidadeRede,
      nota: notaDistancia(p.distancia_rede_m, ref.distanciaRedeMaxM),
      detalhe: `0 m = 1; ${ref.distanciaRedeMaxM} m ou mais = 0`,
    },
    {
      criterio: 'zeis',
      peso: pesos.zeis,
      nota: notaDistancia(p.distancia_zeis_m, ref.distanciaZeisMaxM),
      detalhe: `dentro = 1; ${ref.distanciaZeisMaxM} m ou mais = 0`,
    },
    {
      criterio: 'ligacoes',
      peso: pesos.ligacoes,
      nota: p.ligacoes_previstas == null ? null : limitar(p.ligacoes_previstas / ref.ligacoesMax),
      detalhe: `${ref.ligacoesMax} ligações ou mais = 1`,
    },
    {
      criterio: 'custoPorMetro',
      peso: pesos.custoPorMetro,
      nota: custoNota,
      detalhe: `R$ ${ref.custoPorMetroMin}/m = 1; R$ ${ref.custoPorMetroMax}/m = 0`,
    },
  ];
  const comDado = parcelas.filter((x) => x.nota != null);
  const pesoUsado = comDado.reduce((s, x) => s + x.peso, 0);
  const pesoTotal = parcelas.reduce((s, x) => s + x.peso, 0);
  const indice = pesoUsado
    ? Math.round((comDado.reduce((s, x) => s + x.peso * (x.nota ?? 0), 0) / pesoUsado) * 100)
    : null;
  return { indice, parcelas, pesoUsado, pesoTotal };
}
