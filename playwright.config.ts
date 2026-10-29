import { defineConfig, devices } from '@playwright/test';

// Os testes rodam sobre o build de produção servido pelo `vite preview`, com os dados
// SINTÉTICOS de .fixture/data (gere com `npm run data:fixture`). Nada é copiado para public/.
const PORTA = 4173;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORTA}/portifolio/`,
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'celular',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 800 } },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORTA} --strictPort`,
    env: { DATA_DIR: '.fixture/data' },
    url: `http://localhost:${PORTA}/portifolio/`,
    reuseExistingServer: !process.env.CI,
  },
});
