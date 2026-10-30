// Leitura da pasta dos KMZ no navegador: File System Access API (Chrome, Edge) e, nos demais
// navegadores, a seleção de pasta/arquivos por <input>. Os arquivos nunca saem do computador.

export interface ArquivoPasta {
  nome: string;
  /** Caminho relativo à pasta escolhida (usado só para ordenar e para detectar mudanças). */
  caminho: string;
  arquivo: File;
}

/** Tipos mínimos da File System Access API, que ainda não está no lib.dom do TypeScript. */
export interface HandleArquivo {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}
export interface HandlePasta {
  kind: 'directory';
  name: string;
  entries(): AsyncIterable<[string, HandleArquivo | HandlePasta]>;
  queryPermission?(opcoes: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(opcoes: { mode: 'read' }): Promise<PermissionState>;
}

export const LIMITE_BYTES = 300 * 1024 * 1024;
/** Proteção contra apontar para uma pasta enorme (ex.: Documentos inteira). */
export const LIMITE_ARQUIVOS = 200;
export const LIMITE_VARREDURA = 20_000;
const PROFUNDIDADE_MAXIMA = 6;

export class ErroPasta extends Error {}

export function suportaPasta(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function escolherPasta(): Promise<HandlePasta> {
  const abrir = (
    window as unknown as {
      showDirectoryPicker: (o: { id: string; mode: 'read' }) => Promise<HandlePasta>;
    }
  ).showDirectoryPicker;
  return abrir.call(window, { id: 'painel-r4-kmz', mode: 'read' });
}

/** Pede (ou confirma) a permissão de leitura. Precisa de um gesto do usuário (clique). */
export async function garantirPermissao(pasta: HandlePasta): Promise<boolean> {
  const opcoes = { mode: 'read' } as const;
  if ((await pasta.queryPermission?.(opcoes)) === 'granted') return true;
  return (await pasta.requestPermission?.(opcoes)) === 'granted';
}

/**
 * KMZ, KML ou arquivo sem extensão (o Google Earth exporta assim). A identificação de verdade é
 * pelo conteúdo, feita pelo pipeline; aqui só se evita abrir planilhas, PDFs e arquivos temporários.
 */
export function ehCandidato(nome: string): boolean {
  if (nome.startsWith('.') || nome.startsWith('~$')) return false;
  const i = nome.lastIndexOf('.');
  const ext = i <= 0 ? '' : nome.slice(i).toLowerCase();
  return ext === '' || ext === '.kmz' || ext === '.kml';
}

async function varrer(
  pasta: HandlePasta,
  prefixo: string,
  profundidade: number,
  saida: ArquivoPasta[],
  visitados: { n: number },
): Promise<void> {
  for await (const [nome, h] of pasta.entries()) {
    if (++visitados.n > LIMITE_VARREDURA) {
      throw new ErroPasta('A pasta tem itens demais. Escolha a pasta que contém os KMZ.');
    }
    if (h.kind === 'directory') {
      if (profundidade < PROFUNDIDADE_MAXIMA && !nome.startsWith('.')) {
        await varrer(h, `${prefixo}${nome}/`, profundidade + 1, saida, visitados);
      }
    } else if (ehCandidato(nome)) {
      saida.push({ nome, caminho: `${prefixo}${nome}`, arquivo: await h.getFile() });
    }
  }
}

/** Lê a pasta e as subpastas e devolve os candidatos a KMZ/KML. */
export async function listarPasta(pasta: HandlePasta): Promise<ArquivoPasta[]> {
  const saida: ArquivoPasta[] = [];
  await varrer(pasta, '', 0, saida, { n: 0 });
  return filtrar(saida);
}

/** Arquivos vindos de <input type="file"> (com ou sem `webkitdirectory`). */
export function deLista(arquivos: Iterable<File>): ArquivoPasta[] {
  const saida: ArquivoPasta[] = [];
  for (const arquivo of arquivos) {
    const caminho = arquivo.webkitRelativePath || arquivo.name;
    const partes = caminho.split('/');
    // pastas ocultas (.git, .tmp) ficam de fora, como na leitura direta da pasta
    if (partes.slice(0, -1).some((p) => p.startsWith('.'))) continue;
    if (ehCandidato(arquivo.name)) saida.push({ nome: arquivo.name, caminho, arquivo });
  }
  return filtrar(saida);
}

function filtrar(arquivos: ArquivoPasta[]): ArquivoPasta[] {
  const aceitos = arquivos
    .filter((a) => a.arquivo.size > 0 && a.arquivo.size <= LIMITE_BYTES)
    .sort((a, b) => a.caminho.localeCompare(b.caminho, 'pt-BR', { numeric: true }));
  if (aceitos.length > LIMITE_ARQUIVOS) {
    throw new ErroPasta(
      `A pasta tem ${aceitos.length} arquivos KMZ/KML (o máximo é ${LIMITE_ARQUIVOS}). ` +
        'Escolha a pasta que contém só os arquivos do portfólio.',
    );
  }
  return aceitos;
}

/** Nomes distintos para o pipeline, que guarda tudo numa pasta só: "a", "a (2)", "a (3)". */
export function nomesUnicos(arquivos: ArquivoPasta[]): { nome: string; arquivo: File }[] {
  const usados = new Map<string, number>();
  return arquivos.map((a) => {
    const n = (usados.get(a.nome) ?? 0) + 1;
    usados.set(a.nome, n);
    return { nome: n === 1 ? a.nome : `${a.nome} (${n})`, arquivo: a.arquivo };
  });
}

/** Identifica o estado da pasta (nome, tamanho e data de cada arquivo) sem ler o conteúdo. */
export function impressao(arquivos: ArquivoPasta[]): string {
  // FNV-1a de 52 bits: serve para saber "mudou ou não", não para segurança.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const a of arquivos) {
    const s = `${a.caminho}|${a.arquivo.size}|${a.arquivo.lastModified}\n`;
    for (let i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0;
      h2 = Math.imul(h2 + s.charCodeAt(i), 0x85ebca6b) >>> 0;
    }
  }
  return `${arquivos.length}-${h1.toString(16)}${h2.toString(16)}`;
}
