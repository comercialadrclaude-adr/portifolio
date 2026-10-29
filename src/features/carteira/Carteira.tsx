import { ComDados } from '@/app/ComDados';
import { useDados } from '@/app/data';
import { useApp } from '@/app/store';
import { Card, DataTable, EmptyState, Pill } from '@/components/ui';
import { fmtDistancia, fmtInt, fmtM, fmtNum } from '@/lib/format';
import { DEFINICOES } from '@/lib/metrics';
import { calcularPrioridade } from '@/lib/priority';
import type { ItemPortfolio, Projeto, Projetos, Zeis } from '@/types/data';
import { createColumnHelper } from '@tanstack/react-table';
import { Map as IconeMapa } from 'lucide-react';
import { useMemo } from 'react';
import { Detalhe } from './Detalhe';
import { TOM_ETAPA, TOM_USO } from './etapas';
import { Funil } from './Funil';

export default function Carteira() {
  const projetos = useDados<Projetos>('projetos.json');
  return (
    <div className="space-y-6">
      <ComDados estado={projetos}>{(d) => <Projetos dados={d} />}</ComDados>
      <TabelaZeis />
      <Inventario />
    </div>
  );
}

type LinhaProjeto = Projeto & { prioridade: number | null };
const cp = createColumnHelper<LinhaProjeto>();

function Projetos({ dados }: { dados: Projetos }) {
  const municipio = useApp((s) => s.municipio);
  const selecionado = useApp((s) => s.projeto);
  const setProjeto = useApp((s) => s.setProjeto);
  const abrirNoMapa = useApp((s) => s.abrirNoMapa);

  const linhas = useMemo<LinhaProjeto[]>(
    () =>
      dados.projetos
        .filter((p) => !municipio || p.municipio === municipio)
        .map((p) => ({ ...p, prioridade: calcularPrioridade(p).indice })),
    [dados, municipio],
  );
  const atual = dados.projetos.find((p) => p.id === selecionado) ?? null;

  const colunas = useMemo(
    () => [
      cp.accessor('id', {
        header: 'ID',
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      }),
      cp.accessor('nome', {
        header: 'Projeto',
        cell: (c) => (
          <div className="min-w-[10rem]">
            <span className="font-medium">{c.getValue()}</span>
            <span className="block text-xs text-muted">
              {[c.row.original.municipio, c.row.original.bairro].filter(Boolean).join(' · ')}
            </span>
          </div>
        ),
      }),
      cp.accessor('etapa', {
        header: 'Etapa',
        cell: (c) => <Pill tom={TOM_ETAPA[c.getValue()] ?? 'neutro'}>{c.getValue()}</Pill>,
      }),
      cp.accessor('tracado_m', {
        header: 'Traçado (m)',
        meta: { numerica: true },
        cell: (c) => (c.getValue() ? fmtInt(c.getValue()) : '–'),
      }),
      cp.accessor('area_ha', {
        header: 'Área (ha)',
        meta: { numerica: true, esconderNoCelular: true },
        cell: (c) => (c.getValue() ? fmtNum(c.getValue()) : '–'),
      }),
      cp.accessor('distancia_rede_m', {
        header: 'Até a rede',
        meta: { numerica: true, esconderNoCelular: true },
        cell: (c) => fmtDistancia(c.getValue()),
      }),
      cp.accessor('distancia_zeis_m', {
        header: 'Até a ZEIS',
        meta: { numerica: true, esconderNoCelular: true },
        cell: (c) => (c.row.original.dentro_zeis ? 'dentro' : fmtDistancia(c.getValue())),
      }),
      cp.accessor('prioridade', {
        header: 'Prioridade',
        meta: { numerica: true },
        cell: (c) => (c.getValue() == null ? '–' : fmtInt(c.getValue())),
      }),
      cp.accessor((p) => p.pendencias.length, {
        id: 'pendencias',
        header: 'Pendências',
        meta: { numerica: true, esconderNoCelular: true },
      }),
      cp.display({
        id: 'mapa',
        header: () => <span className="sr-only">Mapa</span>,
        cell: (c) => (
          <button
            type="button"
            aria-label={`Abrir ${c.row.original.id} no mapa`}
            title="Abrir no mapa"
            onClick={(e) => {
              e.stopPropagation();
              abrirNoMapa(c.row.original.id);
            }}
            className="rounded p-1.5 text-muted hover:bg-surface hover:text-text"
          >
            <IconeMapa size={16} aria-hidden />
          </button>
        ),
      }),
    ],
    [abrirNoMapa],
  );

  return (
    <>
      <Card
        titulo="Etapas"
        nota="Estudo → Traçado preliminar → Projeto executivo → Aprovado → Em obra → Concluído → Cadastrado no GIS."
      >
        <Funil etapas={dados.etapas} projetos={linhas} />
      </Card>
      <div className={`grid gap-6 ${atual ? 'lg:grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
        <Card
          id="projetos"
          titulo="Carteira de projetos"
          nota={`${fmtInt(linhas.length)} projetos · ${fmtM(linhas.reduce((s, p) => s + p.tracado_m, 0))} de traçado. Clique para ver a ficha.`}
        >
          {linhas.length === 0 ? (
            <EmptyState titulo="Nenhum projeto neste município.">
              Escolha “Todos os municípios” para ver a carteira completa.
            </EmptyState>
          ) : (
            <DataTable
              dados={linhas}
              colunas={colunas}
              legenda="Projetos em carteira"
              getRowId={(p) => p.id}
              selecionada={selecionado}
              aoClicar={(p) => setProjeto(p.id === selecionado ? null : p.id)}
              rotuloLinha={(p) => `Ver ficha de ${p.id} ${p.nome}`}
              busca
            />
          )}
        </Card>
        {atual && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Detalhe
              projeto={atual}
              onFechar={() => setProjeto(null)}
              onMapa={() => abrirNoMapa(atual.id)}
            />
          </div>
        )}
      </div>
    </>
  );
}

const cz = createColumnHelper<Zeis>();

function TabelaZeis() {
  const zeis = useDados<Zeis[]>('zeis.json');
  const municipio = useApp((s) => s.municipio);
  const colunas = useMemo(
    () => [
      cz.accessor('id', {
        header: 'ID',
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      }),
      cz.accessor('nome', {
        header: 'ZEIS',
        cell: (c) => <span className="font-medium">{c.getValue()}</span>,
      }),
      cz.accessor('municipio', { header: 'Município', meta: { esconderNoCelular: true } }),
      cz.accessor('area_ha', {
        header: 'Área (ha)',
        meta: { numerica: true },
        cell: (c) => fmtNum(c.getValue()),
      }),
      cz.accessor('rede_m', {
        header: 'Rede interna (m)',
        meta: { numerica: true },
        cell: (c) => fmtInt(c.getValue()),
      }),
      cz.accessor('densidade_m_ha', {
        header: 'Densidade (m/ha)',
        meta: { numerica: true, esconderNoCelular: true },
        cell: (c) => fmtNum(c.getValue()),
      }),
      cz.accessor('extensoes_m', {
        header: 'Extensões internas (m)',
        meta: { numerica: true, esconderNoCelular: true },
        cell: (c) => fmtInt(c.getValue()),
      }),
    ],
    [],
  );
  return (
    <Card
      id="zeis"
      titulo="ZEIS (preliminar)"
      nota={`${DEFINICOES.rede_interna_zeis} Densidade = ${DEFINICOES.densidade_zeis.toLowerCase()}`}
    >
      <ComDados estado={zeis} ausente={<EmptyState titulo="Camada de ZEIS não publicada." />}>
        {(d) => {
          const lista = d.filter((z) => !municipio || z.municipio === municipio);
          return lista.length ? (
            <DataTable dados={lista} colunas={colunas} legenda="ZEIS" getRowId={(z) => z.id} />
          ) : (
            <EmptyState titulo="Nenhuma ZEIS mapeada neste município." />
          );
        }}
      </ComDados>
    </Card>
  );
}

const ci = createColumnHelper<ItemPortfolio>();

function Inventario() {
  const port = useDados<ItemPortfolio[]>('portfolio.json');
  const colunas = useMemo(
    () => [
      ci.accessor('arquivo', {
        header: 'Arquivo',
        cell: (c) => (
          <div>
            <span className="font-mono text-xs">{c.getValue()}</span>
            {c.row.original.documento && (
              <span className="block text-xs text-muted">{c.row.original.documento}</span>
            )}
          </div>
        ),
      }),
      ci.accessor('conteudo', { header: 'Conteúdo' }),
      ci.accessor('feicoes', {
        header: 'Feições',
        meta: { numerica: true },
        cell: (c) => fmtInt(c.getValue()),
      }),
      ci.accessor('uso', {
        header: 'Uso sugerido',
        cell: (c) => <Pill tom={TOM_USO[c.getValue()]}>{c.getValue()}</Pill>,
      }),
    ],
    [],
  );
  return (
    <Card
      id="inventario"
      titulo="Inventário do portfólio"
      nota="Arquivos KMZ recebidos, o que contêm e o que fazer com cada um. Cópias da base foram comparadas por hash."
    >
      <ComDados estado={port}>
        {(d) => (
          <DataTable
            dados={d}
            colunas={colunas}
            legenda="Inventário dos arquivos do portfólio"
            getRowId={(x) => x.arquivo}
          />
        )}
      </ComDados>
    </Card>
  );
}
