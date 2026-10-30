import type { ReactNode } from 'react';
import { InfoTip } from './Tooltip';

interface Props {
  rotulo: string;
  valor: ReactNode;
  unidade?: string;
  contexto?: ReactNode;
  definicao: string;
  /** Marca com a cor do tipo de obra (identidade, nunca só cor). */
  marca?: string;
  /** Medidor ou link no pé do card. */
  rodape?: ReactNode;
}

export function KpiCard({ rotulo, valor, unidade, contexto, definicao, marca, rodape }: Props) {
  return (
    <div className="flex min-w-0 flex-col rounded-md border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-sm text-muted">
        {marca && (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: `var(${marca})` }}
          />
        )}
        <span className="truncate font-medium">{rotulo}</span>
        <span className="ml-auto">
          <InfoTip rotulo={rotulo}>{definicao}</InfoTip>
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="tabular text-kpi font-semibold tracking-tight">{valor}</span>
        {unidade && <span className="text-base font-medium text-muted">{unidade}</span>}
      </div>
      {contexto && <p className="mt-1 text-xs text-muted">{contexto}</p>}
      {rodape && <div className="mt-auto pt-4">{rodape}</div>}
    </div>
  );
}
