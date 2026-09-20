import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

const path = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));
export default defineConfig({
  root: path('./app/installed'),
  publicDir: path('./public'),
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: {
      '@': path('./'),
      'next/image': path('./platform/client/image.tsx'),
      'next/navigation': path('./platform/client/navigation.ts'),
    },
  },
  define: {
    __GAME_API_ORIGIN__: JSON.stringify(
      process.env.GAME_API_ORIGIN ?? 'https://www.jumbleyard.com',
    ),
  },
  build: { outDir: path('./dist/native'), emptyOutDir: true, manifest: true },
});
