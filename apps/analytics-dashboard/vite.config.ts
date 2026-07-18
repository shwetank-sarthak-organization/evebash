import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy Railway GraphQL — avoids CORS when calling from browser
      '/railway-gql': {
        target: 'https://backboard.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/railway-gql/, '/graphql/v2'),
      },
      // Proxy Next.js API routes (when Next.js is running on :3000)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
