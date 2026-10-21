import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // Bind IPv4 explicitly: Node resolves `localhost` to ::1 only, while Chrome
  // tries 127.0.0.1 and gets "refused to connect".
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
})
