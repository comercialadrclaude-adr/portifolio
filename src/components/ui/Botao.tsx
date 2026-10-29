import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icone?: ReactNode;
  variante?: 'secundario' | 'primario' | 'fantasma';
}

export function Botao({
  icone,
  variante = 'secundario',
  className = '',
  children,
  ...resto
}: Props) {
  const estilo =
    variante === 'primario'
      ? 'bg-brand text-on-brand border-brand hover:opacity-90'
      : variante === 'fantasma'
        ? 'border-transparent text-text hover:bg-surface-2'
        : 'border-border bg-surface text-text hover:bg-surface-2';
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center gap-1.5 rounded border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${estilo} ${className}`}
      {...resto}
    >
      {icone}
      {children}
    </button>
  );
}
