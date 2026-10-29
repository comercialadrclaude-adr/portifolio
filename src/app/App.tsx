import { SkeletonPagina, Tabs } from '@/components/ui';
import type { Manifest } from '@/types/data';
import { AlertTriangle } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { Cabecalho } from './Cabecalho';
import { useDados } from './data';
import { ABAS, ROTULO_ABA, sincronizarUrl, useApp } from './store';

import VisaoGeral from '@/features/visao-geral/VisaoGeral';

// Carregamento sob demanda por aba (seção 9): o mapa só baixa MapLibre e a rede quando aberto.
// A visão geral é a aba inicial e vem no pacote principal.
const Carteira = lazy(() => import('@/features/carteira/Carteira'));
const Mapa = lazy(() => import('@/features/mapa/Mapa'));
const Qualidade = lazy(() => import('@/features/qualidade/Qualidade'));

const PAINEL = 'painel-aba';

export function App() {
  const aba = useApp((s) => s.aba);
  const setAba = useApp((s) => s.setAba);
  const manifest = useDados<Manifest>('manifest.json');

  useEffect(() => sincronizarUrl(), []);
  useEffect(() => {
    document.title = `${ROTULO_ABA[aba]} · Painel de Extensões de Rede R4`;
  }, [aba]);

  return (
    <div className="min-h-screen bg-bg">
      <a
        href={`#${PAINEL}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <Cabecalho />
      <nav className="border-b border-border bg-surface" aria-label="Seções">
        <div className="mx-auto max-w-page px-4 py-2 sm:py-0 md:px-8">
          <Tabs abas={ABAS} rotulos={ROTULO_ABA} ativa={aba} onChange={setAba} idPainel={PAINEL} />
        </div>
      </nav>
      {manifest.status === 'ok' && manifest.dados.sintetico && (
        <div role="note" className="bg-tint-warn">
          <p className="mx-auto flex max-w-page items-center gap-2 px-4 py-2 text-xs md:px-8">
            <AlertTriangle size={14} aria-hidden style={{ color: 'var(--warn)' }} />
            Dados sintéticos de teste. Os números não representam a rede real.
          </p>
        </div>
      )}
      <main className="mx-auto max-w-page px-4 py-6 md:px-8 md:py-8">
        <div id={PAINEL} role="tabpanel" aria-labelledby={`aba-${aba}`} tabIndex={-1}>
          <Suspense fallback={<SkeletonPagina />}>
            {aba === 'visao-geral' && <VisaoGeral />}
            {aba === 'carteira' && <Carteira />}
            {aba === 'mapa' && <Mapa />}
            {aba === 'qualidade' && <Qualidade />}
          </Suspense>
        </div>
      </main>
      <footer className="mx-auto max-w-page px-4 pb-8 text-xs text-muted md:px-8">
        {manifest.status === 'ok' && (
          <p>
            Fonte: base cadastral exportada do GIS e projetos do Google Earth · pipeline v
            {manifest.dados.versao_pipeline} · {manifest.dados.contagens.fontes as number} arquivos
            {manifest.dados.modo === 'agregado' && ' · publicação somente de agregados'}
          </p>
        )}
      </footer>
    </div>
  );
}
