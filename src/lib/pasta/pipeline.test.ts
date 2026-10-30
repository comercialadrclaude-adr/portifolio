// @vitest-environment node
// Conferência do pipeline dentro do Pyodide contra o pipeline nativo (CPython).
//
// PYODIDE_INDEX_URL aponta para uma cópia do Pyodide 0.29 (pasta local ou
// https://cdn.jsdelivr.net/pyodide/v0.29.5/full/). Sem ela, o teste é pulado.
// Os dados vêm de `npm run data:fixture` (.fixture/raw lido pelos dois lados).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { beforeAll, describe, expect, it } from 'vitest';
import { executarPipeline, ErroPipeline, PACOTES, type EntradaArquivo } from './pipeline';

const INDEX = process.env.PYODIDE_INDEX_URL;
const RAW = resolve('.fixture/raw');
const NATIVO = resolve('.fixture/data');
const pronto = !!INDEX && existsSync(RAW) && existsSync(NATIVO);

function entrada(): EntradaArquivo[] {
  return readdirSync(RAW).map((nome) => ({
    nome,
    bytes: new Uint8Array(readFileSync(join(RAW, nome))),
  }));
}

describe.skipIf(!pronto)('pipeline no Pyodide × pipeline nativo', () => {
  let py: PyodideInterface;

  beforeAll(async () => {
    py = await loadPyodide({ indexURL: INDEX! });
    await py.loadPackage(PACOTES);
  }, 240_000);

  it('gera os mesmos arquivos, byte a byte (exceto a hora de geração)', () => {
    const { arquivos, resumo } = executarPipeline(py, entrada(), { sintetico: true, meta: '{}' });
    const esperados = readdirSync(NATIVO).sort();
    expect(Object.keys(arquivos).sort()).toEqual(esperados);
    expect(resumo.contagens.trechos).toBeGreaterThan(0);

    for (const nome of esperados) {
      const nativo = readFileSync(join(NATIVO, nome), 'utf8');
      if (nome === 'manifest.json') {
        const a = JSON.parse(arquivos[nome]!) as Record<string, unknown>;
        const b = JSON.parse(nativo) as Record<string, unknown>;
        delete a.gerado_em;
        delete b.gerado_em;
        expect(a, nome).toEqual(b);
      } else {
        expect(arquivos[nome], nome).toBe(nativo);
      }
    }
  }, 240_000);

  it('roda de novo na mesma sessão e não acumula arquivos de uma execução na outra', () => {
    const a = executarPipeline(py, entrada(), { sintetico: true, meta: '{}' });
    const b = executarPipeline(py, entrada().slice(0, 5), { sintetico: true, meta: '{}' });
    expect(Object.keys(b.arquivos).sort()).toEqual(Object.keys(a.arquivos).sort());
    // os KMZ brutos não ficam na memória depois da execução
    expect(py.FS.analyzePath('/raw').exists).toBe(false);
    expect(py.FS.analyzePath('/out').exists).toBe(false);
  }, 240_000);

  it('pasta sem KMZ vira erro legível, não exceção do Python', () => {
    const lixo: EntradaArquivo[] = [
      { nome: 'planilha', bytes: new TextEncoder().encode('não é KMZ') },
    ];
    expect(() => executarPipeline(py, lixo, { meta: '{}' })).toThrow(ErroPipeline);
    expect(() => executarPipeline(py, lixo, { meta: '{}' })).toThrow(/Nenhum KMZ\/KML/);
  }, 240_000);
});
