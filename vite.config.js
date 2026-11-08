import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { taekwondoSocketPlugin } from './server/socketPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), taekwondoSocketPlugin()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces for phone access
    port: 5173,
  },
})
