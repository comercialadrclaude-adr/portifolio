import { token } from '@/lib/colors';
import { fmtInt, fmtKm, fmtMes, fmtNum } from '@/lib/format';
import type { Mensal } from '@/types/data';
import { useCallback } from 'react';
import { EChart, type OpcoesGrafico } from './EChart';

interface Props {
  serie: Mensal[];
  rotulo: string;
}

/** km de extensão por mês de cadastro no GIS. Barra ≤ 32 px, raio 2 px, grade de 1 px. */
export function BarrasMensais({ serie, rotulo }: Props) {
  const opcoes = useCallback(
    (): OpcoesGrafico => {
      const texto = token('--text');
      const muted = token('--text-muted');
      const borda = token('--border');
      const superficie = token('--surface');
      return {
        animationDuration: 200,
        grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow', shadowStyle: { color: borda, opacity: 0.35 } },
          backgroundColor: superficie,
          borderColor: borda,
          borderWidth: 1,
          padding: [8, 10],
          textStyle: { color: texto, fontFamily: 'IBM Plex Sans', fontSize: 12 },
          extraCssText: 'box-shadow: 0 4px 16px rgb(0 0 0 / 0.12); border-radius: 8px;',
          formatter: (params) => {
            const p = (Array.isArray(params) ? params[0] : params) as { dataIndex: number };
            const m = serie[p.dataIndex];
            if (!m) return '';
            return `<div style="font-weight:600;margin-bottom:2px">${fmtMes(m.mes)}</div>
              <div>${fmtKm(m.extensoes_km, 2)} · ${fmtInt(m.extensoes_trechos)} trechos</div>`;
          },
        },
        xAxis: {
          type: 'category',
          data: serie.map((m) => fmtMes(m.mes)),
          axisLine: { lineStyle: { color: borda } },
          axisTick: { show: false },
          axisLabel: { color: muted, fontSize: 12, fontFamily: 'IBM Plex Sans', hideOverlap: true },
        },
        yAxis: {
          type: 'value',
          name: 'km',
          nameTextStyle: { color: muted, fontSize: 12, align: 'left' },
          axisLine: { show: false },
          splitLine: { lineStyle: { color: borda, width: 1 } },
          axisLabel: {
            color: muted,
            fontSize: 12,
            fontFamily: 'IBM Plex Sans',
            formatter: (v: number) => fmtNum(v, Number.isInteger(v) ? 0 : 1),
          },
        },
        series: [
          {
            type: 'bar',
            name: 'Extensões',
            data: serie.map((m) => m.extensoes_km),
            barMaxWidth: 32,
            itemStyle: { color: token('--net-extension'), borderRadius: [2, 2, 0, 0] },
            emphasis: { itemStyle: { color: token('--net-extension'), opacity: 0.85 } },
          },
        ],
      };
    },
    // As cores vêm dos tokens: o EChart chama de novo quando o tema muda.
    [serie],
  );

  return <EChart opcoes={opcoes} rotulo={rotulo} />;
}
