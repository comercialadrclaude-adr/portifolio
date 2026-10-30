// Dados lidos da pasta do usuário. Quando há dados locais, o painel usa eles no lugar dos arquivos
// publicados em public/data/. Tudo fica neste navegador: nada é enviado a servidor algum.

import { create } from 'zustand';
import {
  deLista,
  ErroPasta,
  escolherPasta,
  garantirPermissao,
  impressao,
  listarPasta,
  nomesUnicos,
  suportaPasta,
  type ArquivoPasta,
  type HandlePasta,
} from '@/lib/pasta/arquivos';
import {
  esquecerTudo,
  guardarPasta,
  guardarResultado,
  lerNomePasta,
  lerPasta,
  lerResultado,
  type OrigemDados,
  type ResultadoSalvo,
} from '@/lib/pasta/armazenamento';
import { processar } from '@/lib/pasta/cliente';
import type { ResumoPipeline } from '@/lib/pasta/pipeline';

export type Trabalho =
  | { status: 'ocioso' }
  | { status: 'lendo'; mensagem: string }
  | { status: 'erro'; mensagem: string };

interface Estado {
  /** Muda a cada troca de fonte (publicada ↔ pasta): quem lê dados refaz a leitura. */
  versao: number;
  /** Conteúdo dos arquivos de dados da pasta; `null` = usando os dados publicados. */
  textos: Record<string, string> | null;
  origem: OrigemDados | null;
  resumo: ResumoPipeline | null;
  trabalho: Trabalho;
  /** Mensagem informativa da última tentativa (ex.: "a pasta não mudou"). */
  aviso: string | null;
  /** Havia dados guardados de uma versão anterior do painel; é preciso ler a pasta de novo. */
  desatualizado: boolean;
  /** Nome da pasta lembrada neste navegador (permite "Atualizar" com um clique). */
  pastaLembrada: string | null;

  restaurar: () => Promise<void>;
  conectarPasta: () => Promise<void>;
  atualizarDaPasta: (forcar?: boolean) => Promise<void>;
  importarArquivos: (arquivos: File[]) => Promise<void>;
  voltarAosPublicados: () => Promise<void>;
}

const INICIAL = {
  versao: 0,
  textos: null,
  origem: null,
  resumo: null,
  trabalho: { status: 'ocioso' } as Trabalho,
  aviso: null,
  desatualizado: false,
  pastaLembrada: null,
};

export const suportaConexaoDePasta = suportaPasta;

/** Nome da origem quando os arquivos foram escolhidos soltos (sem uma pasta). */
const NOME_ARQUIVOS = 'Arquivos selecionados';

/** Como chamar a origem na tela: "Pasta “Interior”" ou "Arquivos selecionados". */
export function rotuloOrigem(o: OrigemDados): string {
  return o.nome === NOME_ARQUIVOS ? NOME_ARQUIVOS : `Pasta “${o.nome}”`;
}

/** "da pasta “Interior”" ou "dos arquivos selecionados", para frases corridas. */
export function origemEmFrase(o: OrigemDados): string {
  return o.nome === NOME_ARQUIVOS ? 'dos arquivos selecionados' : `da pasta “${o.nome}”`;
}

let pastaAtual: HandlePasta | null = null;

// --- Endereços temporários para o mapa (o MapLibre busca as camadas por URL) -------------------
const urls = new Map<string, string>();

function soltarUrls() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
}

/** Endereço (blob:) de um arquivo de dados da pasta; `null` se ele não existe nos dados locais. */
export function urlLocal(arquivo: string): string | null {
  const texto = useDadosLocais.getState().textos?.[arquivo];
  if (texto === undefined) return null;
  let url = urls.get(arquivo);
  if (!url) {
    url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    urls.set(arquivo, url);
  }
  return url;
}

// ----------------------------------------------------------------------------------------------

const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useDadosLocais = create<Estado>()((set, get) => {
  function aplicar(r: ResultadoSalvo) {
    soltarUrls();
    set((s) => ({
      versao: s.versao + 1,
      textos: r.arquivos,
      origem: r.origem,
      resumo: r.resumo,
      trabalho: { status: 'ocioso' },
      desatualizado: false,
      aviso: null,
    }));
  }

  async function processarLista(lista: ArquivoPasta[], origem: Pick<OrigemDados, 'nome' | 'via'>) {
    if (lista.length === 0) {
      set({
        trabalho: {
          status: 'erro',
          mensagem: 'Nenhum arquivo KMZ ou KML encontrado. Confira se escolheu a pasta certa.',
        },
      });
      return;
    }
    set({ aviso: null, trabalho: { status: 'lendo', mensagem: 'Preparando…' } });
    try {
      const saida = await processar(nomesUnicos(lista), {
        aoProgredir: (mensagem) => set({ trabalho: { status: 'lendo', mensagem } }),
      });
      const resultado: ResultadoSalvo = {
        assinatura: __PIPELINE_ASSINATURA__,
        origem: {
          ...origem,
          lidoEm: new Date().toISOString(),
          arquivosLidos: lista.length,
          impressao: impressao(lista),
        },
        resumo: saida.resumo,
        arquivos: saida.arquivos,
      };
      aplicar(resultado);
      await guardarResultado(resultado);
    } catch (e) {
      set({ trabalho: { status: 'erro', mensagem: mensagemDe(e) } });
    }
  }

  async function lerPastaEProcessar(pasta: HandlePasta, forcar: boolean) {
    set({ aviso: null, trabalho: { status: 'lendo', mensagem: 'Lendo a pasta…' } });
    let lista: ArquivoPasta[];
    try {
      lista = await listarPasta(pasta);
    } catch (e) {
      set({
        trabalho: {
          status: 'erro',
          mensagem:
            e instanceof ErroPasta ? e.message : `Não foi possível ler a pasta: ${mensagemDe(e)}`,
        },
      });
      return;
    }
    const { origem } = get();
    if (!forcar && origem?.via === 'pasta' && origem.impressao === impressao(lista)) {
      set({
        trabalho: { status: 'ocioso' },
        aviso: 'A pasta não mudou desde a última leitura. Os dados já estão atualizados.',
      });
      return;
    }
    await processarLista(lista, { nome: pasta.name, via: 'pasta' });
  }

  return {
    ...INICIAL,

    async restaurar() {
      // Só o resultado e o nome da pasta (texto): o handle é lido sob demanda, em atualizarDaPasta.
      const [salvo, nomePasta] = await Promise.all([lerResultado(), lerNomePasta()]);
      set({ pastaLembrada: nomePasta });
      if (salvo?.assinatura === __PIPELINE_ASSINATURA__) aplicar(salvo);
      else if (salvo) {
        // o painel foi atualizado: os dados guardados têm o formato da versão anterior
        set({
          desatualizado: true,
          aviso:
            'O painel foi atualizado desde a última leitura. Leia a pasta de novo para ver os dados da pasta.',
        });
      }
    },

    async conectarPasta() {
      let pasta: HandlePasta;
      try {
        pasta = await escolherPasta();
      } catch (e) {
        // fechar a janela de escolha não é erro
        if (e instanceof DOMException && e.name === 'AbortError') return;
        set({ trabalho: { status: 'erro', mensagem: mensagemDe(e) } });
        return;
      }
      pastaAtual = pasta;
      await guardarPasta(pasta);
      set({ pastaLembrada: pasta.name });
      await lerPastaEProcessar(pasta, true);
    },

    async atualizarDaPasta(forcar = false) {
      pastaAtual ??= await lerPasta();
      if (!pastaAtual) return get().conectarPasta();
      if (!(await garantirPermissao(pastaAtual))) {
        set({
          trabalho: {
            status: 'erro',
            mensagem:
              'O navegador não liberou a leitura da pasta. Clique em "Atualizar" e permita.',
          },
        });
        return;
      }
      await lerPastaEProcessar(pastaAtual, forcar);
    },

    async importarArquivos(arquivos) {
      let lista: ArquivoPasta[];
      try {
        lista = deLista(arquivos);
      } catch (e) {
        set({ trabalho: { status: 'erro', mensagem: mensagemDe(e) } });
        return;
      }
      // Seleção de pasta por <input>: a primeira parte do caminho relativo é o nome da pasta.
      const raiz = lista[0]?.caminho.includes('/') ? lista[0].caminho.split('/')[0] : null;
      await processarLista(lista, { nome: raiz ?? NOME_ARQUIVOS, via: 'arquivos' });
    },

    async voltarAosPublicados() {
      soltarUrls();
      pastaAtual = null;
      await esquecerTudo();
      set((s) => ({ ...INICIAL, versao: s.versao + 1 }));
    },
  };
});
