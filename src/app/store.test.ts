import { describe, expect, it } from 'vitest';
import { CAMADAS_PADRAO, escreverUrl, lerUrl } from './store';

describe('filtro na URL', () => {
  it('lê aba, município e projeto', () => {
    const e = lerUrl('?aba=mapa&municipio=Rio%20Bonito&projeto=P1');
    expect(e).toMatchObject({ aba: 'mapa', municipio: 'Rio Bonito', projeto: 'P1' });
    expect(e.camadas).toEqual(CAMADAS_PADRAO);
  });

  it('ignora aba inválida', () => {
    expect(lerUrl('?aba=xyz').aba).toBe('visao-geral');
  });

  it('ida e volta preserva o estado', () => {
    const e = {
      aba: 'carteira' as const,
      municipio: 'São Francisco de Itabapoana',
      projeto: 'P2',
      camadas: ['projetos' as const],
    };
    expect(lerUrl(escreverUrl(e))).toEqual(e);
  });

  it('omite valores padrão e codifica espaço como %20', () => {
    expect(
      escreverUrl({
        aba: 'visao-geral',
        municipio: null,
        projeto: null,
        camadas: [...CAMADAS_PADRAO],
      }),
    ).toBe('');
    expect(
      escreverUrl({
        aba: 'visao-geral',
        municipio: 'Rio Bonito',
        projeto: null,
        camadas: [...CAMADAS_PADRAO],
      }),
    ).toBe('?municipio=Rio%20Bonito');
  });
});
