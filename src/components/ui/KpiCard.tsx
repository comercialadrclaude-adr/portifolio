import type { ReactNode } from 'react';
import { InfoTip } from './Tooltip';

interface Props {
  rotulo: string;
  valor: ReactNode;
  unidade?: string;
  contexto?: ReactNode;
  definicao: string;
  /** Marca lateral com a cor do tipo de obra (identidade, nunca só cor). */
  marca?: string;
}

export function KpiCard({ rotulo, valor, unidade, contexto, definicao, marca }: Props) {
  return (
    <div className="flex min-w-0 flex-col rounded-md border border-border bg-surface p-5">
      <div className="flex items-center gap-1.5 text-sm text-muted">
        {marca && (
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: `var(${marca})` }}
          />
        )}
        <span className="truncate">{rotulo}</span>
        <InfoTip rotulo={rotulo}>{definicao}</InfoTip>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="tabular text-kpi font-semibold tracking-tight">{valor}</span>
        {unidade && <span className="text-base text-muted">{unidade}</span>}
      </div>
      {contexto && <p className="mt-1 text-xs text-muted">{contexto}</p>}
    </div>
  );
}
