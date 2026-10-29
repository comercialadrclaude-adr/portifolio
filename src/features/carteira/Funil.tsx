import { fmtInt } from '@/lib/format';
import type { Projeto } from '@/types/data';

/** Mini-funil: quantos projetos há em cada etapa padronizada. */
export function Funil({ etapas, projetos }: { etapas: string[]; projetos: Projeto[] }) {
  const max = Math.max(1, ...etapas.map((e) => projetos.filter((p) => p.etapa === e).length));
  return (
    <ol
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
      aria-label="Projetos por etapa"
    >
      {etapas.map((e, i) => {
        const n = projetos.filter((p) => p.etapa === e).length;
        return (
          <li key={e} className="rounded border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted">
                {i + 1}. {e}
              </span>
            </div>
            <div className="tabular mt-1 text-lg font-semibold">{fmtInt(n)}</div>
            <div className="mt-2 h-1 rounded-sm bg-surface-2" aria-hidden>
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${(n / max) * 100}%`,
                  background: 'var(--brand)',
                  opacity: n ? 1 : 0,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
