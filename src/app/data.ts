// Carregamento sob demanda dos arquivos de dados, com cache por arquivo.
// A fonte é public/data/ (dados publicados) ou, quando o usuário conectou a pasta dos KMZ,
// os dados processados neste navegador (ver dadosLocais.ts).

import { useCallback, useEffect, useState } from 'react';
import { urlLocal, useDadosLocais } from './dadosLocais';

export const URL_DADOS = `${import.meta.env.BASE_URL}data/`;

export class ArquivoAusente extends Error {
  constructor(public arquivo: string) {
    super(`Arquivo ${arquivo} não publicado`);
  }
}

const cache = new Map<string, Promise<unknown>>();

// Trocar de fonte (publicada ↔ pasta) invalida tudo o que foi lido.
useDadosLocais.subscribe((atual, anterior) => {
  if (atual.versao !== anterior.versao) cache.clear();
});

const VAZIO = 'data:application/json,{"type":"FeatureCollection","features":[]}';

/** Endereço de um arquivo de dados para quem busca por URL (as camadas do mapa). */
export function urlArquivo(arquivo: string): string {
  if (useDadosLocais.getState().textos) return urlLocal(arquivo) ?? VAZIO;
  return new URL(URL_DADOS + arquivo, window.location.href).href;
}

function ler(arquivo: string): Promise<unknown> {
  const textos = useDadosLocais.getState().textos;
  if (textos) {
    const texto = textos[arquivo];
    if (texto === undefined) return Promise.reject(new ArquivoAusente(arquivo));
    return Promise.resolve().then(() => JSON.parse(texto) as unknown);
  }
  return fetch(URL_DADOS + arquivo).then(async (r) => {
    if (r.status === 404) throw new ArquivoAusente(arquivo);
    if (!r.ok) throw new Error(`Falha ao carregar ${arquivo} (${r.status})`);
    const tipo = r.headers.get('content-type') ?? '';
    // Servidores de desenvolvimento devolvem index.html para caminhos inexistentes.
    if (tipo.includes('text/html')) throw new ArquivoAusente(arquivo);
    return r.json() as Promise<unknown>;
  });
}

export function carregar<T>(arquivo: string): Promise<T> {
  let p = cache.get(arquivo);
  if (!p) {
    const lido = ler(arquivo);
    p = lido;
    lido.catch(() => cache.get(arquivo) === lido && cache.delete(arquivo));
    cache.set(arquivo, lido);
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
  const versao = useDadosLocais((s) => s.versao);

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
  }, [arquivo, tentativa, versao]);

  const tentarDeNovo = useCallback(() => setTentativa((n) => n + 1), []);
  return { ...estado, tentarDeNovo };
}
