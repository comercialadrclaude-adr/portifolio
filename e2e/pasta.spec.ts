import { expect, test, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Leitura da pasta no navegador (Pyodide). Os KMZ vêm de .fixture/raw (sintéticos).
// PYODIDE_DIR aponta para uma cópia local do Pyodide 0.29 e evita baixá-lo do jsDelivr;
// sem ela, o teste usa o CDN de verdade.
const RAW = resolve('.fixture/raw');
const PYODIDE_DIR = process.env.PYODIDE_DIR;
const TIPOS: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
  '.whl': 'application/zip',
};

test.beforeEach(async ({ page }) => {
  await page.route('https://basemaps.cartocdn.com/**', (r) =>
    r.fulfill({ json: { version: 8, sources: {}, layers: [] } }),
  );
  if (PYODIDE_DIR) {
    await page.route('https://cdn.jsdelivr.net/pyodide/**', async (r) => {
      const nome = new URL(r.request().url()).pathname.split('/').pop() ?? '';
      const caminho = join(PYODIDE_DIR, nome);
      if (!existsSync(caminho)) return r.fulfill({ status: 404 });
      const ext = nome.slice(nome.lastIndexOf('.'));
      await r.fulfill({
        path: caminho,
        contentType: TIPOS[ext] ?? 'application/octet-stream',
        headers: { 'access-control-allow-origin': '*' },
      });
    });
  }
});

const arquivosDe = (...nomes: string[]) => nomes.map((n) => join(RAW, n));

/** No celular o menu lateral fica atrás do botão "Abrir menu". */
async function abrirGaveta(page: Page) {
  const menu = page.getByRole('button', { name: 'Abrir menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Atualizar dados' }).click();
  await expect(page.getByRole('dialog', { name: 'Atualizar dados' })).toBeVisible();
}

test.describe('leitura da pasta no navegador', () => {
  test.skip(!existsSync(RAW) || readdirSync(RAW).length === 0, 'rode `npm run data:fixture`');
  test.setTimeout(180_000);

  test('importar arquivos troca os dados publicados pelos da pasta, e dá para voltar', async ({
    page,
  }) => {
    await page.goto('./');
    await abrirGaveta(page);
    const gaveta = page.getByRole('dialog', { name: 'Atualizar dados' });

    // sem a ficha do projeto (1001): a carteira da pasta fica sem projetos
    await gaveta.getByTestId('entrada-arquivos').setInputFiles(arquivosDe('1002', '1004', '1005'));
    await expect(gaveta.getByRole('status')).toContainText(/Carregando o Python|Lendo|Calculando/);
    await expect(gaveta.getByText('Arquivos', { exact: true })).toBeVisible({ timeout: 150_000 });
    await expect(gaveta.getByText('Base usada')).toBeVisible();

    await page.keyboard.press('Escape');
    const faixa = page.getByRole('note').filter({ hasText: 'Ficam só neste navegador' });
    await expect(faixa).toBeVisible();
    await expect(faixa).toContainText('arquivos selecionados');

    await page.goto('./?aba=carteira');
    await expect(page.getByRole('row', { name: /Ver ficha de P1/ })).toHaveCount(0);

    // lembra entre as visitas (IndexedDB)
    await page.reload();
    await expect(
      page.getByRole('note').filter({ hasText: 'Ficam só neste navegador' }),
    ).toBeVisible();
    await expect(page.getByRole('row', { name: /Ver ficha de P1/ })).toHaveCount(0);

    // volta aos dados publicados
    await abrirGaveta(page);
    await page.getByRole('button', { name: 'Voltar aos dados publicados' }).click();
    await expect(
      page.getByRole('note').filter({ hasText: 'Ficam só neste navegador' }),
    ).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Ver ficha de P1/ })).toBeVisible();
  });

  test('com a pasta lida, o mapa desenha a rede a partir dos dados do navegador', async ({
    page,
  }) => {
    await page.goto('./?aba=mapa');
    await abrirGaveta(page);
    await page
      .getByTestId('entrada-arquivos')
      .setInputFiles(arquivosDe('1001', '1002', '1003', '1004', '1005'));
    await expect(page.getByRole('dialog').getByText('Base usada')).toBeVisible({
      timeout: 150_000,
    });
    await page.keyboard.press('Escape');

    await page.waitForFunction(() => {
      const m = (window as unknown as { __mapa?: { getLayer: (id: string) => unknown } }).__mapa;
      return !!m?.getLayer('rede-extensao') && !!m?.getLayer('proj-linha');
    });
    // a camada da rede vem de um endereço blob: (dados da pasta), não de public/data
    const origem = await page.evaluate(() => {
      const m = (window as unknown as { __mapa?: { getSource: (id: string) => unknown } }).__mapa;
      return (m?.getSource('rede') as { _dadosPainel?: string } | undefined)?._dadosPainel;
    });
    expect(origem).toMatch(/^blob:/);
  });

  test('conectar pasta de verdade: lê, só reprocessa se mudar e lembra a pasta ao recarregar', async ({
    page,
  }) => {
    const lerBase64 = (n: string) => readFileSync(join(RAW, n)).toString('base64');
    const inicial = ['1001', '1002', '1004', '1005'].map((n) => [n, lerBase64(n)]);
    await page.goto('./');

    // O seletor nativo não é automatizável: uma pasta real do sistema de arquivos privado do
    // navegador (OPFS) faz o papel dela, com a mesma API (entries, getFile, handle no IndexedDB).
    const gravar = async (arquivos: string[][], substituirSeletor: boolean) => {
      await page.evaluate(
        async ([lista, trocar]) => {
          const raiz = await navigator.storage.getDirectory();
          const pasta = await raiz.getDirectoryHandle('Interior', { create: true });
          for (const [nome, b64] of lista as string[][]) {
            const f = await pasta.getFileHandle(nome!, { create: true });
            const w = await f.createWritable();
            await w.write(Uint8Array.from(atob(b64!), (c) => c.charCodeAt(0)));
            await w.close();
          }
          if (trocar)
            (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker =
              async () => pasta;
        },
        [arquivos, substituirSeletor] as const,
      );
    };
    await gravar(inicial, true);

    await abrirGaveta(page);
    const gaveta = page.getByRole('dialog', { name: 'Atualizar dados' });
    await gaveta.getByRole('button', { name: 'Conectar pasta' }).click();
    await expect(gaveta.getByText('Base usada')).toBeVisible({ timeout: 150_000 });
    await expect(gaveta.getByText('Pasta “Interior”', { exact: true })).toBeVisible();
    await expect(
      gaveta.getByRole('button', { name: /Atualizar da pasta “Interior”/ }),
    ).toBeVisible();
    await expect(
      gaveta.getByText('Arquivos', { exact: true }).locator('xpath=following-sibling::dd[1]'),
    ).toHaveText('4');

    // sem mudança na pasta, atualizar só avisa
    await gaveta.getByRole('button', { name: /Atualizar da pasta “Interior”/ }).click();
    await expect(gaveta.getByText(/A pasta não mudou/)).toBeVisible({ timeout: 30_000 });

    // com um arquivo novo na pasta, relê e reprocessa
    await gravar([['1003', lerBase64('1003')]], false);
    await gaveta.getByRole('button', { name: /Atualizar da pasta “Interior”/ }).click();
    await expect(
      gaveta.getByText('Arquivos', { exact: true }).locator('xpath=following-sibling::dd[1]'),
    ).toHaveText('5', { timeout: 150_000 });

    // ao recarregar, o painel abre com os dados da pasta e lembra o nome dela; o handle
    // guardado só é lido quando se clica em atualizar (nunca na abertura)
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(
      page.getByRole('note').filter({ hasText: 'Ficam só neste navegador' }),
    ).toBeVisible();
    await abrirGaveta(page);
    await expect(
      page.getByRole('dialog').getByRole('button', { name: /Atualizar da pasta “Interior”/ }),
    ).toBeVisible();
  });

  test('arquivo que não é KMZ mostra o motivo, sem travar o painel', async ({ page }) => {
    await page.goto('./');
    await abrirGaveta(page);
    const gaveta = page.getByRole('dialog', { name: 'Atualizar dados' });
    await gaveta.getByTestId('entrada-arquivos').setInputFiles({
      name: 'relatorio',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('isto não é um KMZ'),
    });
    await expect(gaveta.getByRole('alert')).toContainText('Nenhum KMZ/KML', { timeout: 150_000 });
    // o painel continua com os dados publicados
    await expect(gaveta.getByRole('button', { name: 'Importar arquivos' })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Dados sintéticos de teste')).toBeVisible();
  });

  test('planilhas e outros formatos são ignorados antes de abrir', async ({ page }) => {
    await page.goto('./');
    await abrirGaveta(page);
    const gaveta = page.getByRole('dialog', { name: 'Atualizar dados' });
    await gaveta.getByTestId('entrada-arquivos').setInputFiles({
      name: 'planilha.xlsx',
      mimeType: 'application/vnd.ms-excel',
      buffer: Buffer.from('x'),
    });
    await expect(gaveta.getByRole('alert')).toContainText('Nenhum arquivo KMZ ou KML encontrado');
  });
});
