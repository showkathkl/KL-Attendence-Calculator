import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [react()],
  resolve: { alias: {
    '@klu-attend-plus/attendance-engine': path.resolve(root, '../../packages/attendance-engine/src'),
    '@klu-attend-plus/shared-types': path.resolve(root, '../../packages/shared-types/src')
  }},
  server: { port: 5173 },
});
