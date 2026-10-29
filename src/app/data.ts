// Carregamento sob demanda dos arquivos de public/data/, com cache por arquivo.

import { useCallback, useEffect, useState } from 'react';

export const URL_DADOS = `${import.meta.env.BASE_URL}data/`;

export class ArquivoAusente extends Error {
  constructor(public arquivo: string) {
    super(`Arquivo ${arquivo} não publicado`);
  }
}

const cache = new Map<string, Promise<unknown>>();

export function carregar<T>(arquivo: string): Promise<T> {
  let p = cache.get(arquivo);
  if (!p) {
    p = fetch(URL_DADOS + arquivo).then(async (r) => {
      if (r.status === 404) throw new ArquivoAusente(arquivo);
      if (!r.ok) throw new Error(`Falha ao carregar ${arquivo} (${r.status})`);
      const tipo = r.headers.get('content-type') ?? '';
      // Servidores de desenvolvimento devolvem index.html para caminhos inexistentes.
      if (tipo.includes('text/html')) throw new ArquivoAusente(arquivo);
      return r.json();
    });
    p.catch(() => cache.delete(arquivo));
    cache.set(arquivo, p);
  }
  return p as Promise<T>;
}

export type Estado<T> =
  | { status: 'carregando' }
  | { status: 'ok'; dados: T }
  | { status: 'ausente' }
  | { status: 'erro'; erro: Error };

export function useDados<T>(arquivo: string | null): Estado<T> & { tentarDeNovo: () => void } {
  const [estado, setEstado] = useState<Estado<T>>({ status: 'carregando' });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!arquivo) return;
    let vivo = true;
    setEstado({ status: 'carregando' });
    carregar<T>(arquivo).then(
      (dados) => vivo && setEstado({ status: 'ok', dados }),
      (erro: Error) =>
        vivo &&
        setEstado(
          erro instanceof ArquivoAusente ? { status: 'ausente' } : { status: 'erro', erro },
        ),
    );
    return () => {
      vivo = false;
    };
  }, [arquivo, tentativa]);

  const tentarDeNovo = useCallback(() => setTentativa((n) => n + 1), []);
  return { ...estado, tentarDeNovo };
}
