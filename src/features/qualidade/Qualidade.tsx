import { ComDados } from '@/app/ComDados';
import { carregar, useDados } from '@/app/data';
import { useApp } from '@/app/store';
import { useIndicadorAtual } from '@/app/useMunicipio';
import { Botao, Card, DataTable, EmptyState, PageHeader, Pill, type Tom } from '@/components/ui';
import { baixar, nomeArquivo, paraCsv } from '@/lib/csv';
import { fmtInt, fmtPct } from '@/lib/format';
import { LIMIAR_PREENCHIMENTO } from '@/lib/metrics';
import type {
  Gravidade,
  Inconsistencia,
  Indicadores,
  Manifest,
  Preenchimento,
  Trecho,
} from '@/types/data';
import { createColumnHelper } from '@tanstack/react-table';
import { AlertTriangle, Download, Info, OctagonAlert } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function Qualidade() {
  const ind = useDados<Indicadores>('indicadores.json');
  const inc = useDados<Inconsistencia[]>('inconsistencias.json');
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Qualidade do cadastro"
        descricao="O que falta na base cadastral para dimensionar e orçar as extensões, por gravidade."
      />
      {inc.status === 'ok' && <ResumoGravidade inc={inc.dados} />}
      <ComDados estado={ind}>{(d) => <Preenchimentos ind={d} />}</ComDados>
      <TabelaInconsistencias />
    </div>
  );
}

const GRAVIDADES: { g: Gravidade; descricao: string; cor: string; Icone: typeof AlertTriangle }[] =
  [
    { g: 'Alta', descricao: 'Impedem dimensionar ou orçar', cor: '--bad', Icone: OctagonAlert },
    { g: 'Média', descricao: 'Atrapalham relatórios', cor: '--warn', Icone: AlertTriangle },
    { g: 'Baixa', descricao: 'Padronização de texto', cor: '--text-muted', Icone: Info },
  ];

function ResumoGravidade({ inc }: { inc: Inconsistencia[] }) {
  const municipio = useApp((s) => s.municipio);
  const qtd = (i: Inconsistencia) => (municipio ? (i.por_municipio[municipio] ?? 0) : i.total);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {GRAVIDADES.map(({ g, descricao, cor, Icone }) => {
        const regras = inc.filter((i) => i.gravidade === g);
        const ativas = regras.filter((i) => qtd(i) > 0);
        const ocorrencias = regras.reduce((s, i) => s + qtd(i), 0);
        return (
          <div
            key={g}
            className="flex gap-4 rounded-xl border border-border bg-surface p-5 shadow-card"
          >
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: `color-mix(in srgb, var(${cor}) 14%, transparent)`,
                color: `var(${cor})`,
              }}
            >
              <Icone size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                Gravidade {g.toLowerCase()}{' '}
                <span className="font-normal text-muted">· {descricao}</span>
              </p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="tabular text-xl font-semibold">{fmtInt(ocorrencias)}</span>
                <span className="text-sm text-muted">ocorrências</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                em {fmtInt(ativas.length)} de {fmtInt(regras.length)} regras
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ROTULO_ATRIBUTO: Record<keyof Preenchimento, string> = {
  material: 'Material',
  diametro: 'Diâmetro',
  funcao: 'Função',
  pavimento: 'Pavimento',
  profundidade: 'Profundidade',
  bairro: 'Bairro',
};

function Preenchimentos({ ind }: { ind: Indicadores }) {
  const { atual, nome } = useIndicadorAtual(ind);
  if (!atual) return <EmptyState titulo={`Sem dados para "${nome}"`} />;
  const itens = (Object.keys(ROTULO_ATRIBUTO) as (keyof Preenchimento)[])
    .map((k) => ({ k, v: atual.preenchimento[k] }))
    .sort((a, b) => a.v - b.v);
  return (
    <Card
      id="preenchimento"
      titulo="Preenchimento por atributo"
      nota={`% dos ${fmtInt(atual.trechos)} trechos com o campo informado. Diâmetro e profundidade 0 contam como não informados. Abaixo de ${LIMIAR_PREENCHIMENTO}% fica em alerta.`}
    >
      <ul className="space-y-3">
        {itens.map(({ k, v }) => {
          const alerta = v < LIMIAR_PREENCHIMENTO;
          return (
            <li
              key={k}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)_5.5rem] items-center gap-3 text-sm"
            >
              <span>{ROTULO_ATRIBUTO[k]}</span>
              <span
                className="h-2 overflow-hidden rounded-full bg-surface-2"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={v}
                aria-label={`${ROTULO_ATRIBUTO[k]}: ${fmtPct(v)} preenchido`}
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${v}%`, background: alerta ? 'var(--warn)' : 'var(--brand)' }}
                />
              </span>
              <span className="tabular inline-flex items-center justify-end gap-1">
                {alerta && <AlertTriangle size={12} aria-hidden style={{ color: 'var(--warn)' }} />}
                {fmtPct(v)}
                {alerta && <span className="sr-only">, abaixo de {LIMIAR_PREENCHIMENTO}%</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const TOM_GRAVIDADE: Record<Gravidade, Tom> = { Alta: 'bad', Média: 'warn', Baixa: 'neutro' };
type Linha = Inconsistencia & { qtd: number };
const col = createColumnHelper<Linha>();

function TabelaInconsistencias() {
  const inc = useDados<Inconsistencia[]>('inconsistencias.json');
  const manifest = useDados<Manifest>('manifest.json');
  const municipio = useApp((s) => s.municipio);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const comTrechos = manifest.status === 'ok' && manifest.dados.modo === 'completo';

  const exportar = async (i: Inconsistencia) => {
    setBaixando(i.codigo);
    setErro(null);
    try {
      const trechos = await carregar<Trecho[]>('trechos.json');
      const ids = new Set(i.trechos ?? []);
      const sel = trechos.filter((t) => ids.has(t.id) && (!municipio || t.municipio === municipio));
      const csv = paraCsv(
        [
          'id',
          'globalid',
          'municipio',
          'bairro',
          'tipo',
          'extensao_m',
          'comprimento_desenho_m',
          'diametro_mm',
          'material',
          'material_codigo',
          'pavimento',
          'funcao',
          'profundidade_m',
          'data_cadastro_gis',
          'problema',
          'acao_sugerida',
        ],
        sel.map((t) => [
          t.id,
          t.globalid,
          t.municipio,
          t.bairro,
          t.tipo,
          t.extensao_m,
          t.comprimento_m,
          t.diametro_mm,
          t.material,
          t.material_codigo,
          t.pavimento,
          t.funcao,
          t.profundidade_m,
          t.cadastro,
          i.problema,
          i.acao,
        ]),
      );
      baixar(`${nomeArquivo('inconsistencia', i.codigo, municipio)}.csv`, csv);
    } catch {
      setErro('Não foi possível gerar o CSV. Tente de novo.');
    } finally {
      setBaixando(null);
    }
  };

  const colunas = useMemo(
    () => [
      col.accessor('problema', {
        header: 'Problema',
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      col.accessor('gravidade', {
        header: 'Gravidade',
        sortingFn: (a, b) =>
          ['Alta', 'Média', 'Baixa'].indexOf(a.original.gravidade) -
          ['Alta', 'Média', 'Baixa'].indexOf(b.original.gravidade),
        cell: (c) => <Pill tom={TOM_GRAVIDADE[c.getValue()]}>{c.getValue()}</Pill>,
      }),
      col.accessor('qtd', {
        header: 'Trechos',
        meta: { numerica: true },
        cell: (c) => fmtInt(c.getValue()),
      }),
      col.accessor('acao', {
        header: 'Ação sugerida',
        meta: { esconderNoCelular: true },
        cell: (c) => <span className="text-muted">{c.getValue()}</span>,
      }),
      // Sem a base publicada não há lista de trechos: a coluna nem aparece.
      ...(!comTrechos
        ? []
        : [
            col.display({
              id: 'csv',
              header: () => <span className="sr-only">Baixar</span>,
              cell: (c) => (
                <Botao
                  icone={<Download size={14} aria-hidden />}
                  disabled={c.row.original.qtd === 0 || baixando === c.row.original.codigo}
                  onClick={() => exportar(c.row.original)}
                  aria-label={`Baixar CSV: ${c.row.original.problema}`}
                  title="Baixar lista de trechos em CSV"
                >
                  CSV
                </Botao>
              ),
            }),
          ]),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comTrechos, baixando, municipio],
  );

  return (
    <Card
      id="inconsistencias"
      titulo="Inconsistências do cadastro"
      nota="Alta impede dimensionar ou orçar. Média atrapalha relatórios. Baixa é padronização de texto."
    >
      {erro && (
        <p role="alert" className="mb-3 text-sm">
          {erro}
        </p>
      )}
      {manifest.status === 'ok' && !comTrechos && (
        <p className="mb-3 text-xs text-muted">
          A lista de trechos (CSV) só está disponível quando a base completa é publicada.
        </p>
      )}
      <ComDados estado={inc}>
        {(d) => {
          const linhas = d.map((i) => ({
            ...i,
            qtd: municipio ? (i.por_municipio[municipio] ?? 0) : i.total,
          }));
          return (
            <DataTable
              dados={linhas}
              colunas={colunas}
              legenda="Inconsistências do cadastro"
              getRowId={(i) => i.codigo}
              ordenacaoInicial={[{ id: 'gravidade', desc: false }]}
            />
          );
        }}
      </ComDados>
    </Card>
  );
}
