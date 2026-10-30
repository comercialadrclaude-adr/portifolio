import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

function Linha({
  cor,
  largura = 2.5,
  tracejada,
}: {
  cor: string;
  largura?: number;
  tracejada?: boolean;
}) {
  return (
    <svg width="28" height="10" aria-hidden className="shrink-0">
      <line
        x1="2"
        y1="5"
        x2="26"
        y2="5"
        stroke={`var(${cor})`}
        strokeWidth={largura}
        strokeLinecap="round"
        strokeDasharray={tracejada ? '5 4' : undefined}
      />
    </svg>
  );
}

/** Legenda fixa no canto. Nunca só cor: tracejado = proposta; espessura = diâmetro. */
export function Legenda({ comRede = true }: { comRede?: boolean }) {
  const [aberta, setAberta] = useState(true);
  return (
    <div className="pointer-events-auto rounded-lg border border-border bg-surface text-xs shadow-lg">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-6 px-3 py-2 font-medium"
      >
        Legenda
        <ChevronDown
          size={14}
          aria-hidden
          className={`transition-transform ${aberta ? '' : '-rotate-90'}`}
        />
      </button>
      {aberta && (
        <ul className="space-y-1.5 border-t border-border px-3 py-2">
          {comRede && (
            <>
              <li className="flex items-center gap-2">
                <Linha cor="--net-existing" />
                Rede existente
              </li>
              <li className="flex items-center gap-2">
                <Linha cor="--net-extension" />
                Extensão
              </li>
              <li className="flex items-center gap-2">
                <Linha cor="--net-improvement" />
                Melhoria
              </li>
            </>
          )}
          <li className="flex items-center gap-2">
            <Linha cor="--project" largura={3} tracejada />
            Projeto proposto
          </li>
          <li className="flex items-center gap-2">
            <svg width="28" height="12" aria-hidden className="shrink-0">
              <circle
                cx="14"
                cy="6"
                r="4.5"
                fill="var(--surface)"
                stroke="var(--project)"
                strokeWidth="2"
              />
            </svg>
            Ponto de interligação
          </li>
          <li className="flex items-center gap-2">
            <svg width="28" height="12" aria-hidden className="shrink-0">
              <rect
                x="4"
                y="1"
                width="20"
                height="10"
                rx="2"
                fill="color-mix(in srgb, var(--zeis) 20%, transparent)"
                stroke="var(--zeis)"
                strokeWidth="1.5"
              />
            </svg>
            ZEIS
          </li>
          {comRede && (
            <>
              <li className="pt-1 text-muted">Espessura por diâmetro</li>
              <li className="flex items-center gap-2">
                <Linha cor="--text-muted" largura={1.4} />
                até 75 mm
              </li>
              <li className="flex items-center gap-2">
                <Linha cor="--text-muted" largura={2.4} />
                76 a 150 mm
              </li>
              <li className="flex items-center gap-2">
                <Linha cor="--text-muted" largura={3.6} />
                acima de 150 mm
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}
