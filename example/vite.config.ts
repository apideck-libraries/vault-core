import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
  server: {
    port: 1234,
    open: false,
  },
});
