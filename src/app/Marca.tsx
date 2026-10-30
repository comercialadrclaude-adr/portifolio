/** Marca do produto: traçado de rede com ponto de extensão. */
export function Marca({ tamanho = 36 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 36 36" aria-hidden className="shrink-0">
      <rect width="36" height="36" rx="10" fill="var(--net-extension)" />
      <path
        d="M9 24h7.5l4.5-12h6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="27" cy="12" r="2.6" fill="#ffffff" />
    </svg>
  );
}
