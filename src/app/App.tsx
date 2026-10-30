import { Gaveta, SkeletonPagina } from '@/components/ui';
import type { Manifest } from '@/types/data';
import { AlertTriangle } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BarraSuperior } from './BarraSuperior';
import { useDados } from './data';
import { MenuLateral } from './MenuLateral';
import { ROTULO_ABA, sincronizarUrl, useApp } from './store';

import VisaoGeral from '@/features/visao-geral/VisaoGeral';

// Carregamento sob demanda por aba (seção 9): o mapa só baixa MapLibre e a rede quando aberto.
// A visão geral é a aba inicial e vem no pacote principal.
const Carteira = lazy(() => import('@/features/carteira/Carteira'));
const Mapa = lazy(() => import('@/features/mapa/Mapa'));
const Qualidade = lazy(() => import('@/features/qualidade/Qualidade'));

const PAINEL = 'conteudo';

export function App() {
  const aba = useApp((s) => s.aba);
  const manifest = useDados<Manifest>('manifest.json');
  const [menuAberto, setMenuAberto] = useState(false);
  const fecharMenu = useCallback(() => setMenuAberto(false), []);

  useEffect(() => sincronizarUrl(), []);
  useEffect(() => {
    document.title = `${ROTULO_ABA[aba]} · Painel de Extensões de Rede R4`;
  }, [aba]);

  return (
    <div className="min-h-screen bg-bg lg:pl-64">
      <a
        href={`#${PAINEL}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>

      {/* Menu lateral fixo no desktop; no celular abre por cima do conteúdo. */}
      <div className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <MenuLateral />
      </div>
      <Gaveta
        aberta={menuAberto}
        onFechar={fecharMenu}
        rotulo="Menu"
        lado="esquerda"
        largura="max-w-[288px]"
      >
        <MenuLateral aoNavegar={fecharMenu} />
      </Gaveta>

      <BarraSuperior aoAbrirMenu={() => setMenuAberto(true)} />

      {manifest.status === 'ok' && manifest.dados.sintetico && (
        <div role="note" className="bg-tint-warn">
          <p className="mx-auto flex max-w-page items-center gap-2 px-4 py-2 text-xs md:px-8">
            <AlertTriangle size={14} aria-hidden style={{ color: 'var(--warn)' }} />
            Dados sintéticos de teste. Os números não representam a rede real.
          </p>
        </div>
      )}

      <main
        id={PAINEL}
        tabIndex={-1}
        className="mx-auto max-w-page px-4 pb-12 pt-6 outline-none md:px-8 md:pt-8"
      >
        <Suspense fallback={<SkeletonPagina />}>
          {aba === 'visao-geral' && <VisaoGeral />}
          {aba === 'carteira' && <Carteira />}
          {aba === 'mapa' && <Mapa />}
          {aba === 'qualidade' && <Qualidade />}
        </Suspense>
      </main>

      <footer className="mx-auto max-w-page px-4 pb-6 md:px-8">
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-border pt-5 text-xs text-muted">
          <p>Regional R4 – Interior (RJ) · Expansão de rede de água</p>
          {manifest.status === 'ok' && (
            <p>
              Fonte: base cadastral do GIS e projetos do Google Earth · pipeline v
              {manifest.dados.versao_pipeline}
              {manifest.dados.modo === 'agregado' && ' · publicação somente de agregados'}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
