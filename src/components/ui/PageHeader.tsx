import { useApp } from '@/app/store';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
}

/** Título da aba (24 px) + descrição + filtro ativo. Dá hierarquia a cada página. */
export function PageHeader({ titulo, descricao, acoes }: Props) {
  const municipio = useApp((s) => s.municipio);
  const setMunicipio = useApp((s) => s.setMunicipio);
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-4xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
          {municipio && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface py-0.5 pl-2.5 pr-1 text-xs">
              <span className="text-muted">Município:</span>
              <span className="font-medium">{municipio}</span>
              <button
                type="button"
                onClick={() => setMunicipio(null)}
                aria-label={`Remover filtro de ${municipio}`}
                className="rounded-full p-0.5 text-muted hover:bg-surface-2 hover:text-text"
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          )}
        </div>
        {descricao && <div className="mt-1 text-sm text-muted">{descricao}</div>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}
