// Lado da página: abre o worker, repassa os arquivos e devolve o resultado do pipeline.

import type { SaidaPipeline } from './pipeline';
import type { MensagemWorker, PedidoWorker } from './worker';

/** Versão do Pyodide. Precisa ser a mesma do pacote `pyodide` em package.json (há um teste). */
export const PYODIDE_VERSAO = '0.29.5';

/** Cópia do Pyodide usada pelo navegador. VITE_PYODIDE_URL troca por uma cópia própria. */
export const URL_PYODIDE: string =
  import.meta.env.VITE_PYODIDE_URL ?? `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSAO}/full/`;

export class ErroProcessamento extends Error {}

export function processar(
  arquivos: PedidoWorker['arquivos'],
  opcoes: { modo?: PedidoWorker['modo']; aoProgredir?: (mensagem: string) => void } = {},
): Promise<SaidaPipeline> {
  return new Promise((resolver, rejeitar) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    // O worker segura centenas de MB (Python + dados): termina ao acabar.
    const encerrar = () => worker.terminate();

    worker.onmessage = (ev: MessageEvent<MensagemWorker>) => {
      const m = ev.data;
      if (m.tipo === 'progresso') return opcoes.aoProgredir?.(m.mensagem);
      encerrar();
      if (m.tipo === 'pronto') resolver(m.saida);
      else rejeitar(new ErroProcessamento(m.mensagem));
    };
    worker.onerror = () => {
      encerrar();
      rejeitar(
        new ErroProcessamento(
          'Não foi possível carregar o Python no navegador. Confira a conexão com a internet ' +
            '(os componentes vêm do jsDelivr) e tente de novo.',
        ),
      );
    };
    const pedido: PedidoWorker = {
      indexURL: new URL(URL_PYODIDE, window.location.href).href,
      arquivos,
      modo: opcoes.modo ?? 'completo',
    };
    worker.postMessage(pedido);
  });
}
