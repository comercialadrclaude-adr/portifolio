import { ChevronDown, MapPin } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string;
  ocultarRotulo?: boolean;
  opcoes: { valor: string; texto: string }[];
  /** Variante para o cabeçalho escuro. */
  variante?: 'padrao' | 'cabecalho';
  icone?: boolean;
}

export function Select({
  rotulo,
  ocultarRotulo,
  opcoes,
  id,
  className = '',
  variante = 'padrao',
  icone = false,
  ...resto
}: Props) {
  const sid = id ?? `sel-${rotulo.replace(/\W+/g, '-').toLowerCase()}`;
  const cabecalho = variante === 'cabecalho';
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <label htmlFor={sid} className={ocultarRotulo ? 'sr-only' : 'text-xs'}>
        {rotulo}
      </label>
      <div className="relative min-w-0 flex-1">
        {icone && (
          <MapPin
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: cabecalho ? 'var(--header-muted)' : 'var(--text-muted)' }}
          />
        )}
        <select
          id={sid}
          className={`h-9 w-full min-w-0 cursor-pointer appearance-none rounded-md border pr-8 text-sm ${
            icone ? 'pl-8' : 'pl-3'
          } ${cabecalho ? 'select-cabecalho' : 'border-border bg-surface text-text'}`}
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
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
          style={{ color: cabecalho ? 'var(--header-muted)' : 'var(--text-muted)' }}
        />
      </div>
    </div>
  );
}
