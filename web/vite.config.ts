import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// В разработке /api уходит на API на порту 3000; в образе - через nginx.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
});
