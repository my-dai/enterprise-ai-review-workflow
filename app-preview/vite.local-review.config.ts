import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
// Separate opt-in preview: never changes the normal Power Apps build.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: '@/lib/lessons-library', replacement: path.resolve(__dirname, 'preview/mock-library.ts') },
    { find: '@/lib/lesson-coach-api', replacement: path.resolve(__dirname, 'preview/mock-coach.ts') },
    { find: '@', replacement: path.resolve(__dirname, 'src') },
  ] },
  server: { host: '127.0.0.1', port: 5187, strictPort: true },
  build: { outDir: 'local-preview', rollupOptions: { input: path.resolve(__dirname, 'preview/index.html') } },
});
