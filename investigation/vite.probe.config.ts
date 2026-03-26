import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
    dedupe: ['react', 'react-dom', 'react-reconciler'],
  },
  build: {
    outDir: path.resolve(__dirname, '../.megaplan/plans/investigate-and-fix-visual-20260325-2044/evidence/probe-dist'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        player: path.resolve(__dirname, './video-editor-player-probe.html'),
        repro: path.resolve(__dirname, './object-cover-clip-repro.html'),
      },
    },
  },
});
