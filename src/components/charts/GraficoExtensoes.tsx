import { token } from '@/lib/colors';
import { fmtInt, fmtKm, fmtNum } from '@/lib/format';
import type { Granularidade, PontoSerie } from '@/lib/metrics';
import { useCallback } from 'react';
import { EChart, type OpcoesGrafico } from './EChart';

interface Props {
  pontos: PontoSerie[];
  granularidade: Granularidade;
  rotulo: string;
}

/** Extensões por período de cadastro no GIS. Barras (mês/trimestre) ou área (acumulado). */
export function GraficoExtensoes({ pontos, granularidade, rotulo }: Props) {
  const opcoes = useCallback((): OpcoesGrafico => {
    const texto = token('--text');
    const muted = token('--text-muted');
    const borda = token('--border');
    const superficie = token('--surface');
    const cor = token('--net-extension');
    const acumulado = granularidade === 'acumulado';
    const iPico = pontos.reduce((im, p, i, arr) => (p.km > (arr[im]?.km ?? 0) ? i : im), 0);

    const eixoTexto = { color: muted, fontSize: 12, fontFamily: 'IBM Plex Sans' };
    return {
      animationDuration: 200,
      grid: { left: 4, right: 12, top: 28, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: acumulado
          ? { type: 'line', lineStyle: { color: borda } }
          : { type: 'shadow', shadowStyle: { color: borda, opacity: 0.35 } },
        backgroundColor: superficie,
        borderColor: borda,
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: texto, fontFamily: 'IBM Plex Sans', fontSize: 12 },
        extraCssText: 'box-shadow: 0 4px 16px rgb(0 0 0 / 0.12); border-radius: 8px;',
        formatter: (params) => {
          const p = (Array.isArray(params) ? params[0] : params) as { dataIndex: number };
          const ponto = pontos[p.dataIndex];
          if (!ponto) return '';
          const sufixo = acumulado ? ' acumulados' : '';
          return `<div style="font-weight:600;margin-bottom:2px">${ponto.rotulo}</div>
            <div>${fmtKm(ponto.km, 2)}${sufixo} · ${fmtInt(ponto.trechos)} trechos</div>`;
        },
      },
      xAxis: {
        type: 'category',
        data: pontos.map((p) => p.rotulo),
        boundaryGap: !acumulado,
        axisLine: { lineStyle: { color: borda } },
        axisTick: { show: false },
        axisLabel: { ...eixoTexto, hideOverlap: true, margin: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'km',
        nameTextStyle: { ...eixoTexto, align: 'right', padding: [0, 6, 0, 0] },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: borda, width: 1 } },
        axisLabel: {
          ...eixoTexto,
          formatter: (v: number) => fmtNum(v, Number.isInteger(v) ? 0 : 1),
        },
      },
      series: acumulado
        ? [
            {
              type: 'line',
              name: 'Extensões acumuladas',
              data: pontos.map((p) => p.km),
              smooth: false,
              symbol: 'circle',
              symbolSize: 6,
              showSymbol: false,
              lineStyle: { color: cor, width: 2 },
              itemStyle: { color: cor, borderColor: superficie, borderWidth: 2 },
              areaStyle: { color: cor, opacity: 0.12 },
              endLabel: {
                show: true,
                formatter: () => fmtKm(pontos[pontos.length - 1]?.km ?? 0),
                color: texto,
                fontFamily: 'IBM Plex Sans',
                fontSize: 12,
                fontWeight: 600,
              },
            },
          ]
        : [
            {
              type: 'bar',
              name: 'Extensões',
              barMaxWidth: 32,
              barCategoryGap: '30%',
              data: pontos.map((p, i) => ({
                value: p.km,
                // Rótulo seletivo: só o pico leva número sobre a barra.
                label:
                  i === iPico && p.km > 0
                    ? {
                        show: true,
                        position: 'top',
                        formatter: () => fmtKm(p.km),
                        color: texto,
                        fontFamily: 'IBM Plex Sans',
                        fontSize: 12,
                        fontWeight: 600,
                      }
                    : undefined,
              })),
              itemStyle: { color: cor, borderRadius: [2, 2, 0, 0] },
              emphasis: { itemStyle: { color: cor, opacity: 0.85 } },
            },
          ],
    };
  }, [pontos, granularidade]);

  return <EChart opcoes={opcoes} rotulo={rotulo} altura={300} />;
}
