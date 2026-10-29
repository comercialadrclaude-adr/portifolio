import type { Bbox } from '@/types/data';

const R = 6_371_008.8;

/** Distância geodésica aproximada (haversine), em metros. */
export function haversine(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function comprimento(pontos: [number, number][]): number {
  let s = 0;
  for (let i = 1; i < pontos.length; i++) s += haversine(pontos[i - 1]!, pontos[i]!);
  return s;
}

export function bboxValido(b: Bbox | null | undefined): b is Bbox {
  return !!b && b.every(Number.isFinite) && b[0] <= b[2] && b[1] <= b[3];
}
