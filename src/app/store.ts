// Estado global + sincronização com a URL (?aba=mapa&municipio=Rio%20Bonito&projeto=P1).
// Um link compartilhado abre no mesmo filtro.

import { create } from 'zustand';

export const ABAS = ['visao-geral', 'carteira', 'mapa', 'qualidade'] as const;
export type Aba = (typeof ABAS)[number];

export const ROTULO_ABA: Record<Aba, string> = {
  'visao-geral': 'Visão geral',
  carteira: 'Carteira de projetos',
  mapa: 'Mapa',
  qualidade: 'Qualidade do cadastro',
};

export const CAMADAS = ['existente', 'extensao', 'melhoria', 'projetos', 'zeis', 'relevo'] as const;
export type Camada = (typeof CAMADAS)[number];
export const CAMADAS_PADRAO: Camada[] = ['existente', 'extensao', 'melhoria', 'projetos', 'zeis'];

export interface EstadoUrl {
  aba: Aba;
  municipio: string | null;
  projeto: string | null;
  camadas: Camada[];
}

interface Estado extends EstadoUrl {
  /** Incrementa para pedir ao mapa que reenquadre (projeto/município). */
  enquadrar: number;
  setAba: (aba: Aba) => void;
  setMunicipio: (m: string | null) => void;
  setProjeto: (id: string | null) => void;
  abrirNoMapa: (id: string) => void;
  alternarCamada: (c: Camada) => void;
  pedirEnquadramento: () => void;
  aplicarUrl: (e: EstadoUrl) => void;
}

export function lerUrl(search: string): EstadoUrl {
  const q = new URLSearchParams(search);
  const aba = q.get('aba');
  const camadas = q.get('camadas');
  return {
    aba: (ABAS as readonly string[]).includes(aba ?? '') ? (aba as Aba) : 'visao-geral',
    municipio: q.get('municipio') || null,
    projeto: q.get('projeto') || null,
    camadas:
      camadas == null
        ? [...CAMADAS_PADRAO]
        : (camadas
            .split(',')
            .filter((c) => (CAMADAS as readonly string[]).includes(c)) as Camada[]),
  };
}

export function escreverUrl(e: EstadoUrl): string {
  const q = new URLSearchParams();
  if (e.aba !== 'visao-geral') q.set('aba', e.aba);
  if (e.municipio) q.set('municipio', e.municipio);
  if (e.projeto) q.set('projeto', e.projeto);
  const padrao = [...CAMADAS_PADRAO].sort().join(',');
  const atual = [...e.camadas].sort().join(',');
  if (atual !== padrao) q.set('camadas', atual);
  const s = q.toString().replace(/\+/g, '%20');
  return s ? `?${s}` : '';
}

const inicial = typeof window !== 'undefined' ? lerUrl(window.location.search) : lerUrl('');

export const useApp = create<Estado>((set) => ({
  ...inicial,
  enquadrar: 0,
  setAba: (aba) => set({ aba }),
  // Trocar de município fecha o projeto aberto e reenquadra o mapa.
  setMunicipio: (municipio) =>
    set((s) => ({ municipio, projeto: null, enquadrar: s.enquadrar + 1 })),
  setProjeto: (projeto) => set({ projeto }),
  abrirNoMapa: (id) => set((s) => ({ projeto: id, aba: 'mapa', enquadrar: s.enquadrar + 1 })),
  alternarCamada: (c) =>
    set((s) => ({
      camadas: s.camadas.includes(c) ? s.camadas.filter((x) => x !== c) : [...s.camadas, c],
    })),
  pedirEnquadramento: () => set((s) => ({ enquadrar: s.enquadrar + 1 })),
  aplicarUrl: (e) => set((s) => ({ ...e, enquadrar: s.enquadrar + 1 })),
}));

/** Liga a store à barra de endereço. Troca de aba entra no histórico; filtros não. */
export function sincronizarUrl(): () => void {
  let anterior = useApp.getState();
  const cancelar = useApp.subscribe((s) => {
    const url = escreverUrl(s);
    if (url !== window.location.search) {
      const href = `${window.location.pathname}${url}${window.location.hash}`;
      if (s.aba !== anterior.aba) window.history.pushState(null, '', href);
      else window.history.replaceState(null, '', href);
    }
    anterior = s;
  });
  const voltar = () => useApp.getState().aplicarUrl(lerUrl(window.location.search));
  window.addEventListener('popstate', voltar);
  return () => {
    cancelar();
    window.removeEventListener('popstate', voltar);
  };
}
