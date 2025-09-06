import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hugsylabs/hugsy-compiler': path.resolve(__dirname, '../compiler/src'),
      '@hugsylabs/hugsy-types': path.resolve(__dirname, '../types/src'),
    },
  },
  server: {
    port: 3456,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['@monaco-editor/react'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
