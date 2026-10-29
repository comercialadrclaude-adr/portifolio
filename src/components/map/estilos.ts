import type { StyleSpecification } from 'maplibre-gl';

// Mapa base neutro (Carto Positron / Dark Matter), sem chave de API.
export const ESTILO_BASE = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
} as const;

/** Usado se o mapa base não carregar (rede offline, bloqueio): as camadas do painel continuam. */
export function estiloVazio(fundo: string): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': fundo } }],
  };
}
