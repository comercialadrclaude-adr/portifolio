// Formatação pt-BR centralizada (seção 9). Nenhum componente formata número por conta própria.

export const A_PREENCHER = 'a preencher';
export const SEM_DADO = '–';

const cache = new Map<string, Intl.NumberFormat>();
function nf(casas: number): Intl.NumberFormat {
  const k = String(casas);
  let f = cache.get(k);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });
    cache.set(k, f);
  }
  return f;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Num = number | null | undefined;

export function fmtNum(v: Num, casas = 1): string {
  return v == null || Number.isNaN(v) ? SEM_DADO : nf(casas).format(v);
}

export const fmtInt = (v: Num) => fmtNum(v, 0);
export const fmtKm = (v: Num, casas = 1) => (v == null ? SEM_DADO : `${fmtNum(v, casas)} km`);
export const fmtM = (v: Num) => (v == null ? SEM_DADO : `${fmtInt(v)} m`);
export const fmtHa = (v: Num) => (v == null ? SEM_DADO : `${fmtNum(v, 1)} ha`);
export const fmtMm = (v: Num) => (v == null ? SEM_DADO : `${fmtInt(v)} mm`);
export const fmtPct = (v: Num, casas = 1) => (v == null ? SEM_DADO : `${fmtNum(v, casas)}%`);
export const fmtBRL = (v: Num) => (v == null ? SEM_DADO : brl.format(v));

/** Metros abaixo de 1 km, quilômetros acima. */
export function fmtDistancia(v: Num): string {
  if (v == null) return SEM_DADO;
  return v < 1000 ? fmtM(v) : fmtKm(v / 1000, 1);
}

/** ISO (aaaa-mm-dd ou data-hora) → dd/mm/aaaa, sem passar por fuso horário. */
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return SEM_DADO;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : SEM_DADO;
}

/** ISO com hora → "dd/mm/aaaa às hh:mm" no fuso do navegador. */
export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return SEM_DADO;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return SEM_DADO;
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} às ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

export const MESES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** "2024-03" → "mar/2024". */
export function fmtMes(mes: string): string {
  const [a, m] = mes.split('-');
  const i = Number(m) - 1;
  return MESES[i] ? `${MESES[i]}/${a}` : mes;
}

/** Valor ou "a preencher" para campos da ficha que ainda não existem nos dados. */
export function ouAPreencher(v: string | number | null | undefined, fmt?: (x: number) => string) {
  if (v == null || v === '') return A_PREENCHER;
  return typeof v === 'number' && fmt ? fmt(v) : String(v);
}
