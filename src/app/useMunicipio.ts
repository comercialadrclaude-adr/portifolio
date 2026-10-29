import type { IndicadorMunicipio, Indicadores } from '@/types/data';
import { useApp } from './store';

/** Indicador do município filtrado (ou de todos). `null` = município sem dados. */
export function useIndicadorAtual(ind: Indicadores): {
  atual: IndicadorMunicipio | null;
  todos: boolean;
  nome: string | null;
} {
  const municipio = useApp((s) => s.municipio);
  if (!municipio) return { atual: ind.todos, todos: true, nome: null };
  return {
    atual: ind.municipios.find((m) => m.nome === municipio) ?? null,
    todos: false,
    nome: municipio,
  };
}
