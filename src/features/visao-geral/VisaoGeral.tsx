import { ComDados } from '@/app/ComDados';
import { useDados } from '@/app/data';
import { useApp } from '@/app/store';
import { useIndicadorAtual } from '@/app/useMunicipio';
import { Botao, Card, DataTable, EmptyState, KpiCard, Skeleton } from '@/components/ui';
import { fmtInt, fmtKm, fmtM, fmtMes, fmtNum, fmtPct } from '@/lib/format';
import { DEFINICOES, fraseResumo, LIMIAR_PREENCHIMENTO, picoMensal } from '@/lib/metrics';
import type { IndicadorMunicipio, Indicadores } from '@/types/data';
import { createColumnHelper } from '@tanstack/react-table';
import { X } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';

// ECharts é pesado: carrega depois da frase-resumo e dos KPIs.
const BarrasMensais = lazy(() =>
  import('@/components/charts/BarrasMensais').then((m) => ({ default: m.BarrasMensais })),
);

export default function VisaoGeral() {
  const ind = useDados<Indicadores>('indicadores.json');
  return <ComDados estado={ind}>{(dados) => <Conteudo ind={dados} />}</ComDados>;
}

function Conteudo({ ind }: { ind: Indicadores }) {
  const { atual, todos, nome } = useIndicadorAtual(ind);
  if (!atual)
    return (
      <EmptyState titulo={`Sem dados para "${nome}"`}>
        O município do link não aparece na base cadastral. Escolha outro no filtro acima.
      </EmptyState>
    );
  return (
    <div className="space-y-6">
      <Resumo ind={atual} todos={todos} />
      <Kpis ind={atual} />
      <GraficoMensal ind={atual} />
      <TabelaMunicipios ind={ind} />
    </div>
  );
}

function Resumo({ ind, todos }: { ind: IndicadorMunicipio; todos: boolean }) {
  return (
    <p className="max-w-4xl text-lg font-normal">
      {fraseResumo(ind, todos).map((p, i) =>
        p.destaque ? (
          <strong key={i} className="tabular font-semibold">
            {p.texto}
          </strong>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </p>
  );
}

function Kpis({ ind }: { ind: IndicadorMunicipio }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        rotulo="Rede cadastrada"
        valor={fmtNum(ind.rede_km)}
        unidade="km"
        contexto={`${fmtInt(ind.trechos)} trechos na base`}
        definicao={DEFINICOES.rede_km}
        marca="--net-existing"
      />
      <KpiCard
        rotulo="Extensões validadas"
        valor={fmtNum(ind.extensoes_km)}
        unidade="km"
        contexto={`${fmtInt(ind.extensoes_trechos)} trechos · ${fmtPct(ind.extensoes_pct)} da rede`}
        definicao={DEFINICOES.extensoes_km}
        marca="--net-extension"
      />
      <KpiCard
        rotulo="Melhorias validadas"
        valor={fmtNum(ind.melhorias_km)}
        unidade="km"
        contexto={`${fmtInt(ind.por_tipo.melhoria.trechos)} trechos`}
        definicao={DEFINICOES.melhorias_km}
        marca="--net-improvement"
      />
      <KpiCard
        rotulo="Completude cadastral"
        valor={fmtNum(ind.completude_pct)}
        unidade="%"
        contexto={`${fmtInt(ind.trechos_completos)} de ${fmtInt(ind.trechos)} com material e diâmetro`}
        definicao={DEFINICOES.completude_pct}
        marca={ind.completude_pct < LIMIAR_PREENCHIMENTO ? '--warn' : undefined}
      />
      <KpiCard
        rotulo="Projetos em carteira"
        valor={fmtInt(ind.projetos)}
        contexto={`${fmtM(ind.projetos_tracado_m)} de traçado proposto`}
        definicao={DEFINICOES.projetos}
        marca="--project"
      />
    </div>
  );
}

function GraficoMensal({ ind }: { ind: IndicadorMunicipio }) {
  const [tabela, setTabela] = useState(false);
  const pico = picoMensal(ind);
  const total = ind.mensal.reduce((s, m) => s + m.extensoes_km, 0);
  const rotulo = pico
    ? `Gráfico de barras: km de extensão por mês de cadastro no GIS. Maior volume em ${fmtMes(pico.mes)}, com ${fmtKm(pico.extensoes_km)}.`
    : 'Sem extensões com data de cadastro.';
  return (
    <Card
      id="grafico-mensal"
      titulo="Extensões por mês de cadastro"
      nota="A data é a de cadastro do trecho no GIS (CREATED_DA), não a data da obra."
      acoes={
        <Botao variante="fantasma" onClick={() => setTabela((v) => !v)} aria-expanded={tabela}>
          {tabela ? 'Ver gráfico' : 'Ver tabela'}
        </Botao>
      }
    >
      {total === 0 ? (
        <EmptyState titulo="Nenhuma extensão com data de cadastro neste filtro." />
      ) : tabela ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Extensões por mês de cadastro no GIS</caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="py-2 text-left font-medium">
                  Mês
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Extensões
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Trechos
                </th>
              </tr>
            </thead>
            <tbody>
              {ind.mensal
                .filter((m) => m.extensoes_trechos > 0)
                .map((m) => (
                  <tr key={m.mes} className="border-b border-border last:border-0">
                    <td className="py-1.5">{fmtMes(m.mes)}</td>
                    <td className="tabular py-1.5 text-right">{fmtKm(m.extensoes_km, 2)}</td>
                    <td className="tabular py-1.5 text-right">{fmtInt(m.extensoes_trechos)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <Suspense fallback={<Skeleton className="h-[280px]" />}>
            <BarrasMensais serie={ind.mensal} rotulo={rotulo} />
          </Suspense>
          <p className="mt-2 text-xs text-muted">
            {pico && (
              <>
                Maior volume em{' '}
                <strong className="font-medium text-text">{fmtMes(pico.mes)}</strong> (
                {fmtKm(pico.extensoes_km)}).{' '}
              </>
            )}
            {ind.extensoes_sem_data > 0 &&
              `${fmtInt(ind.extensoes_sem_data)} trechos de extensão sem data de cadastro não aparecem no gráfico.`}
          </p>
        </>
      )}
    </Card>
  );
}

const col = createColumnHelper<IndicadorMunicipio>();

function TabelaMunicipios({ ind }: { ind: Indicadores }) {
  const municipio = useApp((s) => s.municipio);
  const setMunicipio = useApp((s) => s.setMunicipio);
  const maxExt = Math.max(...ind.municipios.map((m) => m.extensoes_km), 0.001);

  const colunas = useMemo(
    () => [
      col.accessor('nome', {
        header: 'Município',
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      col.accessor('rede_km', {
        header: 'Rede (km)',
        cell: (c) => fmtNum(c.getValue()),
        meta: { numerica: true },
      }),
      col.accessor('extensoes_km', {
        header: 'Extensões (km)',
        meta: { numerica: true },
        cell: (c) => (
          <div className="flex items-center justify-end gap-2">
            <span
              className="hidden h-2 w-24 overflow-hidden rounded-sm bg-surface-2 sm:block"
              aria-hidden
            >
              <span
                className="block h-full rounded-sm"
                style={{
                  width: `${(c.getValue() / maxExt) * 100}%`,
                  background: 'var(--net-extension)',
                }}
              />
            </span>
            <span className="w-12">{fmtNum(c.getValue())}</span>
          </div>
        ),
      }),
      col.accessor('extensoes_pct', {
        header: '% da rede',
        cell: (c) => fmtPct(c.getValue()),
        meta: { numerica: true, esconderNoCelular: true },
      }),
      col.accessor('melhorias_km', {
        header: 'Melhorias (km)',
        cell: (c) => fmtNum(c.getValue()),
        meta: { numerica: true, esconderNoCelular: true },
      }),
      col.accessor('completude_pct', {
        header: 'Completude (%)',
        meta: { numerica: true },
        cell: (c) => {
          const v = c.getValue();
          return (
            <span className="inline-flex items-center gap-1.5">
              {v < LIMIAR_PREENCHIMENTO && (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--warn)' }}
                />
              )}
              {fmtNum(v)}
              {v < LIMIAR_PREENCHIMENTO && <span className="sr-only"> (abaixo de 50%)</span>}
            </span>
          );
        },
      }),
    ],
    [maxExt],
  );

  return (
    <Card
      id="tabela-municipios"
      titulo="Comparativo por município"
      nota="Clique numa linha para filtrar o painel por município."
      acoes={
        municipio && (
          <Botao
            variante="fantasma"
            icone={<X size={14} aria-hidden />}
            onClick={() => setMunicipio(null)}
          >
            Limpar filtro
          </Botao>
        )
      }
    >
      <DataTable
        dados={ind.municipios}
        colunas={colunas}
        legenda="Indicadores por município"
        getRowId={(m) => m.nome}
        selecionada={municipio}
        aoClicar={(m) => setMunicipio(m.nome === municipio ? null : m.nome)}
        rotuloLinha={(m) => `Filtrar por ${m.nome}`}
        ordenacaoInicial={[{ id: 'rede_km', desc: true }]}
      />
    </Card>
  );
}
