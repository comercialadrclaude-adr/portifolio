// Guarda no navegador (IndexedDB) a pasta conectada e o último resultado processado, para o
// painel abrir já com os dados da pasta. Se o armazenamento estiver bloqueado (janela privada,
// dados do site limpos), tudo continua funcionando, só sem lembrar entre as visitas.

import type { HandlePasta } from './arquivos';
import type { ResumoPipeline } from './pipeline';

const BANCO = 'painel-r4';
const LOJA = 'dados';

export interface OrigemDados {
  /** Nome da pasta (ou "Arquivos selecionados"). */
  nome: string;
  via: 'pasta' | 'arquivos';
  lidoEm: string;
  arquivosLidos: number;
  impressao: string;
}

export interface ResultadoSalvo {
  /** Versão do pipeline que gerou os dados (ver vite.config.ts). */
  assinatura: string;
  origem: OrigemDados;
  resumo: ResumoPipeline;
  arquivos: Record<string, string>;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rejeitar) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rejeitar(req.error);
  });
}

async function operar<T>(
  modo: IDBTransactionMode,
  fn: (loja: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  try {
    const db = await abrir();
    return await new Promise<T | null>((resolver, rejeitar) => {
      const tx = db.transaction(LOJA, modo);
      const req = fn(tx.objectStore(LOJA));
      tx.oncomplete = () => {
        db.close();
        resolver(req.result ?? null);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        rejeitar(tx.error);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Guarda a pasta e, à parte, o nome dela. O handle só é lido (`lerPasta`) quando a pessoa pede
 * para atualizar da pasta; ao abrir o painel basta o nome, que é texto simples. Assim um problema
 * do navegador com handles guardados nunca impede o painel de abrir.
 */
export async function guardarPasta(h: HandlePasta): Promise<void> {
  await operar('readwrite', (l) => l.put(h.name, 'pastaNome'));
  await operar('readwrite', (l) => l.put(h, 'pasta'));
}
export const lerNomePasta = () => operar<string>('readonly', (l) => l.get('pastaNome'));
export const lerPasta = () => operar<HandlePasta>('readonly', (l) => l.get('pasta'));
export const guardarResultado = (r: ResultadoSalvo) =>
  operar('readwrite', (l) => l.put(r, 'resultado'));
export const lerResultado = () => operar<ResultadoSalvo>('readonly', (l) => l.get('resultado'));

export async function esquecerTudo(): Promise<void> {
  await operar('readwrite', (l) => l.delete('pasta'));
  await operar('readwrite', (l) => l.delete('pastaNome'));
  await operar('readwrite', (l) => l.delete('resultado'));
}
