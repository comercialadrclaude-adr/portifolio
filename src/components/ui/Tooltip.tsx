import { Info } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface Props {
  rotulo: string;
  children: ReactNode;
}

/** Ícone "i" com a definição da métrica. Abre com hover, foco ou toque; fecha com Esc. */
export function InfoTip({ rotulo, children }: Props) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
    >
      <button
        type="button"
        aria-label={`Definição: ${rotulo}`}
        aria-describedby={aberto ? id : undefined}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted hover:text-text"
      >
        <Info size={14} aria-hidden />
      </button>
      {aberto && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-6 z-30 w-64 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-xs font-normal text-text shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
