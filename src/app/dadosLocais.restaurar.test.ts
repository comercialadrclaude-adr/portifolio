import type { ResultadoSalvo } from '@/lib/pasta/armazenamento';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const lerResultado = vi.fn();
const lerNomePasta = vi.fn();
const lerPasta = vi.fn();
vi.mock('@/lib/pasta/armazenamento', () => ({
  lerResultado: () => lerResultado(),
  lerNomePasta: () => lerNomePasta(),
  lerPasta: () => lerPasta(),
  guardarPasta: vi.fn(),
  guardarResultado: vi.fn(),
  esquecerTudo: vi.fn(),
}));
const processar = vi.fn();
vi.mock('@/lib/pasta/cliente', () => ({ processar: (...a: unknown[]) => processar(...a) }));

const { useDadosLocais } = await import('./dadosLocais');

const salvo = (assinatura: string): ResultadoSalvo => ({
  assinatura,
  origem: {
    nome: 'Interior',
    via: 'pasta',
    lidoEm: '2026-10-30T12:00:00.000Z',
    arquivosLidos: 12,
    impressao: '12-abc',
  },
  resumo: { arquivos: [], avisos: [], contagens: {}, dados_ate: '2026-10-01', base_usada: '1' },
  arquivos: { 'manifest.json': '{"modo":"completo"}' },
});

beforeEach(async () => {
  lerResultado.mockReset();
  lerNomePasta.mockReset();
  lerNomePasta.mockResolvedValue(null);
  lerPasta.mockReset();
  lerPasta.mockResolvedValue(null);
  processar.mockReset();
  await useDadosLocais.getState().voltarAosPublicados();
});

describe('restaurar ao abrir o painel', () => {
  it('abre já com os dados da pasta lidos na visita anterior', async () => {
    lerResultado.mockResolvedValue(salvo(__PIPELINE_ASSINATURA__));
    lerNomePasta.mockResolvedValue('Interior');
    await useDadosLocais.getState().restaurar();

    const s = useDadosLocais.getState();
    expect(s.origem?.nome).toBe('Interior');
    expect(s.textos).toEqual({ 'manifest.json': '{"modo":"completo"}' });
    expect(s.pastaLembrada).toBe('Interior');
    expect(s.desatualizado).toBe(false);
    // abrir o painel nunca desserializa o handle da pasta: ele só é lido ao atualizar
    expect(lerPasta).not.toHaveBeenCalled();
  });

  it('descarta dados de uma versão anterior do painel e pede para ler a pasta de novo', async () => {
    lerResultado.mockResolvedValue(salvo('assinatura-antiga'));
    await useDadosLocais.getState().restaurar();

    const s = useDadosLocais.getState();
    expect(s.textos).toBeNull();
    expect(s.origem).toBeNull();
    expect(s.desatualizado).toBe(true);
    expect(s.aviso).toMatch(/Leia a pasta de novo/);
  });

  it('sem nada guardado, continua com os dados publicados', async () => {
    lerResultado.mockResolvedValue(null);
    await useDadosLocais.getState().restaurar();
    const s = useDadosLocais.getState();
    expect(s.textos).toBeNull();
    expect(s.desatualizado).toBe(false);
  });

  it('ao atualizar, lê o handle guardado só nesse momento e reprocessa', async () => {
    lerResultado.mockResolvedValue(salvo(__PIPELINE_ASSINATURA__));
    lerNomePasta.mockResolvedValue('Interior');
    await useDadosLocais.getState().restaurar();

    const arquivo = new File(['PK'], '111');
    lerPasta.mockResolvedValue({
      kind: 'directory',
      name: 'Interior',
      async *entries() {
        yield ['111', { kind: 'file', name: '111', getFile: async () => arquivo }];
      },
      queryPermission: async () => 'granted',
    });
    processar.mockResolvedValue({
      arquivos: { 'manifest.json': '{"modo":"completo"}' },
      resumo: { arquivos: [], avisos: [], contagens: {}, dados_ate: null, base_usada: '111' },
    });

    await useDadosLocais.getState().atualizarDaPasta();
    expect(lerPasta).toHaveBeenCalledOnce();
    expect(processar).toHaveBeenCalledOnce();
    expect(useDadosLocais.getState().origem).toMatchObject({ nome: 'Interior', arquivosLidos: 1 });
  });
});
