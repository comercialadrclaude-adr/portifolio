import { ComDados } from '@/app/ComDados';
import { useDados } from '@/app/data';
import { useApp } from '@/app/store';
import { useIndicadorAtual } from '@/app/useMunicipio';
import {
  Botao,
  Card,
  DataTable,
  EmptyState,
  KpiCard,
  Medidor,
  PageHeader,
  Segmentado,
  Skeleton,
} from '@/components/ui';
import { grupoDoTipo, VAR_GRUPO } from '@/lib/colors';
import { fmtInt, fmtKm, fmtM, fmtNum, fmtPct } from '@/lib/format';
import {
  DEFINICOES,
  fraseResumo,
  LIMIAR_PREENCHIMENTO,
  serieExtensoes,
  type Granularidade,
} from '@/lib/metrics';
import type { IndicadorMunicipio, Indicadores, TipoObra } from '@/types/data';
import { createColumnHelper } from '@tanstack/react-table';
import {
  ArrowRight,
  ClipboardCheck,
  FolderKanban,
  Network,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';

// ECharts é pesado: carrega depois da frase-resumo e dos KPIs.
const GraficoExtensoes = lazy(() =>
  import('@/components/charts/GraficoExtensoes').then((m) => ({ default: m.GraficoExtensoes })),
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
      <PageHeader titulo="Visão geral" descricao={<Resumo ind={atual} todos={todos} />} />
      <Kpis ind={atual} />
      <div className="grid gap-6 lg:grid-cols-3">
        <GraficoPeriodo ind={atual} />
        <ComposicaoRede ind={atual} rotulos={ind.rotulos_tipo} />
      </div>
      <TabelaMunicipios ind={ind} />
    </div>
  );
}

function Resumo({ ind, todos }: { ind: IndicadorMunicipio; todos: boolean }) {
  return (
    <p className="mt-1 max-w-3xl text-base text-text">
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

function LinkAba({ aba, children }: { aba: 'carteira' | 'mapa'; children: string }) {
  const setAba = useApp((s) => s.setAba);
  return (
    <button
      type="button"
      onClick={() => setAba(aba)}
      className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
    >
      {children}
      <ArrowRight size={12} aria-hidden />
    </button>
  );
}

function RodapePct({
  valor,
  total,
  cor,
  texto,
  marca,
}: {
  valor: number;
  total: number;
  cor: string;
  texto: string;
  marca?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Medidor
        segmentos={[{ valor, cor, rotulo: texto }]}
        total={total}
        marca={marca}
        rotulo={texto}
      />
      <p className="text-xs text-muted">{texto}</p>
    </div>
  );
}

function Kpis({ ind }: { ind: IndicadorMunicipio }) {
  const melhoriasPct = ind.rede_km ? (ind.melhorias_km / ind.rede_km) * 100 : 0;
  const alerta = ind.completude_pct < LIMIAR_PREENCHIMENTO;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        rotulo="Rede cadastrada"
        valor={fmtNum(ind.rede_km)}
        unidade="km"
        contexto={`${fmtInt(ind.trechos)} trechos na base`}
        definicao={DEFINICOES.rede_km}
        marca="--brand"
        icone={Network}
        rodape={<LinkAba aba="mapa">Ver no mapa</LinkAba>}
      />
      <KpiCard
        rotulo="Extensões validadas"
        valor={fmtNum(ind.extensoes_km)}
        unidade="km"
        contexto={`${fmtInt(ind.extensoes_trechos)} trechos`}
        definicao={DEFINICOES.extensoes_km}
        marca="--net-extension"
        icone={TrendingUp}
        rodape={
          <RodapePct
            valor={ind.extensoes_pct}
            total={100}
            cor="--net-extension"
            texto={`${fmtPct(ind.extensoes_pct)} da rede cadastrada`}
          />
        }
      />
      <KpiCard
        rotulo="Melhorias validadas"
        valor={fmtNum(ind.melhorias_km)}
        unidade="km"
        contexto={`${fmtInt(ind.por_tipo.melhoria.trechos)} trechos`}
        definicao={DEFINICOES.melhorias_km}
        marca="--net-improvement"
        icone={Wrench}
        rodape={
          <RodapePct
            valor={melhoriasPct}
            total={100}
            cor="--net-improvement"
            texto={`${fmtPct(melhoriasPct)} da rede cadastrada`}
          />
        }
      />
      <KpiCard
        rotulo="Completude cadastral"
        valor={fmtNum(ind.completude_pct)}
        unidade="%"
        contexto={`${fmtInt(ind.trechos_completos)} de ${fmtInt(ind.trechos)} trechos`}
        definicao={DEFINICOES.completude_pct}
        marca={alerta ? '--warn' : '--ok'}
        icone={ClipboardCheck}
        rodape={
          <RodapePct
            valor={ind.completude_pct}
            total={100}
            cor={alerta ? '--warn' : '--ok'}
            marca={LIMIAR_PREENCHIMENTO}
            texto={
              alerta
                ? `Abaixo do mínimo de ${LIMIAR_PREENCHIMENTO}%`
                : `Acima do mínimo de ${LIMIAR_PREENCHIMENTO}%`
            }
          />
        }
      />
      <KpiCard
        rotulo="Projetos em carteira"
        valor={fmtInt(ind.projetos)}
        contexto={`${fmtM(ind.projetos_tracado_m)} de traçado proposto`}
        definicao={DEFINICOES.projetos}
        marca="--project"
        icone={FolderKanban}
        rodape={<LinkAba aba="carteira">Ver carteira</LinkAba>}
      />
    </div>
  );
}

const ROTULO_GRANULARIDADE: { valor: Granularidade; texto: string }[] = [
  { valor: 'mes', texto: 'Mensal' },
  { valor: 'trimestre', texto: 'Trimestral' },
  { valor: 'acumulado', texto: 'Acumulado' },
];

function GraficoPeriodo({ ind }: { ind: IndicadorMunicipio }) {
  const [g, setG] = useState<Granularidade>('mes');
  const [visao, setVisao] = useState<'grafico' | 'tabela'>('grafico');
  const pontos = useMemo(() => serieExtensoes(ind.mensal, g), [ind.mensal, g]);
  const porPeriodo = useMemo(
    () => serieExtensoes(ind.mensal, g === 'trimestre' ? 'trimestre' : 'mes'),
    [ind.mensal, g],
  );
  const pico = porPeriodo.reduce<(typeof porPeriodo)[number] | null>(
    (m, p) => (p.km > (m?.km ?? 0) ? p : m),
    null,
  );
  const total = porPeriodo.reduce((s, p) => s + p.km, 0);
  const periodo = g === 'trimestre' ? 'trimestre' : 'mês';
  const rotulo = pico
    ? `Extensões por ${periodo} de cadastro no GIS. Total de ${fmtKm(total)}; maior volume em ${pico.rotulo}, com ${fmtKm(pico.km)}.`
    : 'Sem extensões com data de cadastro.';

  return (
    <Card
      id="grafico-periodo"
      className="lg:col-span-2"
      titulo="Extensões por data de cadastro"
      nota="Data de cadastro do trecho no GIS (CREATED_DA), não a data da obra."
      acoes={
        <>
          <Segmentado
            rotulo="Agrupamento"
            opcoes={ROTULO_GRANULARIDADE}
            valor={g}
            onChange={setG}
          />
          <Segmentado
            rotulo="Visualização"
            opcoes={[
              { valor: 'grafico', texto: 'Gráfico' },
              { valor: 'tabela', texto: 'Tabela' },
            ]}
            valor={visao}
            onChange={setVisao}
          />
        </>
      }
    >
      {pontos.length === 0 ? (
        <EmptyState titulo="Nenhuma extensão com data de cadastro neste filtro." />
      ) : visao === 'tabela' ? (
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{rotulo}</caption>
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="py-2 text-left font-medium">
                  Período
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  {g === 'acumulado' ? 'Extensões acumuladas' : 'Extensões'}
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Trechos
                </th>
              </tr>
            </thead>
            <tbody>
              {pontos.map((p) => (
                <tr key={p.chave} className="border-b border-border last:border-0">
                  <td className="py-1.5">{p.rotulo}</td>
                  <td className="tabular py-1.5 text-right">{fmtKm(p.km, 2)}</td>
                  <td className="tabular py-1.5 text-right">{fmtInt(p.trechos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Suspense fallback={<Skeleton className="h-[300px]" />}>
          <GraficoExtensoes pontos={pontos} granularidade={g} rotulo={rotulo} />
        </Suspense>
      )}
      {pico && (
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Total no período</dt>
            <dd className="tabular m-0 font-semibold">{fmtKm(total)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Maior {periodo}</dt>
            <dd className="tabular m-0 font-semibold">
              {pico.rotulo} · {fmtKm(pico.km)}
            </dd>
          </div>
          <div className="hidden sm:block">
            <dt className="text-xs text-muted">Sem data de cadastro</dt>
            <dd className="tabular m-0 font-semibold">{fmtInt(ind.extensoes_sem_data)} trechos</dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

const ORDEM_TIPOS: TipoObra[] = [
  'existente',
  'melhoria',
  'extensao',
  'encontrada',
  'doada',
  'substituicao',
];

function ComposicaoRede({
  ind,
  rotulos,
}: {
  ind: IndicadorMunicipio;
  rotulos: Record<TipoObra, string>;
}) {
  const itens = ORDEM_TIPOS.map((t) => ({ tipo: t, ...ind.por_tipo[t] })).filter(
    (x) => x.trechos > 0,
  );
  const max = Math.max(...itens.map((x) => x.km), 0.001);
  return (
    <Card
      id="composicao"
      titulo="Rede por tipo de obra"
      nota="km e participação na rede cadastrada."
    >
      <ul className="space-y-4">
        {itens.map((x) => {
          const pct = ind.rede_km ? (x.km / ind.rede_km) * 100 : 0;
          const rotulo = x.tipo === 'existente' ? 'Rede existente' : rotulos[x.tipo];
          return (
            <li key={x.tipo}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: `var(${VAR_GRUPO[grupoDoTipo(x.tipo)]})` }}
                  />
                  <span className="truncate">{rotulo}</span>
                </span>
                <span className="tabular whitespace-nowrap">
                  <span className="font-medium">{x.km < 1 ? fmtM(x.km * 1000) : fmtKm(x.km)}</span>
                  <span className="ml-2 inline-block w-12 text-right text-xs text-muted">
                    {fmtPct(pct)}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max((x.km / max) * 100, 0.8)}%`,
                    background: `var(${VAR_GRUPO[grupoDoTipo(x.tipo)]})`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-xs text-muted">
        Substituição, rede encontrada e rede doada usam a cor da rede existente no mapa.
      </p>
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
        cell: (c) => <span className="whitespace-nowrap font-medium">{c.getValue()}</span>,
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
          const alerta = v < LIMIAR_PREENCHIMENTO;
          return (
            <div className="flex items-center justify-end gap-2">
              <span
                className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 sm:block"
                aria-hidden
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${v}%`, background: alerta ? 'var(--warn)' : 'var(--ok)' }}
                />
              </span>
              <span className="w-10">{fmtNum(v)}</span>
              {alerta && <span className="sr-only"> (abaixo de 50%)</span>}
            </div>
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
