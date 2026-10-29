import { useRef, type KeyboardEvent } from 'react';
import { Select } from './Select';

interface Props<T extends string> {
  abas: readonly T[];
  rotulos: Record<T, string>;
  ativa: T;
  onChange: (aba: T) => void;
  idPainel: string;
}

/** Abas com navegação por setas (WAI-ARIA). No celular viram um seletor. */
export function Tabs<T extends string>({ abas, rotulos, ativa, onChange, idPainel }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const teclado = (e: KeyboardEvent, i: number) => {
    let novo = -1;
    if (e.key === 'ArrowRight') novo = (i + 1) % abas.length;
    else if (e.key === 'ArrowLeft') novo = (i - 1 + abas.length) % abas.length;
    else if (e.key === 'Home') novo = 0;
    else if (e.key === 'End') novo = abas.length - 1;
    if (novo >= 0) {
      e.preventDefault();
      const aba = abas[novo];
      if (aba) {
        onChange(aba);
        refs.current[novo]?.focus();
      }
    }
  };

  return (
    <>
      <div className="sm:hidden">
        <Select
          rotulo="Seção"
          ocultarRotulo
          value={ativa}
          onChange={(e) => onChange(e.target.value as T)}
          opcoes={abas.map((a) => ({ valor: a, texto: rotulos[a] }))}
        />
      </div>
      <div role="tablist" aria-label="Seções do painel" className="hidden gap-1 sm:flex">
        {abas.map((a, i) => {
          const sel = a === ativa;
          return (
            <button
              key={a}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`aba-${a}`}
              type="button"
              aria-selected={sel}
              aria-controls={idPainel}
              tabIndex={sel ? 0 : -1}
              onClick={() => onChange(a)}
              onKeyDown={(e) => teclado(e, i)}
              className={`-mb-px border-b-2 px-3 py-3 text-sm transition-colors ${
                sel
                  ? 'border-brand font-semibold text-text'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {rotulos[a]}
            </button>
          );
        })}
      </div>
    </>
  );
}
