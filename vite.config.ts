/// <reference types="vitest/config" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Connect, type Plugin } from 'vite';

const BASE = '/portifolio/';

/**
 * DATA_DIR=<pasta> serve os dados de outra pasta em /portifolio/data/ (dev e preview),
 * sem copiá-los para public/. Usado com dados sintéticos (.fixture/data) nos testes e
 * com dados reais locais que ainda não podem ser publicados.
 */
function dadosLocais(): Plugin {
  const dir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : null;
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!dir || !req.url?.startsWith(`${BASE}data/`)) return next();
    const nome = decodeURIComponent(req.url.slice(`${BASE}data/`.length).split('?')[0] ?? '');
    const arquivo = resolve(dir, nome);
    if (!arquivo.startsWith(dir) || !existsSync(arquivo) || !statSync(arquivo).isFile()) {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader(
      'Content-Type',
      nome.endsWith('.json') || nome.endsWith('.geojson')
        ? 'application/json'
        : 'application/octet-stream',
    );
    createReadStream(arquivo).pipe(res);
  };
  return {
    name: 'dados-locais',
    configureServer: (s) => void s.middlewares.use(middleware),
    configurePreviewServer: (s) => void s.middlewares.use(middleware),
  };
}

// GitHub Pages publica em https://<org>.github.io/portifolio/
export default defineConfig({
  base: BASE,
  plugins: [react(), dadosLocais()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
          echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
