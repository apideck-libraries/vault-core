import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Multi-page: the plain direct render (index.html) plus the iframe-embedding
// repro for GH-9546 — a host page (iframe.html) and the framed Vault document
// (vault.html). In dev, Vite serves each by path (/iframe.html, /vault.html);
// these inputs only matter for `vite build`.
const pages = {
  index: path.resolve(__dirname, 'index.html'),
  iframe: path.resolve(__dirname, 'iframe-test/iframe.html'),
  vault: path.resolve(__dirname, 'iframe-test/vault.html'),
};

// Force a single React copy across the example AND the in-tree vault-core source.
// Without this, Vite finds nested React copies in the parent's node_modules and
// the React tree fails with "Invalid hook call".
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, '../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  css: { postcss: { plugins: [] } },
  build: {
    rollupOptions: {
      input: pages,
    },
  },
  server: {
    port: 1234,
    open: false,
  },
});
