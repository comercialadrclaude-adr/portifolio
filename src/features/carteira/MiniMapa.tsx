import { fmtM } from '@/lib/format';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

interface Props {
  projetos: FeatureCollection<Geometry, { projeto: string; papel: string }>;
  id: string;
}

const L = 280;
const A = 180;
const M = 16;

/** Desenho do projeto em SVG (sem mapa base) com barra de escala. */
export function MiniMapa({ projetos, id }: Props) {
  const feats = projetos.features.filter((f) => f.properties.projeto === id);
  const pts: Position[] = [];
  const coletar = (g: Geometry) => {
    if (g.type === 'Point') pts.push(g.coordinates);
    else if (g.type === 'LineString' || g.type === 'MultiPoint') pts.push(...g.coordinates);
    else if (g.type === 'Polygon' || g.type === 'MultiLineString')
      g.coordinates.forEach((r) => pts.push(...r));
    else if (g.type === 'MultiPolygon')
      g.coordinates.forEach((p) => p.forEach((r) => pts.push(...r)));
  };
  feats.forEach((f) => coletar(f.geometry));
  if (!pts.length) return null;

  const lats = pts.map((p) => p[1] ?? 0);
  const lons = pts.map((p) => p[0] ?? 0);
  const latC = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((latC * Math.PI) / 180);
  const mPorGrau = 111_195;
  const x0 = Math.min(...lons) * k;
  const y1 = Math.max(...lats);
  const largM = Math.max((Math.max(...lons) - Math.min(...lons)) * k * mPorGrau, 20);
  const altM = Math.max((y1 - Math.min(...lats)) * mPorGrau, 20);
  const esc = Math.min((L - 2 * M) / largM, (A - 2 * M) / altM); // px por metro
  const offX = (L - largM * esc) / 2;
  const offY = (A - altM * esc) / 2;
  const xy = (p: Position) =>
    [
      offX + ((p[0] ?? 0) * k - x0) * mPorGrau * esc,
      offY + (y1 - (p[1] ?? 0)) * mPorGrau * esc,
    ] as const;
  const caminho = (anel: Position[], fechar = false) =>
    anel.map((p, i) => `${i ? 'L' : 'M'}${xy(p).join(',')}`).join('') + (fechar ? 'Z' : '');

  // Barra de escala "redonda" (~1/4 da largura).
  const alvo = L / 4 / esc;
  const passo = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((v) => v >= alvo) ?? 5000;

  const desenhar = (f: Feature<Geometry, { papel: string }>, i: number) => {
    const g = f.geometry;
    if (g.type === 'Polygon')
      return (
        <path
          key={i}
          d={g.coordinates.map((r) => caminho(r, true)).join('')}
          style={{
            fill: 'color-mix(in srgb, var(--project) 18%, transparent)',
            stroke: 'var(--project)',
          }}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      );
    if (g.type === 'LineString')
      return (
        <path
          key={i}
          d={caminho(g.coordinates)}
          fill="none"
          stroke="var(--project)"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          strokeLinecap="round"
        />
      );
    if (g.type === 'Point') {
      const [x, y] = xy(g.coordinates);
      const inter = f.properties.papel === 'interligacao';
      return (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={inter ? 5 : 3.5}
          fill={inter ? 'var(--surface)' : 'var(--project)'}
          stroke="var(--project)"
          strokeWidth={2}
        />
      );
    }
    return null;
  };

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="w-full rounded border border-border bg-surface-2"
        role="img"
        aria-label={`Desenho do projeto ${id}: traçados tracejados, áreas e pontos marcados no Google Earth.`}
      >
        {feats.map(desenhar)}
        <g transform={`translate(${M},${A - 12})`}>
          <line x1={0} x2={passo * esc} y1={0} y2={0} stroke="var(--text-muted)" strokeWidth={2} />
          <text x={passo * esc + 6} y={4} fontSize={11} fill="var(--text-muted)">
            {fmtM(passo)}
          </text>
        </g>
      </svg>
      <figcaption className="mt-1 text-xs text-muted">
        Círculo vazado = ponto de interligação.
      </figcaption>
    </figure>
  );
}
