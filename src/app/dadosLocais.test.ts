import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandleArquivo, HandlePasta } from '@/lib/pasta/arquivos';
import type { SaidaPipeline } from '@/lib/pasta/pipeline';

const processar = vi.fn();
vi.mock('@/lib/pasta/cliente', () => ({ processar: (...a: unknown[]) => processar(...a) }));

const { ArquivoAusente, carregar, urlArquivo } = await import('./data');
const { urlLocal, useDadosLocais } = await import('./dadosLocais');

const saida = (rotulo: string): SaidaPipeline => ({
  arquivos: {
    'manifest.json': JSON.stringify({ rotulo }),
    'rede.geojson': '{"type":"FeatureCollection","features":[]}',
  },
  resumo: {
    arquivos: [],
    avisos: ['aviso de teste'],
    contagens: {},
    dados_ate: null,
    base_usada: '1',
  },
});

const kmz = (nome: string, conteudo = 'PK', modificado = 1) =>
  new File([conteudo], nome, { lastModified: modificado });

beforeEach(async () => {
  processar.mockReset();
  processar.mockResolvedValue(saida('da pasta'));
  URL.createObjectURL = vi.fn(() => 'blob:teste');
  URL.revokeObjectURL = vi.fn();
  await useDadosLocais.getState().voltarAosPublicados();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('importar arquivos', () => {
  it('passa a servir os dados da pasta no lugar dos publicados', async () => {
    const versao = useDadosLocais.getState().versao;
    await useDadosLocais.getState().importarArquivos([kmz('111'), kmz('222')]);

    const s = useDadosLocais.getState();
    expect(s.versao).toBe(versao + 1);
    expect(s.origem).toMatchObject({
      via: 'arquivos',
      nome: 'Arquivos selecionados',
      arquivosLidos: 2,
    });
    expect(s.resumo?.avisos).toEqual(['aviso de teste']);
    expect(await carregar('manifest.json')).toEqual({ rotulo: 'da pasta' });
    await expect(carregar('nao-existe.json')).rejects.toBeInstanceOf(ArquivoAusente);
    expect(processar.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it('as camadas do mapa recebem um endereço blob: dos dados locais', async () => {
    await useDadosLocais.getState().importarArquivos([kmz('111')]);
    expect(urlArquivo('rede.geojson')).toBe('blob:teste');
    expect(urlLocal('relevo.geojson')).toBeNull();
  });

  it('sem nenhum KMZ/KML, explica e mantém os dados publicados', async () => {
    await useDadosLocais.getState().importarArquivos([kmz('planilha.xlsx')]);
    const s = useDadosLocais.getState();
    expect(s.trabalho).toMatchObject({ status: 'erro' });
    expect(s.textos).toBeNull();
    expect(processar).not.toHaveBeenCalled();
  });

  it('erro do processamento aparece na tela e não troca os dados', async () => {
    processar.mockRejectedValue(new Error('Nenhum KMZ/KML encontrado em /raw.'));
    await useDadosLocais.getState().importarArquivos([kmz('relatorio')]);
    const s = useDadosLocais.getState();
    expect(s.trabalho).toEqual({ status: 'erro', mensagem: 'Nenhum KMZ/KML encontrado em /raw.' });
    expect(s.textos).toBeNull();
  });

  it('trocar a fonte invalida o cache de leitura', async () => {
    await useDadosLocais.getState().importarArquivos([kmz('111')]);
    expect(await carregar('manifest.json')).toEqual({ rotulo: 'da pasta' });

    processar.mockResolvedValue(saida('segunda leitura'));
    await useDadosLocais.getState().importarArquivos([kmz('111', 'PK2')]);
    expect(await carregar('manifest.json')).toEqual({ rotulo: 'segunda leitura' });
  });
});

describe('voltar aos publicados', () => {
  it('descarta os dados locais e volta a buscar em public/data', async () => {
    await useDadosLocais.getState().importarArquivos([kmz('111')]);
    await useDadosLocais.getState().voltarAosPublicados();
    expect(useDadosLocais.getState().textos).toBeNull();

    const fetchFalso = vi.fn(
      async () =>
        new Response('{"rotulo":"publicado"}', { headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchFalso);
    expect(await carregar('manifest.json')).toEqual({ rotulo: 'publicado' });
    expect(fetchFalso).toHaveBeenCalledOnce();
  });
});

describe('pasta conectada (File System Access API)', () => {
  function pastaFalsa(arquivos: File[]): HandlePasta {
    return {
      kind: 'directory',
      name: 'Interior',
      async *entries() {
        for (const f of arquivos) {
          const h: HandleArquivo = { kind: 'file', name: f.name, getFile: async () => f };
          yield [f.name, h] as [string, HandleArquivo];
        }
      },
      queryPermission: async () => 'granted',
    };
  }

  it('atualizar sem mudança na pasta não processa de novo; com mudança, processa', async () => {
    const arquivos = [kmz('111'), kmz('222')];
    vi.stubGlobal('showDirectoryPicker', async () => pastaFalsa(arquivos));
    vi.stubGlobal(
      'window',
      Object.assign(window, { showDirectoryPicker: async () => pastaFalsa(arquivos) }),
    );

    await useDadosLocais.getState().conectarPasta();
    expect(processar).toHaveBeenCalledTimes(1);
    expect(useDadosLocais.getState().origem).toMatchObject({ via: 'pasta', nome: 'Interior' });
    expect(useDadosLocais.getState().pastaLembrada).toBe('Interior');

    await useDadosLocais.getState().atualizarDaPasta();
    expect(processar).toHaveBeenCalledTimes(1);
    expect(useDadosLocais.getState().aviso).toMatch(/não mudou/);

    arquivos.push(kmz('333'));
    await useDadosLocais.getState().atualizarDaPasta();
    expect(processar).toHaveBeenCalledTimes(2);
    expect(useDadosLocais.getState().origem?.arquivosLidos).toBe(3);

    await useDadosLocais.getState().atualizarDaPasta(true);
    expect(processar).toHaveBeenCalledTimes(3);
  });

  it('fechar a janela de escolha da pasta não é erro', async () => {
    vi.stubGlobal(
      'window',
      Object.assign(window, {
        showDirectoryPicker: async () => {
          throw new DOMException('cancelado', 'AbortError');
        },
      }),
    );
    await useDadosLocais.getState().conectarPasta();
    expect(useDadosLocais.getState().trabalho).toEqual({ status: 'ocioso' });
    expect(processar).not.toHaveBeenCalled();
  });
});
