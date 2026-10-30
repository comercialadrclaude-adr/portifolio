// Roda o pipeline Python (scripts/) dentro de uma instância do Pyodide.
// Função pura sobre o Pyodide: o worker do navegador e os testes em Node usam o mesmo código.

import type { PyodideInterface } from 'pyodide';
import projetosMeta from '../../../data/projetos_meta.json?raw';
import buildDataset from '../../../scripts/build_dataset.py?raw';
import extractKmz from '../../../scripts/extract_kmz.py?raw';
import geo from '../../../scripts/geo.py?raw';
import limpeza from '../../../scripts/limpeza.py?raw';
import navegador from '../../../scripts/navegador.py?raw';
import quality from '../../../scripts/quality.py?raw';

/** Bibliotecas do pipeline que o Pyodide precisa carregar antes de rodar. */
export const PACOTES = ['numpy', 'shapely', 'pyproj', 'lxml'];

const SCRIPTS: Record<string, string> = {
  'build_dataset.py': buildDataset,
  'extract_kmz.py': extractKmz,
  'geo.py': geo,
  'limpeza.py': limpeza,
  'navegador.py': navegador,
  'quality.py': quality,
};

export interface EntradaArquivo {
  nome: string;
  bytes: Uint8Array;
}

export interface ResumoPipeline {
  arquivos: string[];
  avisos: string[];
  contagens: Record<string, unknown>;
  dados_ate: string | null;
  base_usada: string | null;
}

export interface SaidaPipeline {
  /** Conteúdo (texto JSON) de cada arquivo que `public/data/` teria. */
  arquivos: Record<string, string>;
  resumo: ResumoPipeline;
}

/** Erro esperado do pipeline (pasta sem KMZ, saída bloqueada por privacidade). */
export class ErroPipeline extends Error {}

export interface OpcoesPipeline {
  /** `completo` inclui a rede trecho a trecho (fica só neste navegador). */
  modo?: 'agregado' | 'completo';
  sintetico?: boolean;
  /** Ficha manual dos projetos (JSON). Padrão: data/projetos_meta.json do repositório. */
  meta?: string;
}

type FS = PyodideInterface['FS'];

function limparPasta(fs: FS, caminho: string) {
  if (!fs.analyzePath(caminho).exists) return;
  for (const nome of fs.readdir(caminho)) {
    if (nome === '.' || nome === '..') continue;
    const filho = `${caminho}/${nome}`;
    if (fs.isDir(fs.stat(filho).mode)) limparPasta(fs, filho);
    else fs.unlink(filho);
  }
  fs.rmdir(caminho);
}

export function executarPipeline(
  py: PyodideInterface,
  entrada: EntradaArquivo[],
  opcoes: OpcoesPipeline = {},
): SaidaPipeline {
  const fs = py.FS;
  const { modo = 'completo', sintetico = false, meta = projetosMeta } = opcoes;

  for (const p of ['/raw', '/out', '/scripts']) limparPasta(fs, p);
  for (const p of ['/raw', '/out', '/scripts']) fs.mkdir(p);
  for (const [nome, texto] of Object.entries(SCRIPTS)) fs.writeFile(`/scripts/${nome}`, texto);
  fs.writeFile('/meta.json', meta);
  for (const a of entrada) fs.writeFile(`/raw/${a.nome}`, a.bytes);

  try {
    py.runPython("import sys\nif '/scripts' not in sys.path: sys.path.insert(0, '/scripts')");
    const modulo = py.pyimport('navegador');
    let bruto: string;
    try {
      bruto = modulo.processar('/raw', '/out', '/meta.json', modo, sintetico) as string;
    } finally {
      modulo.destroy();
    }
    const resposta = JSON.parse(bruto) as
      ({ ok: true } & ResumoPipeline) | { ok: false; erro: string };
    if (!resposta.ok) throw new ErroPipeline(resposta.erro);

    const arquivos: Record<string, string> = {};
    for (const nome of fs.readdir('/out')) {
      if (nome === '.' || nome === '..') continue;
      arquivos[nome] = fs.readFile(`/out/${nome}`, { encoding: 'utf8' });
    }
    const { ok: _ok, ...resumo } = resposta;
    void _ok;
    return { arquivos, resumo };
  } finally {
    // Os KMZ brutos não ficam na memória do worker depois da execução.
    limparPasta(fs, '/raw');
    limparPasta(fs, '/out');
  }
}
