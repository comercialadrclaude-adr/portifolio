// Contratos dos arquivos em public/data/ (gerados por scripts/build_dataset.py).

export type TipoObra =
  'extensao' | 'melhoria' | 'substituicao' | 'encontrada' | 'doada' | 'existente';

export type Gravidade = 'Alta' | 'Média' | 'Baixa';
export type Uso = 'Projeto' | 'Referência' | 'Arquivar' | 'Excluir';
export type Bbox = [number, number, number, number];

export interface Manifest {
  produto: string;
  organizacao: string;
  versao_pipeline: string;
  modo: 'agregado' | 'completo';
  sintetico: boolean;
  dados_ate: string | null;
  gerado_em: string;
  base_usada: string | null;
  /** Hash de atributos + coordenadas da base (identifica a versão). */
  base_hash: string | null;
  avisos: string[];
  fontes: { arquivo: string; sha256: string; tipo: string; feicoes: number }[];
  contagens: Record<string, number | Record<string, number>>;
  arquivos: string[];
}

export interface Mensal {
  mes: string;
  extensoes_km: number;
  extensoes_trechos: number;
}

export interface Preenchimento {
  material: number;
  diametro: number;
  funcao: number;
  pavimento: number;
  profundidade: number;
  bairro: number;
}

export interface IndicadorMunicipio {
  nome: string;
  trechos: number;
  rede_km: number;
  extensoes_km: number;
  extensoes_trechos: number;
  extensoes_pct: number;
  melhorias_km: number;
  completude_pct: number;
  trechos_completos: number;
  por_tipo: Record<TipoObra, { km: number; trechos: number }>;
  mensal: Mensal[];
  extensoes_sem_data: number;
  preenchimento: Preenchimento;
  projetos: number;
  projetos_tracado_m: number;
  bbox: Bbox | null;
}

export interface Indicadores {
  todos: IndicadorMunicipio;
  municipios: IndicadorMunicipio[];
  rotulos_tipo: Record<TipoObra, string>;
}

export interface Pendencia {
  codigo: string;
  texto: string;
}

export interface Projeto {
  id: string;
  nome: string;
  arquivo: string;
  municipio: string | null;
  bairro: string | null;
  etapa: string;
  etapa_inferida: boolean;
  tracado_m: number;
  area_ha: number;
  areas: number;
  distancia_rede_m: number | null;
  trecho_interligacao: string | null;
  distancia_zeis_m: number | null;
  zeis_proxima: string | null;
  dentro_zeis: boolean;
  ponto_referencia: [number, number];
  referencia_e_interligacao: boolean;
  feicoes: Record<string, number>;
  bbox: Bbox | null;
  solicitante: string | null;
  motivo: string | null;
  ligacoes_previstas: number | null;
  custo_estimado_brl: number | null;
  responsavel: string | null;
  data_prevista: string | null;
  data_real: string | null;
  custo_por_ligacao_brl: number | null;
  custo_por_metro_brl: number | null;
  pendencias: Pendencia[];
}

export interface Projetos {
  etapas: string[];
  projetos: Projeto[];
}

export interface Zeis {
  id: string;
  nome: string;
  municipio: string | null;
  area_ha: number;
  rede_m: number;
  densidade_m_ha: number | null;
  extensoes_m: number;
  trechos: number;
  bbox: Bbox | null;
}

export interface Inconsistencia {
  codigo: string;
  problema: string;
  gravidade: Gravidade;
  acao: string;
  total: number;
  por_municipio: Record<string, number>;
  trechos?: string[];
}

export interface ItemPortfolio {
  arquivo: string;
  documento: string | null;
  tipo: string;
  conteudo: string;
  feicoes: number;
  trechos_base: number;
  pontos: number;
  linhas: number;
  poligonos: number;
  base_igual_a_usada: boolean | null;
  duplicado_de: string | null;
  uso: Uso;
}

export interface Trecho {
  id: string;
  globalid: string | null;
  municipio: string | null;
  bairro: string | null;
  tipo: TipoObra;
  extensao_m: number | null;
  comprimento_m: number;
  diametro_mm: number | null;
  material: string | null;
  material_codigo: string | null;
  pavimento: string | null;
  funcao: string | null;
  profundidade_m: number | null;
  situacao: string | null;
  cadastro: string | null;
}
