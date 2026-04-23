import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { execSync } from 'child_process';
import { viteSourceLocator } from '@metagptx/vite-plugin-source-locator';
import { atoms } from '@metagptx/web-sdk/plugins';
import { vitePrerenderPlugin } from 'vite-prerender-plugin';
import Sitemap from 'vite-plugin-sitemap';
import { getBlogRoutes } from './prerender/blog-routes.js';
import { getSitemapLastmod } from './prerender/blog-sitemap.js';

/**
 * Detect the port where the FastAPI backend is actually listening.
 * Order of preference:
 *   1. Explicit override: API_PORT / BACKEND_PORT env vars (if a
 *      uvicorn/python process is actually listening there).
 *   2. Probe candidate ports (8000, 8002, 8001, 8080) and pick the first
 *      one bound by a uvicorn/python process on localhost.
 *   3. Fallback to 8000.
 */
function detectBackendPort(): string {
  const candidates: string[] = [];
  const preferred = process.env.API_PORT || process.env.BACKEND_PORT;
  if (preferred) candidates.push(preferred);
  for (const p of ['8000', '8002', '8001', '8080']) {
    if (!candidates.includes(p)) candidates.push(p);
  }

  // Use `ss -tlnp` to enumerate listening TCP ports. We only run this on
  // Linux container environments; failures are tolerated and fall back to
  // the default.
  let listening: { port: number; proc: string }[] = [];
  try {
    const out = execSync('ss -tlnp 2>/dev/null || true', { encoding: 'utf8' });
    for (const line of out.split('\n')) {
      const m = line.match(/:(\d+)\s+.*users:\(\(?"([^"]+)"/);
      if (m) listening.push({ port: parseInt(m[1], 10), proc: m[2] });
    }
  } catch {
    listening = [];
  }

  // Prefer a port held by uvicorn/python so we don't accidentally proxy to
  // Vite or another dev process.
  for (const c of candidates) {
    const portNum = parseInt(c, 10);
    const hit = listening.find(
      (l) => l.port === portNum && /python|uvicorn|gunicorn/i.test(l.proc),
    );
    if (hit) return c;
  }

  // If no python/uvicorn match, accept any listener on a candidate port.
  for (const c of candidates) {
    const portNum = parseInt(c, 10);
    if (listening.some((l) => l.port === portNum)) return c;
  }

  return '8000';
}

const BACKEND_PROXY_PORT = detectBackendPort();
// eslint-disable-next-line no-console
console.log(`[vite] Proxying /api -> http://localhost:${BACKEND_PROXY_PORT}`);

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

process.env.VITE_APP_TITLE ??= process.env.OVERVIEW_TITLE ?? 'shadcnui';
process.env.VITE_APP_DESCRIPTION ??= process.env.OVERVIEW_DESCRIPTION ?? 'Atoms Generated Project';
process.env.VITE_APP_TITLE = escapeHtmlAttr(process.env.VITE_APP_TITLE);
process.env.VITE_APP_DESCRIPTION = escapeHtmlAttr(process.env.VITE_APP_DESCRIPTION);
process.env.VITE_APP_LOGO_URL ??= process.env.OVERVIEW_LOGO_URL ?? 'https://public-frontend-cos.metadl.com/mgx/img/favicon_atoms.ico';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const blogPrerenderRoutes = command === 'build' ? getBlogRoutes() : [];

  return {
    plugins: [
      viteSourceLocator({
        prefix: 'mgx', // Prefix used to identify source locations; do not change.
      }),
      react(),
      atoms(),
      Sitemap({
        hostname: 'https://atoms.template.com',
        lastmod: getSitemapLastmod(),
        readable: true,
        generateRobotsTxt: true,
      }),
      ...(blogPrerenderRoutes.length > 0
        ? vitePrerenderPlugin({
            renderTarget: '#root',
            prerenderScript: path.resolve(__dirname, 'prerender/blog.js'),
            additionalPrerenderRoutes: blogPrerenderRoutes,
          })
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0', // Listen on all network interfaces.
      port: parseInt(process.env.VITE_PORT || '3000'),
      proxy: {
        '/api': {
          target: `http://localhost:${BACKEND_PROXY_PORT}`,
          changeOrigin: true,
        },
      },
      watch: { usePolling: true, interval: 600 },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['react-router-dom'],
            'ui-vendor': [
              '@radix-ui/react-accordion',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-aspect-ratio',
              '@radix-ui/react-avatar',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-collapsible',
              '@radix-ui/react-context-menu',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-hover-card',
              '@radix-ui/react-label',
              '@radix-ui/react-menubar',
              '@radix-ui/react-navigation-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-progress',
              '@radix-ui/react-radio-group',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slider',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              '@radix-ui/react-toggle',
              '@radix-ui/react-toggle-group',
              '@radix-ui/react-tooltip',
            ],
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
            'utils-vendor': [
              'axios',
              'clsx',
              'tailwind-merge',
              'class-variance-authority',
              'date-fns',
              'lucide-react',
            ],
            'query-vendor': ['@tanstack/react-query'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
});
