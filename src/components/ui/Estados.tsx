import { AlertTriangle, Inbox, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

export function SkeletonPagina() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Carregando dados…</span>
      <Skeleton className="h-6 w-2/3" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function EmptyState({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-10 text-center">
      <Inbox size={20} aria-hidden className="text-muted" />
      <p className="mt-2 text-sm font-medium">{titulo}</p>
      {children && <div className="mt-1 max-w-md text-xs text-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, detalhe }: { onRetry: () => void; detalhe?: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-md border border-border bg-surface px-6 py-10 text-center"
    >
      <AlertTriangle size={20} aria-hidden style={{ color: 'var(--bad)' }} />
      <p className="mt-2 text-sm font-medium">Falha ao carregar</p>
      {detalhe && <p className="mt-1 text-xs text-muted">{detalhe}</p>}
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
      >
        <RotateCcw size={14} aria-hidden /> Tentar de novo
      </button>
    </div>
  );
}
