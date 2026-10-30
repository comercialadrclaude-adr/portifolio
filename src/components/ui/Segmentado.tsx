import { useRef, type KeyboardEvent } from 'react';

interface Props<T extends string> {
  rotulo: string;
  opcoes: { valor: T; texto: string }[];
  valor: T;
  onChange: (v: T) => void;
}

/** Controle segmentado (radiogroup) para alternar visões de um mesmo card. */
export function Segmentado<T extends string>({ rotulo, opcoes, valor, onChange }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const teclado = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + opcoes.length) % opcoes.length;
    const o = opcoes[n];
    if (o) {
      onChange(o.valor);
      refs.current[n]?.focus();
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      className="inline-flex rounded-md border border-border bg-surface-2 p-0.5"
    >
      {opcoes.map((o, i) => {
        const sel = o.valor === valor;
        return (
          <button
            key={o.valor}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel ? 0 : -1}
            onClick={() => onChange(o.valor)}
            onKeyDown={(e) => teclado(e, i)}
            className={`h-7 rounded px-2.5 text-xs font-medium transition-colors ${
              sel ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            {o.texto}
          </button>
        );
      })}
    </div>
  );
}
