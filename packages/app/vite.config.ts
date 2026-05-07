import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'
import fs from 'node:fs'

const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://api.github.com https://*.atlassian.net https://*.atlassian.com https://auth.atlassian.com https://api.anthropic.com https://api.openai.com https://*.googleapis.com https://accounts.google.com https://github.com https://*.workers.dev; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com; frame-src 'none';" />`

export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE_PATH || '/') : '/',
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    {
      name: 'inject-csp',
      transformIndexHtml(html, ctx) {
        if (ctx.bundle) {
          return html.replace('<!--CSP_PLACEHOLDER-->', cspMeta)
        }
        return html.replace('<!--CSP_PLACEHOLDER-->', '')
      },
    },
    {
      name: 'spa-fallback-404',
      closeBundle() {
        const index = path.resolve(__dirname, 'dist', 'index.html')
        const fallback = path.resolve(__dirname, 'dist', '404.html')
        if (fs.existsSync(index)) {
          fs.copyFileSync(index, fallback)
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['@tanstack/react-router'],
          'query': ['@tanstack/react-query'],
          'otel': ['@opentelemetry/api', '@opentelemetry/sdk-metrics', '@opentelemetry/resources'],
        },
      },
    },
  },
}))
