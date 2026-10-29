import { EmptyState, ErrorState, SkeletonPagina } from '@/components/ui';
import type { ReactNode } from 'react';
import type { Estado } from './data';

interface Props<T> {
  estado: Estado<T> & { tentarDeNovo: () => void };
  children: (dados: T) => ReactNode;
  carregando?: ReactNode;
  ausente?: ReactNode;
}

/** Renderiza skeleton, erro, "não publicado" ou o conteúdo. */
export function ComDados<T>({ estado, children, carregando, ausente }: Props<T>) {
  if (estado.status === 'carregando') return <>{carregando ?? <SkeletonPagina />}</>;
  if (estado.status === 'erro')
    return <ErrorState onRetry={estado.tentarDeNovo} detalhe={estado.erro.message} />;
  if (estado.status === 'ausente')
    return (
      <>
        {ausente ?? (
          <EmptyState titulo="Dados ainda não publicados">
            Rode <code className="font-mono">python scripts/build_dataset.py</code> e publique a
            pasta <code className="font-mono">public/data/</code>.
          </EmptyState>
        )}
      </>
    );
  return <>{children(estado.dados)}</>;
}
