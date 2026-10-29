import { describe, expect, it } from 'vitest';
import { nomeArquivo, paraCsv } from './csv';

describe('CSV para Excel pt-BR', () => {
  it('usa ponto e vírgula, vírgula decimal e BOM', () => {
    const csv = paraCsv(
      ['a', 'b'],
      [
        [1.5, 'x;y'],
        [null, 'aspas "aqui"'],
      ],
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('a;b\r\n1,5;"x;y"\r\n;"aspas ""aqui"""');
  });

  it('gera nome de arquivo sem acento', () => {
    expect(nomeArquivo('inconsistencia', 'sem_material', 'São Francisco de Itabapoana')).toBe(
      'inconsistencia-sem_material-sao-francisco-de-itabapoana',
    );
  });
});
