// Uma cor por tipo de obra, igual em mapa, gráfico, legenda e pill (seção 7.1).

import type { TipoObra } from '@/types/data';

export type Grupo = 'existente' | 'extensao' | 'melhoria';

/** Substituição, rede encontrada e rede doada aparecem com a cor da rede existente. */
export function grupoDoTipo(tipo: TipoObra): Grupo {
  if (tipo === 'extensao') return 'extensao';
  if (tipo === 'melhoria') return 'melhoria';
  return 'existente';
}

export const VAR_GRUPO: Record<Grupo, string> = {
  existente: '--net-existing',
  extensao: '--net-extension',
  melhoria: '--net-improvement',
};

export const ROTULO_GRUPO: Record<Grupo, string> = {
  existente: 'Rede existente',
  extensao: 'Extensão',
  melhoria: 'Melhoria',
};

/** Classe de fundo tingido (pill) por grupo. */
export const TINT_GRUPO: Record<Grupo, string> = {
  existente: 'bg-tint-existing',
  extensao: 'bg-tint-extension',
  melhoria: 'bg-tint-improvement',
};

/** Lê o valor atual de um token (muda com o tema). */
export function token(nome: string): string {
  if (typeof window === 'undefined') return '#000000';
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || '#000000';
}
