import { useDados } from '@/app/data';
import { Botao, Pill } from '@/components/ui';
import {
  A_PREENCHER,
  fmtBRL,
  fmtData,
  fmtDistancia,
  fmtHa,
  fmtInt,
  fmtM,
  fmtNum,
  ouAPreencher,
} from '@/lib/format';
import { DEFINICOES } from '@/lib/metrics';
import { calcularPrioridade, ROTULO_CRITERIO } from '@/lib/priority';
import type { Projeto } from '@/types/data';
import type { FeatureCollection, Geometry } from 'geojson';
import { Circle, Map as IconeMapa, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { TOM_ETAPA } from './etapas';
import { MiniMapa } from './MiniMapa';

function Linha({
  rotulo,
  children,
  vazio,
}: {
  rotulo: string;
  children: ReactNode;
  vazio?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5 last:border-0">
      <dt className="text-muted">{rotulo}</dt>
      <dd className={`tabular m-0 text-right ${vazio ? 'italic text-muted' : ''}`}>{children}</dd>
    </div>
  );
}

interface Props {
  projeto: Projeto;
  onFechar: () => void;
  onMapa: () => void;
}

export function Detalhe({ projeto: p, onFechar, onMapa }: Props) {
  const geo =
    useDados<FeatureCollection<Geometry, { projeto: string; papel: string }>>('projetos.geojson');
  const prio = calcularPrioridade(p);
  const campo = (v: string | number | null, fmt?: (x: number) => string) => {
    const t = ouAPreencher(v, fmt);
    return { texto: t, vazio: t === A_PREENCHER };
  };
  const ficha: [string, ReturnType<typeof campo>][] = [
    ['Solicitante', campo(p.solicitante)],
    ['Motivo', campo(p.motivo)],
    ['Ligações previstas', campo(p.ligacoes_previstas, fmtInt)],
    ['Custo estimado', campo(p.custo_estimado_brl, fmtBRL)],
    ['Custo por ligação', campo(p.custo_por_ligacao_brl, fmtBRL)],
    ['Responsável', campo(p.responsavel)],
    ['Data prevista', campo(p.data_prevista ? fmtData(p.data_prevista) : null)],
    ['Data real', campo(p.data_real ? fmtData(p.data_real) : null)],
  ];

  return (
    <aside aria-labelledby="detalhe-titulo" className="p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted">{p.id}</p>
          <h2 id="detalhe-titulo" className="text-base font-semibold">
            {p.nome}
          </h2>
          <p className="text-xs text-muted">
            {[p.municipio, p.bairro].filter(Boolean).join(' · ') || 'Local não identificado'}
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar ficha do projeto"
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-text"
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill tom={TOM_ETAPA[p.etapa] ?? 'neutro'}>{p.etapa}</Pill>
        {p.etapa_inferida && (
          <span className="text-xs text-muted">etapa inferida do desenho, a confirmar</span>
        )}
      </div>

      <div className="mt-4">
        {geo.status === 'ok' && <MiniMapa projetos={geo.dados} id={p.id} />}
        <Botao
          className="mt-3 w-full justify-center"
          variante="primario"
          icone={<IconeMapa size={14} aria-hidden />}
          onClick={onMapa}
        >
          Abrir no mapa
        </Botao>
      </div>

      <h3 className="mt-6 text-sm font-semibold">Ficha</h3>
      <dl className="mt-2 text-sm">
        <Linha rotulo="Traçado">{p.tracado_m ? fmtM(p.tracado_m) : 'sem traçado'}</Linha>
        <Linha rotulo="Área">
          {p.areas ? `${fmtHa(p.area_ha)} em ${p.areas} ${p.areas > 1 ? 'áreas' : 'área'}` : '–'}
        </Linha>
        <Linha rotulo="Distância até a rede">
          <span title={DEFINICOES.distancia_rede}>{fmtDistancia(p.distancia_rede_m)}</span>
          {!p.referencia_e_interligacao && (
            <span className="block text-xs text-muted">medida da primeira feição</span>
          )}
        </Linha>
        <Linha rotulo="Trecho de interligação">
          <span className="font-mono text-xs">{p.trecho_interligacao ?? '–'}</span>
        </Linha>
        <Linha rotulo="Distância até a ZEIS">
          {p.dentro_zeis ? 'dentro da ZEIS' : fmtDistancia(p.distancia_zeis_m)}
          {p.zeis_proxima && (
            <span className="block font-mono text-xs text-muted">{p.zeis_proxima}</span>
          )}
        </Linha>
        {ficha.map(([r, c]) => (
          <Linha key={r} rotulo={r} vazio={c.vazio}>
            {c.texto}
          </Linha>
        ))}
      </dl>

      <h3 className="mt-6 text-sm font-semibold">Índice de prioridade</h3>
      <p className="mt-1 text-xs text-muted">
        Média ponderada dos critérios com dado ({fmtInt(prio.pesoUsado)} de {fmtInt(prio.pesoTotal)}{' '}
        pontos de peso). Pesos em <code className="font-mono">src/lib/priority.ts</code>.
      </p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="tabular text-xl font-semibold">
          {prio.indice == null ? '–' : fmtInt(prio.indice)}
        </span>
        <span className="text-sm text-muted">/ 100</span>
      </div>
      <table className="mt-2 w-full text-xs">
        <caption className="sr-only">Cálculo do índice de prioridade</caption>
        <thead>
          <tr className="border-b border-border text-muted">
            <th scope="col" className="py-1 text-left font-medium">
              Critério
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Peso
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Nota
            </th>
          </tr>
        </thead>
        <tbody>
          {prio.parcelas.map((x) => (
            <tr key={x.criterio} className="border-b border-border last:border-0">
              <td className="py-1.5">
                {ROTULO_CRITERIO[x.criterio]}
                <span className="block text-muted">{x.detalhe}</span>
              </td>
              <td className="tabular py-1.5 text-right">{x.peso}</td>
              <td
                className={`tabular py-1.5 text-right ${x.nota == null ? 'italic text-muted' : ''}`}
              >
                {x.nota == null ? A_PREENCHER : fmtNum(x.nota, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mt-6 text-sm font-semibold">Pendências antes de aprovar</h3>
      {p.pendencias.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nenhuma pendência identificada.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {p.pendencias.map((x) => (
            <li key={x.codigo} className="flex gap-2">
              <Circle size={14} aria-hidden className="mt-0.5 shrink-0 text-muted" />
              <span>{x.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
