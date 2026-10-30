// Web Worker: carrega o Pyodide (Python no navegador) e roda o pipeline fora da thread principal,
// para a tela continuar respondendo. Os arquivos chegam como `File` e são lidos aqui dentro.

import { ErroPipeline, executarPipeline, PACOTES, type SaidaPipeline } from './pipeline';

export interface PedidoWorker {
  /** Endereço (absoluto, terminado em "/") de uma cópia do Pyodide. */
  indexURL: string;
  arquivos: { nome: string; arquivo: File }[];
  modo: 'agregado' | 'completo';
}

export type MensagemWorker =
  | { tipo: 'progresso'; mensagem: string }
  | { tipo: 'pronto'; saida: SaidaPipeline }
  | { tipo: 'erro'; mensagem: string };

const contexto = self as unknown as {
  postMessage(m: MensagemWorker): void;
  onmessage: ((e: MessageEvent<PedidoWorker>) => void) | null;
};

const avisar = (mensagem: string) => contexto.postMessage({ tipo: 'progresso', mensagem });

/** Última linha da mensagem de erro do Python (o resto é o traceback). */
function resumirErro(e: unknown): string {
  if (e instanceof ErroPipeline) return e.message;
  const texto = e instanceof Error ? e.message : String(e);
  const linhas = texto.split('\n').filter((l) => l.trim());
  return linhas[linhas.length - 1] ?? 'Erro desconhecido.';
}

contexto.onmessage = async (ev) => {
  const { indexURL, arquivos, modo } = ev.data;
  try {
    avisar('Carregando o Python (na primeira vez baixa cerca de 20 MB; depois fica guardado)…');
    const { loadPyodide } = (await import(
      /* @vite-ignore */ `${indexURL}pyodide.mjs`
    )) as typeof import('pyodide');
    const py = await loadPyodide({ indexURL });
    avisar('Carregando as bibliotecas de geometria…');
    await py.loadPackage(PACOTES);

    avisar(`Lendo ${arquivos.length} arquivo${arquivos.length === 1 ? '' : 's'}…`);
    const entrada = [];
    for (const a of arquivos) {
      try {
        entrada.push({ nome: a.nome, bytes: new Uint8Array(await a.arquivo.arrayBuffer()) });
      } catch {
        throw new ErroPipeline(
          `Não foi possível ler o arquivo "${a.nome}". Se ele está só na nuvem, abra-o ou ` +
            'marque "Sempre manter neste dispositivo" no OneDrive e tente de novo.',
        );
      }
    }

    avisar('Calculando indicadores, projetos e qualidade do cadastro…');
    contexto.postMessage({ tipo: 'pronto', saida: executarPipeline(py, entrada, { modo }) });
  } catch (e) {
    contexto.postMessage({ tipo: 'erro', mensagem: resumirErro(e) });
  }
};
