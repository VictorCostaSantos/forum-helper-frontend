import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy só pro backend do PDI rodando em localhost:3001 — o front
    // chama '/api/bi-progress' e o Vite repassa pra evitar CORS em dev.
    // Em produção (Vercel) a rota '/api/*' precisa estar no mesmo domínio
    // do front (rewrites no vercel.json) ou apontar pra URL absoluta.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
