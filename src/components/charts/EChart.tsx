import { useTemaAtual } from '@/app/theme';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { init, use as registrar, type ComposeOption, type ECharts } from 'echarts/core';
import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts';
import type { GridComponentOption, TooltipComponentOption } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

registrar([BarChart, LineChart, GridComponent, TooltipComponent, SVGRenderer]);

export type OpcoesGrafico = ComposeOption<
  BarSeriesOption | LineSeriesOption | GridComponentOption | TooltipComponentOption
>;

interface Props {
  /** Recebe o tema para que as cores sejam relidas dos tokens a cada troca. */
  opcoes: (tema: 'light' | 'dark') => OpcoesGrafico;
  altura?: number;
  rotulo: string;
}

/** Wrapper fino do ECharts (única biblioteca de gráficos do projeto). */
export function EChart({ opcoes, altura = 280, rotulo }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const grafico = useRef<ECharts | null>(null);
  const tema = useTemaAtual();

  useEffect(() => {
    if (!ref.current) return;
    const g = init(ref.current, undefined, { renderer: 'svg' });
    grafico.current = g;
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      g.dispose();
      grafico.current = null;
    };
  }, []);

  useEffect(() => {
    grafico.current?.setOption(opcoes(tema), { notMerge: true });
  }, [opcoes, tema]);

  return <div ref={ref} role="img" aria-label={rotulo} style={{ height: altura, width: '100%' }} />;
}
