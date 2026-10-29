import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string;
  ocultarRotulo?: boolean;
  opcoes: { valor: string; texto: string }[];
}

export function Select({ rotulo, ocultarRotulo, opcoes, id, className = '', ...resto }: Props) {
  const sid = id ?? `sel-${rotulo.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <label htmlFor={sid} className={ocultarRotulo ? 'sr-only' : 'text-xs'}>
        {rotulo}
      </label>
      <div className="relative min-w-0 flex-1">
        <select
          id={sid}
          className="h-9 w-full min-w-0 appearance-none rounded border border-border bg-surface pl-3 pr-8 text-sm text-text"
          {...resto}
        >
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );
}
