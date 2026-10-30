import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  deLista,
  ehCandidato,
  ErroPasta,
  impressao,
  LIMITE_ARQUIVOS,
  listarPasta,
  nomesUnicos,
  type HandleArquivo,
  type HandlePasta,
} from './arquivos';
import { PYODIDE_VERSAO, URL_PYODIDE } from './cliente';

const arquivo = (nome: string, conteudo = 'x', modificado = 1) =>
  new File([conteudo], nome, { lastModified: modificado });

function arquivoHandle(f: File): HandleArquivo {
  return { kind: 'file', name: f.name, getFile: async () => f };
}

/** Pasta falsa: valores são File (arquivo) ou outro objeto (subpasta). */
function pastaFalsa(
  nome: string,
  itens: Record<string, File | Record<string, unknown>>,
): HandlePasta {
  return {
    kind: 'directory',
    name: nome,
    async *entries() {
      for (const [n, v] of Object.entries(itens)) {
        yield [
          n,
          v instanceof File
            ? arquivoHandle(v)
            : pastaFalsa(n, v as Record<string, File | Record<string, unknown>>),
        ] as [string, HandleArquivo | HandlePasta];
      }
    },
  };
}

describe('ehCandidato', () => {
  it('aceita KMZ, KML e arquivos sem extensão (como o Google Earth exporta)', () => {
    for (const n of ['744407516885019490', 'Projeto.kmz', 'base.KML', 'Rede Prainha'])
      expect(ehCandidato(n), n).toBe(true);
  });
  it('ignora planilhas, PDFs, temporários do Office e arquivos ocultos', () => {
    for (const n of ['dados.xlsx', 'laudo.pdf', '~$projeto.kmz', '.DS_Store', 'v1.2'])
      expect(ehCandidato(n), n).toBe(false);
  });
});

describe('listarPasta', () => {
  it('lê subpastas, ignora pastas ocultas e o que não é KMZ/KML', async () => {
    const pasta = pastaFalsa('Interior', {
      '111': arquivo('111'),
      'planilha.xlsx': arquivo('planilha.xlsx'),
      '.tmp': { oculto: arquivo('oculto') },
      Projetos: { 'P1.kmz': arquivo('P1.kmz'), Antigos: { '222': arquivo('222') } },
    });
    const achados = await listarPasta(pasta);
    expect(achados.map((a) => a.caminho)).toEqual([
      '111',
      'Projetos/Antigos/222',
      'Projetos/P1.kmz',
    ]);
  });

  it('descarta arquivos vazios (ainda baixando do OneDrive)', async () => {
    const pasta = pastaFalsa('Interior', { '111': arquivo('111', ''), '222': arquivo('222') });
    expect((await listarPasta(pasta)).map((a) => a.nome)).toEqual(['222']);
  });

  it('recusa pasta com arquivos demais, para não varrer o computador inteiro', async () => {
    const muitos = Object.fromEntries(
      Array.from({ length: LIMITE_ARQUIVOS + 1 }, (_, i) => [`k${i}.kmz`, arquivo(`k${i}.kmz`)]),
    );
    await expect(listarPasta(pastaFalsa('Documentos', muitos))).rejects.toBeInstanceOf(ErroPasta);
  });
});

describe('deLista (input de arquivos)', () => {
  it('usa o caminho relativo e ignora pastas ocultas', () => {
    const a = arquivo('111');
    Object.defineProperty(a, 'webkitRelativePath', { value: 'Interior/Base/111' });
    const b = arquivo('222');
    Object.defineProperty(b, 'webkitRelativePath', { value: 'Interior/.git/222' });
    expect(deLista([a, b]).map((x) => x.caminho)).toEqual(['Interior/Base/111']);
  });
});

describe('nomesUnicos', () => {
  it('mantém todos os arquivos quando o mesmo nome aparece em subpastas diferentes', () => {
    const lista = [
      { nome: '111', caminho: 'a/111', arquivo: arquivo('111') },
      { nome: '111', caminho: 'b/111', arquivo: arquivo('111') },
      { nome: '222', caminho: '222', arquivo: arquivo('222') },
    ];
    expect(nomesUnicos(lista).map((x) => x.nome)).toEqual(['111', '111 (2)', '222']);
  });
});

describe('impressao', () => {
  const base = [{ nome: '1', caminho: '1', arquivo: arquivo('1', 'abc', 100) }];
  it('é estável para a mesma pasta', () => {
    expect(impressao(base)).toBe(impressao([{ ...base[0]! }]));
  });
  it('muda se o arquivo muda de tamanho, de data ou se aparece outro', () => {
    const ref = impressao(base);
    expect(impressao([{ ...base[0]!, arquivo: arquivo('1', 'abcd', 100) }])).not.toBe(ref);
    expect(impressao([{ ...base[0]!, arquivo: arquivo('1', 'abc', 101) }])).not.toBe(ref);
    expect(impressao([...base, { nome: '2', caminho: '2', arquivo: arquivo('2') }])).not.toBe(ref);
  });
});

describe('versão do Pyodide', () => {
  it('a do CDN é a mesma do pacote `pyodide` do package.json (os testes usam a do pacote)', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies.pyodide).toBe(PYODIDE_VERSAO);
    expect(URL_PYODIDE).toContain(`/v${PYODIDE_VERSAO}/`);
  });
});
