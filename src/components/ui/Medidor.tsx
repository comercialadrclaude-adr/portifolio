interface Segmento {
  valor: number;
  cor: string; // token, ex.: '--net-extension'
  rotulo: string;
}

interface Props {
  segmentos: Segmento[];
  total: number;
  /** Marca de referência (ex.: 50% de completude), na mesma escala de `total`. */
  marca?: number;
  rotulo: string;
}

/** Barra fina horizontal (simples ou empilhada). Texto alternativo em aria-label. */
export function Medidor({ segmentos, total, marca, rotulo }: Props) {
  return (
    <div className="relative" role="img" aria-label={rotulo}>
      <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-surface-2">
        {segmentos.map((s) =>
          s.valor > 0 ? (
            <span
              key={s.rotulo}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${Math.max((s.valor / total) * 100, 0.6)}%`,
                background: `var(${s.cor})`,
              }}
            />
          ) : null,
        )}
      </div>
      {marca != null && (
        <span
          aria-hidden
          className="absolute -top-1 h-3.5 w-px bg-text opacity-50"
          style={{ left: `${(marca / total) * 100}%` }}
        />
      )}
    </div>
  );
}
