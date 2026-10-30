import { URL_DADOS, useDados } from '@/app/data';
import { CAMADAS, useApp, type Camada } from '@/app/store';
import { useTemaAtual } from '@/app/theme';
import { estiloVazio, ESTILO_BASE } from '@/components/map/estilos';
import { bboxValido, comprimento } from '@/components/map/geo';
import { Legenda } from '@/components/map/Legenda';
import { Botao, ErrorState, PageHeader } from '@/components/ui';
import { token } from '@/lib/colors';
import { fmtData, fmtDistancia, fmtM, fmtMm, SEM_DADO } from '@/lib/format';
import type { Bbox, Indicadores, Manifest, Projetos, TipoObra, Trecho } from '@/types/data';
import type { FeatureCollection, Geometry } from 'geojson';
import { Crosshair, Ruler, X } from 'lucide-react';
import {
  Map as MapLibre,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import urlWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// O MapLibre 6 carrega o worker por URL relativa ao módulo; com o bundler, apontamos o arquivo.
setWorkerUrl(urlWorker);

type FC = FeatureCollection<Geometry, Record<string, unknown>>;

const urlDados = (arquivo: string) => new URL(URL_DADOS + arquivo, window.location.href).href;

const ROTULO_CAMADA: Record<Camada, string> = {
  existente: 'Rede existente',
  extensao: 'Extensões',
  melhoria: 'Melhorias',
  projetos: 'Projetos',
  zeis: 'ZEIS',
  relevo: 'Relevo',
};

const COR_CAMADA: Record<Camada, string> = {
  existente: '--net-existing',
  extensao: '--net-extension',
  melhoria: '--net-improvement',
  projetos: '--project',
  zeis: '--zeis',
  relevo: '--text-muted',
};

const ROTULO_TIPO: Record<TipoObra, string> = {
  extensao: 'Extensão',
  melhoria: 'Melhoria',
  substituicao: 'Substituição',
  encontrada: 'Rede encontrada',
  doada: 'Rede doada',
  existente: 'Rede existente',
};

/** Camadas da rede, de baixo para cima (extensão por cima de tudo). */
const REDE: { id: string; camada: Camada; tipos: TipoObra[]; cor: string }[] = [
  {
    id: 'rede-existente',
    camada: 'existente',
    tipos: ['existente', 'substituicao', 'encontrada', 'doada'],
    cor: '--net-existing',
  },
  { id: 'rede-melhoria', camada: 'melhoria', tipos: ['melhoria'], cor: '--net-improvement' },
  { id: 'rede-extensao', camada: 'extensao', tipos: ['extensao'], cor: '--net-extension' },
];

const ORDEM_CAMADAS = [
  'relevo-fill',
  'relevo-line',
  'zeis-fill',
  'zeis-line',
  ...REDE.map((r) => r.id),
  'proj-halo',
  'proj-area',
  'proj-area-line',
  'proj-linha',
  'proj-ponto',
  'medida-linha',
  'medida-ponto',
];

const largura = (mult: number): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  ['*', 0.6 * mult, ['match', ['get', 'f'], 3, 3.4, 2, 2.3, 1, 1.4, 1.2]],
  13,
  ['*', mult, ['match', ['get', 'f'], 3, 3.4, 2, 2.3, 1, 1.4, 1.2]],
  17,
  ['*', 2.2 * mult, ['match', ['get', 'f'], 3, 3.4, 2, 2.3, 1, 1.4, 1.2]],
];

/** Constrói o conteúdo de popup com textContent (nomes vêm do KML: nada de HTML cru). */
function popupConteudo(
  titulo: string,
  linhas: [string, string][],
  acao?: { texto: string; fn: () => void },
) {
  const raiz = document.createElement('div');
  raiz.className = 'min-w-[12rem]';
  const h = document.createElement('div');
  h.className = 'mb-1 font-semibold text-sm';
  h.textContent = titulo;
  raiz.appendChild(h);
  const dl = document.createElement('dl');
  dl.className = 'grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5';
  for (const [k, v] of linhas) {
    const dt = document.createElement('dt');
    dt.className = 'text-muted';
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.className = 'tabular m-0 text-right';
    dd.textContent = v;
    dl.append(dt, dd);
  }
  raiz.appendChild(dl);
  if (acao) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mt-2 w-full rounded border border-border px-2 py-1 text-xs hover:bg-surface-2';
    b.textContent = acao.texto;
    b.addEventListener('click', acao.fn);
    raiz.appendChild(b);
  }
  return raiz;
}

export default function Mapa() {
  const manifest = useDados<Manifest>('manifest.json');
  const ind = useDados<Indicadores>('indicadores.json');
  const projetos = useDados<Projetos>('projetos.json');
  const projetosGeo = useDados<FC>('projetos.geojson');
  const zeisGeo = useDados<FC>('zeis.geojson');
  const camadas = useApp((s) => s.camadas);
  const alternarCamada = useApp((s) => s.alternarCamada);

  const completo = manifest.status === 'ok' && manifest.dados.modo === 'completo';
  const temRelevo = manifest.status === 'ok' && manifest.dados.arquivos.includes('relevo.geojson');
  // Rede e relevo vão por URL: o worker do MapLibre baixa e interpreta fora da thread principal.
  const rede = completo ? urlDados('rede.geojson') : null;
  const relevo = temRelevo && camadas.includes('relevo') ? urlDados('relevo.geojson') : null;

  if (manifest.status === 'erro') return <ErrorState onRetry={manifest.tentarDeNovo} />;

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Mapa"
        descricao={
          completo
            ? 'Rede cadastrada por tipo de obra e diâmetro, projetos propostos e ZEIS.'
            : 'Projetos propostos e ZEIS. A rede trecho a trecho não é publicada (só agregados).'
        }
      />
      <MapaInterativo
        rede={rede}
        projetosGeo={projetosGeo.status === 'ok' ? projetosGeo.dados : null}
        zeisGeo={zeisGeo.status === 'ok' ? zeisGeo.dados : null}
        relevo={relevo}
        projetos={projetos.status === 'ok' ? projetos.dados : null}
        ind={ind.status === 'ok' ? ind.dados : null}
        comRede={completo}
        painelCamadas={
          <fieldset className="pointer-events-auto rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
            <legend className="sr-only">Camadas</legend>
            <p aria-hidden className="mb-1 font-medium">
              Camadas
            </p>
            <ul>
              {CAMADAS.map((c) => {
                const indisponivel =
                  (c === 'relevo' && !temRelevo) ||
                  (['existente', 'extensao', 'melhoria'].includes(c) &&
                    manifest.status === 'ok' &&
                    !completo);
                return (
                  <li key={c}>
                    <label
                      className={`flex min-h-[24px] items-center gap-2 ${indisponivel ? 'opacity-50' : 'cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        checked={camadas.includes(c) && !indisponivel}
                        disabled={indisponivel}
                        onChange={() => alternarCamada(c)}
                        className="h-3.5 w-3.5"
                        style={{ accentColor: 'var(--brand)' }}
                      />
                      <span
                        aria-hidden
                        className="h-2 w-3 rounded-sm"
                        style={{ background: `var(${COR_CAMADA[c]})` }}
                      />
                      {ROTULO_CAMADA[c]}
                      {c === 'relevo' && <span className="text-muted">(opcional)</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        }
      />
      {completo && (
        <p className="text-xs text-muted">
          Passe o mouse ou toque num trecho para ver os atributos. A data exibida é a de cadastro no
          GIS, não a da obra.
        </p>
      )}
    </div>
  );
}

interface PropsMapa {
  rede: string | null;
  projetosGeo: FC | null;
  zeisGeo: FC | null;
  relevo: string | null;
  projetos: Projetos | null;
  ind: Indicadores | null;
  painelCamadas: React.ReactNode;
  comRede: boolean;
}

function MapaInterativo({
  rede,
  projetosGeo,
  zeisGeo,
  relevo,
  projetos,
  ind,
  painelCamadas,
  comRede,
}: PropsMapa) {
  const container = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapLibre | null>(null);
  const popup = useRef<Popup | null>(null);
  const fixado = useRef(false);
  const [pronto, setPronto] = useState(0); // incrementa a cada style.load
  // isStyleLoaded() fica falso enquanto fontes GeoJSON processam; usamos flag própria.
  const estiloCarregado = useRef(false);
  const tema = useTemaAtual();
  const temaInicial = useRef(tema);

  const municipio = useApp((s) => s.municipio);
  const projeto = useApp((s) => s.projeto);
  const camadas = useApp((s) => s.camadas);
  const enquadrar = useApp((s) => s.enquadrar);
  const setProjeto = useApp((s) => s.setProjeto);
  const setAba = useApp((s) => s.setAba);

  const [medindo, setMedindo] = useState(false);
  const [pontos, setPontos] = useState<[number, number][]>([]);
  const medindoRef = useRef(medindo);
  medindoRef.current = medindo;

  // Atributos só servem aos popups: baixam depois que a rede já está desenhada.
  const [redeDesenhada, setRedeDesenhada] = useState(false);
  const trechosEstado = useDados<Trecho[]>(redeDesenhada ? 'trechos.json' : null);
  const trechos = trechosEstado.status === 'ok' ? trechosEstado.dados : null;
  const porId = useMemo(() => new Map((trechos ?? []).map((t) => [t.id, t])), [trechos]);
  const porIdRef = useRef(porId);
  porIdRef.current = porId;
  const projetosRef = useRef(projetos);
  projetosRef.current = projetos;

  // --- Criação do mapa (uma vez) -------------------------------------------
  useEffect(() => {
    if (!container.current) return;
    let vazio = false;
    const m = new MapLibre({
      container: container.current,
      style: ESTILO_BASE[temaInicial.current],
      center: [-42.0, -22.0],
      zoom: 7,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    });
    mapa.current = m;
    // Exposto para testes de ponta a ponta e depuração.
    (window as unknown as { __mapa?: MapLibre }).__mapa = m;
    popup.current = new Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '280px',
      offset: 8,
      focusAfterOpen: false, // hover não pode roubar o foco do teclado
    });
    popup.current.on('close', () => {
      fixado.current = false;
    });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');
    m.on('sourcedata', (e) => {
      if (e.sourceId === 'rede' && e.isSourceLoaded) setRedeDesenhada(true);
    });
    m.on('style.load', () => {
      estiloCarregado.current = true;
      setPronto((n) => n + 1);
    });
    m.on('error', (e) => {
      // Mapa base inacessível: troca por fundo liso e mantém as camadas do painel.
      if (!vazio && !estiloCarregado.current) {
        vazio = true;
        console.warn('Mapa base indisponível; usando fundo liso.', e.error?.message);
        m.setStyle(estiloVazio(token('--bg')));
      }
    });
    return () => {
      popup.current?.remove();
      m.remove();
      mapa.current = null;
    };
  }, []);

  // --- Troca de tema: troca o mapa base e remonta as camadas ---------------
  useEffect(() => {
    const m = mapa.current;
    if (!m || tema === temaInicial.current) return;
    temaInicial.current = tema;
    estiloCarregado.current = false;
    m.setStyle(ESTILO_BASE[tema]);
  }, [tema]);

  // --- Fontes e camadas -----------------------------------------------------
  const garantirFonte = useCallback((m: MapLibre, id: string, dados: FC | string | null) => {
    if (!dados) return false;
    const fonte = m.getSource(id) as GeoJSONSource | undefined;
    if (fonte) {
      if ((fonte as unknown as { _dadosPainel?: FC | string })._dadosPainel !== dados) {
        fonte.setData(dados);
        (fonte as unknown as { _dadosPainel?: FC | string })._dadosPainel = dados;
      }
    } else {
      m.addSource(id, { type: 'geojson', data: dados });
      (m.getSource(id) as unknown as { _dadosPainel?: FC | string })._dadosPainel = dados;
    }
    return true;
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m || !pronto || !estiloCarregado.current) return;
    const cor = (v: string) => token(v);
    // Os dados chegam em qualquer ordem; cada camada entra na posição fixa de ORDEM_CAMADAS.
    const add = (l: Parameters<MapLibre['addLayer']>[0]) => {
      if (m.getLayer(l.id)) return;
      const i = ORDEM_CAMADAS.indexOf(l.id);
      const antes = ORDEM_CAMADAS.slice(i + 1).find((id) => m.getLayer(id));
      m.addLayer(l, antes);
    };

    if (garantirFonte(m, 'relevo', relevo)) {
      add({
        id: 'relevo-fill',
        type: 'fill',
        source: 'relevo',
        paint: { 'fill-color': cor('--text-muted'), 'fill-opacity': 0.06 },
      });
      add({
        id: 'relevo-line',
        type: 'line',
        source: 'relevo',
        paint: { 'line-color': cor('--text-muted'), 'line-width': 0.6, 'line-opacity': 0.6 },
      });
    }
    if (garantirFonte(m, 'zeis', zeisGeo)) {
      add({
        id: 'zeis-fill',
        type: 'fill',
        source: 'zeis',
        paint: { 'fill-color': cor('--zeis'), 'fill-opacity': 0.2 },
      });
      add({
        id: 'zeis-line',
        type: 'line',
        source: 'zeis',
        paint: { 'line-color': cor('--zeis'), 'line-width': 1.5 },
      });
    }
    if (garantirFonte(m, 'rede', rede)) {
      for (const r of REDE) {
        add({
          id: r.id,
          type: 'line',
          source: 'rede',
          filter: ['in', ['get', 't'], ['literal', r.tipos]],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': cor(r.cor), 'line-width': largura(1) },
        });
      }
    }
    if (garantirFonte(m, 'projetos', projetosGeo)) {
      add({
        id: 'proj-halo',
        type: 'line',
        source: 'projetos',
        filter: ['==', ['get', 'projeto'], ''],
        paint: {
          'line-color': cor('--project'),
          'line-width': 10,
          'line-opacity': 0.22,
          'line-blur': 1,
        },
      });
      add({
        id: 'proj-area',
        type: 'fill',
        source: 'projetos',
        filter: ['==', ['get', 'papel'], 'area'],
        paint: { 'fill-color': cor('--project'), 'fill-opacity': 0.15 },
      });
      add({
        id: 'proj-area-line',
        type: 'line',
        source: 'projetos',
        filter: ['==', ['get', 'papel'], 'area'],
        paint: { 'line-color': cor('--project'), 'line-width': 1.5, 'line-dasharray': [3, 2] },
      });
      add({
        id: 'proj-linha',
        type: 'line',
        source: 'projetos',
        filter: ['==', ['get', 'papel'], 'tracado'],
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': cor('--project'),
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 4],
          'line-dasharray': [2, 1.5],
        },
      });
      add({
        id: 'proj-ponto',
        type: 'circle',
        source: 'projetos',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['case', ['==', ['get', 'papel'], 'interligacao'], 6, 4],
          'circle-color': [
            'case',
            ['==', ['get', 'papel'], 'interligacao'],
            cor('--surface'),
            cor('--project'),
          ],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'papel'], 'interligacao'],
            cor('--project'),
            cor('--surface'),
          ],
          'circle-stroke-width': 2,
        },
      });
    }
    // Régua
    const medida: FC = { type: 'FeatureCollection', features: [] };
    if (!m.getSource('medida')) {
      m.addSource('medida', { type: 'geojson', data: medida });
      add({
        id: 'medida-linha',
        type: 'line',
        source: 'medida',
        paint: { 'line-color': cor('--brand'), 'line-width': 2, 'line-dasharray': [1, 1] },
      });
      add({
        id: 'medida-ponto',
        type: 'circle',
        source: 'medida',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 4,
          'circle-color': cor('--brand'),
          'circle-stroke-color': cor('--surface'),
          'circle-stroke-width': 2,
        },
      });
    }
  }, [pronto, rede, projetosGeo, zeisGeo, relevo, garantirFonte]);

  // --- Visibilidade, destaque do município e do projeto ---------------------
  useEffect(() => {
    const m = mapa.current;
    if (!m || !pronto || !estiloCarregado.current) return;
    const vis = (id: string, on: boolean) =>
      m.getLayer(id) && m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    for (const r of REDE) {
      vis(r.id, camadas.includes(r.camada));
      if (m.getLayer(r.id))
        m.setPaintProperty(
          r.id,
          'line-opacity',
          municipio ? ['case', ['==', ['get', 'm'], municipio], 1, 0.18] : 1,
        );
    }
    for (const id of ['proj-halo', 'proj-area', 'proj-area-line', 'proj-linha', 'proj-ponto'])
      vis(id, camadas.includes('projetos'));
    for (const id of ['zeis-fill', 'zeis-line']) vis(id, camadas.includes('zeis'));
    for (const id of ['relevo-fill', 'relevo-line']) vis(id, camadas.includes('relevo'));
    if (m.getLayer('proj-halo'))
      m.setFilter('proj-halo', ['==', ['get', 'projeto'], projeto ?? '']);
  }, [pronto, camadas, municipio, projeto, rede, projetosGeo, zeisGeo, relevo]);

  // --- Enquadramento ---------------------------------------------------------
  const alvo = useCallback((): Bbox | null => {
    const p = projeto && projetos?.projetos.find((x) => x.id === projeto);
    if (p && bboxValido(p.bbox)) return p.bbox;
    if (!ind) return null;
    const mun = municipio ? ind.municipios.find((x) => x.nome === municipio) : null;
    return (mun ?? ind.todos).bbox;
  }, [projeto, projetos, municipio, ind]);

  const reenquadrar = useCallback(
    (animar = true) => {
      const m = mapa.current;
      const b = alvo();
      if (!m || !bboxValido(b)) return;
      m.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { padding: 64, maxZoom: 17, duration: animar ? 600 : 0 },
      );
    },
    [alvo],
  );

  const enquadrou = useRef(false);
  useEffect(() => {
    if (!enquadrou.current && ind && (!projeto || projetos)) {
      enquadrou.current = true;
      reenquadrar(false);
    }
  }, [ind, projetos, projeto, reenquadrar]);
  useEffect(() => {
    if (enquadrou.current) reenquadrar();
    // só quando alguém pede (troca de município, "abrir no mapa")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquadrar]);

  // --- Interação: popups ------------------------------------------------------
  useEffect(() => {
    const m = mapa.current;
    if (!m || !pronto) return;
    const idsRede = REDE.map((r) => r.id);

    const mostrarTrecho = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const id = String(f.properties?.id ?? '');
      const t = porIdRef.current.get(id);
      const tipo = (t?.tipo ?? f.properties?.t) as TipoObra;
      const linhas: [string, string][] = t
        ? [
            ['Município', t.municipio ?? SEM_DADO],
            ['Bairro', t.bairro ?? SEM_DADO],
            ['Tipo', ROTULO_TIPO[tipo] ?? SEM_DADO],
            ['Extensão', fmtM(t.extensao_m)],
            ['Diâmetro', fmtMm(t.diametro_mm)],
            ['Material', t.material ?? SEM_DADO],
            ['Pavimento', t.pavimento ?? SEM_DADO],
            ['Cadastro no GIS', fmtData(t.cadastro)],
          ]
        : [['Tipo', ROTULO_TIPO[tipo] ?? SEM_DADO]];
      popup.current
        ?.setLngLat(e.lngLat)
        .setDOMContent(popupConteudo(`Trecho ${id}`, linhas))
        .addTo(m);
    };

    const mostrarProjeto = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const id = String(f?.properties?.projeto ?? '');
      const p = projetosRef.current?.projetos.find((x) => x.id === id);
      if (!p) return;
      setProjeto(id);
      fixado.current = true;
      popup.current
        ?.setLngLat(e.lngLat)
        .setDOMContent(
          popupConteudo(
            `${p.id} · ${p.nome}`,
            [
              ['Etapa', p.etapa],
              ['Traçado', p.tracado_m ? fmtM(p.tracado_m) : SEM_DADO],
              ['Até a rede', fmtDistancia(p.distancia_rede_m)],
              ['Pendências', String(p.pendencias.length)],
            ],
            { texto: 'Ver ficha na carteira', fn: () => setAba('carteira') },
          ),
        )
        .addTo(m);
    };

    const mover = (e: MapLayerMouseEvent) => {
      if (medindoRef.current) return;
      m.getCanvas().style.cursor = 'pointer';
      if (!fixado.current) mostrarTrecho(e);
    };
    const sair = () => {
      if (medindoRef.current) return;
      m.getCanvas().style.cursor = '';
      if (!fixado.current) popup.current?.remove();
    };
    const clicarTrecho = (e: MapLayerMouseEvent) => {
      if (medindoRef.current) return;
      if (
        m.queryRenderedFeatures(e.point, {
          layers: ['proj-ponto', 'proj-linha', 'proj-area'].filter((l) => m.getLayer(l)),
        }).length
      )
        return;
      fixado.current = true;
      mostrarTrecho(e);
    };
    const clicarProjeto = (e: MapLayerMouseEvent) => {
      if (medindoRef.current) return;
      mostrarProjeto(e);
    };

    const projLayers = ['proj-ponto', 'proj-linha', 'proj-area'];
    for (const l of idsRede) {
      m.on('mousemove', l, mover);
      m.on('mouseleave', l, sair);
      m.on('click', l, clicarTrecho);
    }
    for (const l of projLayers) {
      m.on('click', l, clicarProjeto);
      m.on('mouseenter', l, () => !medindoRef.current && (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', l, sair);
    }
    return () => {
      for (const l of idsRede) {
        m.off('mousemove', l, mover);
        m.off('mouseleave', l, sair);
        m.off('click', l, clicarTrecho);
      }
      for (const l of projLayers) {
        m.off('click', l, clicarProjeto);
        m.off('mouseleave', l, sair);
      }
    };
  }, [pronto, setProjeto, setAba]);

  // --- Régua de medição ----------------------------------------------------------
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!medindo) {
      m.getCanvas().style.cursor = '';
      return;
    }
    popup.current?.remove();
    fixado.current = false;
    m.getCanvas().style.cursor = 'crosshair';
    const clique = (e: { lngLat: { lng: number; lat: number } }) =>
      setPontos((ps) => [...ps, [e.lngLat.lng, e.lngLat.lat]]);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMedindo(false);
    m.on('click', clique);
    window.addEventListener('keydown', esc);
    return () => {
      m.off('click', clique);
      window.removeEventListener('keydown', esc);
    };
  }, [medindo]);

  useEffect(() => {
    const fonte = mapa.current?.getSource('medida') as GeoJSONSource | undefined;
    if (!fonte) return;
    fonte.setData({
      type: 'FeatureCollection',
      features: [
        ...(pontos.length > 1
          ? [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'LineString' as const, coordinates: pontos },
              },
            ]
          : []),
        ...pontos.map((c) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: { type: 'Point' as const, coordinates: c },
        })),
      ],
    });
  }, [pontos, pronto]);

  const distancia = comprimento(pontos);

  return (
    <div className="relative h-[70vh] min-h-[420px] overflow-hidden rounded-md border border-border bg-surface-2">
      <div
        ref={container}
        className="h-full w-full"
        role="region"
        aria-label="Mapa da rede de água com extensões, melhorias, projetos propostos e ZEIS. Use as setas para mover e + ou − para aproximar."
      />
      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-5rem)] flex-col gap-2">
        {painelCamadas}
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <Botao
            icone={<Crosshair size={14} aria-hidden />}
            onClick={() => reenquadrar()}
            className="shadow-lg"
          >
            Reenquadrar
          </Botao>
          <Botao
            icone={<Ruler size={14} aria-hidden />}
            onClick={() => {
              setMedindo((v) => !v);
              setPontos([]);
            }}
            aria-pressed={medindo}
            className="shadow-lg"
          >
            {medindo ? 'Parar medição' : 'Medir'}
          </Botao>
        </div>
        {medindo && (
          <div
            role="status"
            className="pointer-events-auto rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg"
          >
            <p className="tabular text-sm font-semibold">
              {pontos.length > 1 ? fmtDistancia(distancia) : 'Clique no mapa'}
            </p>
            <p className="text-muted">Clique para adicionar pontos. Esc encerra.</p>
            {pontos.length > 0 && (
              <button
                type="button"
                onClick={() => setPontos([])}
                className="mt-1 inline-flex items-center gap-1 text-muted hover:text-text"
              >
                <X size={12} aria-hidden /> Limpar
              </button>
            )}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-8 left-3">
        <Legenda comRede={comRede} />
      </div>
    </div>
  );
}
