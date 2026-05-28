import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Required by CapacitorJS: output to 'dist' and use relative paths
  base: './',
  build: {
    outDir: 'dist',
  },
});
