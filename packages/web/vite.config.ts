import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/articles': 'http://localhost:8787',
      '/login': 'http://localhost:8787',
      '/logout': 'http://localhost:8787',
      '/me': 'http://localhost:8787',
    },
  },
});
