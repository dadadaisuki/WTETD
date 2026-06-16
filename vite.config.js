import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createNodeApiMiddleware } from './server/api/nodeAdapter.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'local-api-middleware',
      configureServer(server) {
        server.middlewares.use(createNodeApiMiddleware(process.env))
      },
    },
  ],
})
