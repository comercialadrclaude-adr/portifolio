import { useEffect, useState } from 'react';

export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';
export type Tema = 'light' | 'dark';

function lerPreferencia(): PreferenciaTema {
  try {
    const v = localStorage.getItem('tema');
    return v === 'claro' || v === 'escuro' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function resolver(p: PreferenciaTema): Tema {
  if (p === 'sistema') return media().matches ? 'dark' : 'light';
  return p === 'escuro' ? 'dark' : 'light';
}

/** Tema atual (light/dark) e alternância manual. Segue o sistema até o usuário escolher. */
export function useTema() {
  const [pref, setPref] = useState<PreferenciaTema>(lerPreferencia);
  const [tema, setTema] = useState<Tema>(() => resolver(lerPreferencia()));

  useEffect(() => {
    const aplicar = () => {
      const t = resolver(pref);
      document.documentElement.setAttribute('data-theme', t);
      setTema(t);
    };
    aplicar();
    const m = media();
    m.addEventListener('change', aplicar);
    return () => m.removeEventListener('change', aplicar);
  }, [pref]);

  const alternar = () => {
    const novo: PreferenciaTema = tema === 'dark' ? 'claro' : 'escuro';
    try {
      localStorage.setItem('tema', novo);
    } catch {
      /* navegação privada: tema vale só nesta sessão */
    }
    setPref(novo);
  };

  return { tema, pref, alternar };
}

/** Tema atual lido do <html>, para componentes que não controlam o tema. */
export function useTemaAtual(): Tema {
  const [tema, setTema] = useState<Tema>(
    () => (document.documentElement.getAttribute('data-theme') as Tema) || 'light',
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setTema((document.documentElement.getAttribute('data-theme') as Tema) || 'light'),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return tema;
}
