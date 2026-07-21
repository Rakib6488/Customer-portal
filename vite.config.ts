import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('firebase')) return 'firebase-vendor';
            if (id.includes('recharts')) return 'charts-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            if (id.includes('motion') || id.includes('framer-motion')) return 'motion-vendor';
            if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/') || id.includes('react/jsx-runtime') || id.includes('react/jsx-dev-runtime')) return 'react-vendor';
            if (id.includes('@google/genai')) return 'genai-vendor';
            return 'vendor';
          },
        },
      },
      chunkSizeWarningLimit: 700,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Keep file watching disabled when requested to avoid needless rebuild churn.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

