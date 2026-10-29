import type { ReactNode } from 'react';

export type Tom =
  | 'neutro'
  | 'extensao'
  | 'melhoria'
  | 'existente'
  | 'projeto'
  | 'zeis'
  | 'ok'
  | 'warn'
  | 'bad'
  | 'brand';

const FUNDO: Record<Tom, string> = {
  neutro: 'bg-surface-2',
  extensao: 'bg-tint-extension',
  melhoria: 'bg-tint-improvement',
  existente: 'bg-tint-existing',
  projeto: 'bg-tint-project',
  zeis: 'bg-tint-zeis',
  ok: 'bg-tint-ok',
  warn: 'bg-tint-warn',
  bad: 'bg-tint-bad',
  brand: 'bg-tint-brand',
};

const MARCA: Record<Tom, string | null> = {
  neutro: null,
  extensao: '--net-extension',
  melhoria: '--net-improvement',
  existente: '--net-existing',
  projeto: '--project',
  zeis: '--zeis',
  ok: '--ok',
  warn: '--warn',
  bad: '--bad',
  brand: '--brand',
};

/** Texto sempre na cor de texto; a cor do tipo vai no fundo e no marcador. */
export function Pill({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  const marca = MARCA[tom];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium text-text ${FUNDO[tom]}`}
    >
      {marca && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: `var(${marca})` }}
        />
      )}
      {children}
    </span>
  );
}
