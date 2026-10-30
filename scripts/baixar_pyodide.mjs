// Monta uma cópia local do Pyodide para os testes (Vitest e Playwright).
//
//   node scripts/baixar_pyodide.mjs [pasta]      (padrão: .pyodide)
//
// O núcleo vem do pacote npm `pyodide` (mesma versão do CDN usado pelo site); as bibliotecas do
// pipeline (numpy, shapely, pyproj, lxml e dependências) são baixadas do jsDelivr, com conferência
// do hash. Depois, aponte PYODIDE_INDEX_URL (Vitest) e PYODIDE_DIR (Playwright) para a pasta.
// PYODIDE_CDN troca o endereço de onde as bibliotecas são baixadas.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Mesma lista de src/lib/pasta/pipeline.ts (PACOTES).
const PACOTES = ['numpy', 'shapely', 'pyproj', 'lxml'];
const NUCLEO = [
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
  'pyodide.js',
  'pyodide.mjs',
];

const destino = resolve(process.argv[2] ?? '.pyodide');
const pacote = resolve('node_modules/pyodide');
const { version } = JSON.parse(readFileSync(join(pacote, 'package.json'), 'utf8'));
const cdn = process.env.PYODIDE_CDN ?? `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;

mkdirSync(destino, { recursive: true });
for (const nome of NUCLEO) copyFileSync(join(pacote, nome), join(destino, nome));
// pyodide.asm.js é CommonJS: dentro de um projeto "type": "module" ele perde o `require`.
writeFileSync(join(destino, 'package.json'), '{ "type": "commonjs" }\n');

const { packages } = JSON.parse(readFileSync(join(destino, 'pyodide-lock.json'), 'utf8'));
const necessarios = new Set();
const incluir = (nome) => {
  if (necessarios.has(nome)) return;
  const p = packages[nome];
  if (!p) throw new Error(`Pacote ${nome} não existe no Pyodide ${version}.`);
  necessarios.add(nome);
  for (const dep of p.depends ?? []) incluir(dep);
};
PACOTES.forEach(incluir);

const sha256 = (dados) => createHash('sha256').update(dados).digest('hex');

for (const nome of [...necessarios].sort()) {
  const { file_name: arquivo, sha256: esperado } = packages[nome];
  const caminho = join(destino, arquivo);
  if (existsSync(caminho) && sha256(readFileSync(caminho)) === esperado) continue;
  const resposta = await fetch(cdn + arquivo);
  if (!resposta.ok) throw new Error(`Falha ao baixar ${arquivo}: HTTP ${resposta.status}`);
  const dados = Buffer.from(await resposta.arrayBuffer());
  if (sha256(dados) !== esperado) throw new Error(`Hash incorreto em ${arquivo}.`);
  writeFileSync(caminho, dados);
  console.log(`baixado: ${arquivo}`);
}
console.log(`Pyodide ${version} pronto em ${destino}`);
