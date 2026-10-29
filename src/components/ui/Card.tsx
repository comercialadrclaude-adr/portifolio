import type { ReactNode } from 'react';

interface Props {
  titulo?: ReactNode;
  nota?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** Título + nota de uma linha + conteúdo. Sem sombra (seção 7.3). */
export function Card({ titulo, nota, acoes, children, className = '', id }: Props) {
  return (
    <section
      id={id}
      aria-labelledby={id && titulo ? `${id}-titulo` : undefined}
      className={`rounded-md border border-border bg-surface p-5 md:p-6 ${className}`}
    >
      {(titulo || acoes) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {titulo && (
              <h2 id={id ? `${id}-titulo` : undefined} className="text-base font-semibold">
                {titulo}
              </h2>
            )}
            {nota && <p className="mt-0.5 text-xs text-muted">{nota}</p>}
          </div>
          {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
