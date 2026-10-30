import { fmtInt } from '@/lib/format';
import type { Projeto } from '@/types/data';

/** Etapas padronizadas como um fluxo contínuo, com quantos projetos há em cada uma. */
export function Funil({ etapas, projetos }: { etapas: string[]; projetos: Projeto[] }) {
  return (
    <ol
      className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-7"
      aria-label="Projetos por etapa"
    >
      {etapas.map((e, i) => {
        const n = projetos.filter((p) => p.etapa === e).length;
        return (
          <li key={e} className="min-w-0">
            <div
              aria-hidden
              className="h-1 rounded-full"
              style={{ background: n ? 'var(--brand)' : 'var(--surface-2)' }}
            />
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className={`tabular text-lg font-semibold ${n ? '' : 'text-muted'}`}>
                {fmtInt(n)}
              </span>
              <span className="sr-only">{n === 1 ? 'projeto em' : 'projetos em'}</span>
            </div>
            <p className={`text-xs ${n ? 'text-text' : 'text-muted'}`}>
              <span className="text-muted">{i + 1}.</span> {e}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
