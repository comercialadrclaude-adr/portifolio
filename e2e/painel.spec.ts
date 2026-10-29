import { expect, test, type Page } from '@playwright/test';

// Mapa base externo fica fora dos testes: devolve um estilo vazio.
test.beforeEach(async ({ page }) => {
  await page.route('https://basemaps.cartocdn.com/**', (r) =>
    r.fulfill({ json: { version: 8, sources: {}, layers: [] } }),
  );
});

async function semRolagemHorizontal(page: Page) {
  const largura = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(largura).toBeLessThanOrEqual(0);
}

test('visão geral mostra KPIs, gráfico e comparativo', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Dados sintéticos de teste')).toBeVisible();
  await expect(page.getByText('Rede cadastrada', { exact: true })).toBeVisible();
  // 4,6 km da base sintética (scripts/tests/make_fixture.py)
  await expect(page.locator('p strong').first()).toHaveText('4,6 km');
  await expect(page.getByRole('img', { name: /km de extensão por mês/ })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Indicadores por município' })).toBeVisible();
  await semRolagemHorizontal(page);
});

test('clicar num município filtra e vai para a URL', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('row', { name: 'Filtrar por Município B' }).click();
  await expect(page).toHaveURL(/municipio=Munic%C3%ADpio%20B/);
  await expect(page.locator('p').filter({ hasText: 'Município B:' })).toBeVisible();
});

test('link com filtro abre no mesmo estado', async ({ page }) => {
  await page.goto('./?aba=qualidade&municipio=Munic%C3%ADpio%20A');
  await expect(
    page
      .getByRole('tab', { name: 'Qualidade do cadastro', selected: true })
      .or(page.getByRole('combobox', { name: 'Seção' })),
  ).toBeVisible();
  await expect(page.getByText('Preenchimento por atributo · Município A')).toBeVisible();
});

test('carteira mostra ficha com campos a preencher e prioridade', async ({ page }) => {
  await page.goto('./?aba=carteira');
  await page.getByRole('row', { name: /Ver ficha de P1/ }).click();
  const ficha = page.getByRole('complementary');
  await expect(ficha.getByRole('heading', { name: 'Extensão de Teste' })).toBeVisible();
  await expect(ficha.getByText('a preencher').first()).toBeVisible();
  await expect(ficha.getByRole('heading', { name: 'Índice de prioridade' })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Inventário dos arquivos do portfólio' }),
  ).toBeVisible();
});

test('abrir projeto no mapa enquadra o projeto', async ({ page }) => {
  await page.goto('./?aba=carteira');
  await page.getByRole('button', { name: 'Abrir P1 no mapa' }).click();
  await expect(page).toHaveURL(/aba=mapa/);
  await expect(page).toHaveURL(/projeto=P1/);
  await page.waitForFunction(() => {
    const m = (window as unknown as { __mapa?: { getLayer: (id: string) => unknown } }).__mapa;
    return !!m?.getLayer('proj-linha') && !!m?.getLayer('rede-extensao');
  });
  const centro = await page.evaluate(() => {
    const m = (
      window as unknown as {
        __mapa: { getCenter: () => { lng: number; lat: number }; getZoom: () => number };
      }
    ).__mapa;
    return { ...m.getCenter(), zoom: m.getZoom() };
  });
  // traçado sintético: lon -40.0, lat -23.5 a -23.502
  expect(centro.lng).toBeCloseTo(-40.0, 2);
  expect(centro.lat).toBeCloseTo(-23.501, 2);
  expect(centro.zoom).toBeGreaterThan(14);
});

test('mapa tem legenda, camadas e reenquadrar', async ({ page }) => {
  await page.goto('./?aba=mapa');
  await expect(page.getByRole('button', { name: 'Legenda' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Extensões/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /Extensões/ }).uncheck();
  await expect(page).toHaveURL(/camadas=/);
  await expect(page.getByRole('button', { name: 'Reenquadrar' })).toBeVisible();
});

test('qualidade baixa CSV de inconsistências', async ({ page }) => {
  await page.goto('./?aba=qualidade');
  await expect(page.getByRole('meter', { name: /Material/ })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar CSV: Material não informado' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('inconsistencia-sem_material.csv');
  const conteudo = await (await download.createReadStream()).toArray();
  const texto = Buffer.concat(conteudo).toString('utf-8');
  expect(texto.split('\r\n')[0]).toContain('id;globalid;municipio');
  expect(texto).not.toMatch(/@|https?:\/\/|file:\/\//);
});

test('tema escuro alterna e persiste', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Usar tema escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('abas navegam por teclado', async ({ page, isMobile }, info) => {
  test.skip(info.project.name === 'celular', 'no celular as abas viram um seletor');
  void isMobile;
  await page.goto('./');
  await page.getByRole('tab', { name: 'Visão geral' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Carteira de projetos' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test.describe('publicação só de agregados', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/data/manifest.json', async (r) => {
      const resp = await r.fetch();
      const json = await resp.json();
      await r.fulfill({ response: resp, json: { ...json, modo: 'agregado' } });
    });
    await page.route('**/data/rede.geojson', (r) => r.fulfill({ status: 404 }));
    await page.route('**/data/trechos.json', (r) => r.fulfill({ status: 404 }));
  });

  test('mapa mostra projetos e ZEIS, sem a rede', async ({ page }) => {
    await page.goto('./?aba=mapa');
    await expect(page.getByText(/publicada só como agregados/)).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Rede existente/ })).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: /Projetos/ })).toBeChecked();
    await page.waitForFunction(() => {
      const m = (window as unknown as { __mapa?: { getLayer: (id: string) => unknown } }).__mapa;
      return !!m?.getLayer('proj-linha') && !m.getLayer('rede-existente');
    });
  });

  test('qualidade não oferece CSV de trechos', async ({ page }) => {
    await page.goto('./?aba=qualidade');
    await expect(page.getByRole('row', { name: /Material não informado/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Baixar CSV/ })).toHaveCount(0);
  });
});
