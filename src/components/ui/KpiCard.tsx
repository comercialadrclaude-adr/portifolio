import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { InfoTip } from './Tooltip';

interface Props {
  rotulo: string;
  valor: ReactNode;
  unidade?: string;
  contexto?: ReactNode;
  definicao: string;
  /** Token da cor do indicador (ex.: '--net-extension'), usado no chip do ícone. */
  marca?: string;
  icone?: LucideIcon;
  /** Medidor ou link no pé do card. */
  rodape?: ReactNode;
}

export function KpiCard({
  rotulo,
  valor,
  unidade,
  contexto,
  definicao,
  marca = '--brand',
  icone: Icone,
  rodape,
}: Props) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-surface p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-2">
        {Icone ? (
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: `color-mix(in srgb, var(${marca}) 14%, transparent)`,
              color: `var(${marca})`,
            }}
          >
            <Icone size={18} strokeWidth={2} />
          </span>
        ) : (
          <span />
        )}
        <InfoTip rotulo={rotulo}>{definicao}</InfoTip>
      </div>
      <p className="mt-3 text-sm font-medium text-muted">{rotulo}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="tabular text-kpi font-semibold tracking-tight">{valor}</span>
        {unidade && <span className="text-base font-medium text-muted">{unidade}</span>}
      </div>
      {contexto && <p className="mt-1 text-xs text-muted">{contexto}</p>}
      {rodape && <div className="mt-auto pt-4">{rodape}</div>}
    </div>
  );
}
