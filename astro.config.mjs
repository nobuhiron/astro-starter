import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');

export default defineConfig({
  build: {
    assetsPrefix: env.CDN_URL || process.env.CDN_URL || '',
  },
  image: { service: { entrypoint: 'astro/assets/services/sharp' } },
  vite: {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: (info) =>
            /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(info.name || '')
              ? 'images/[name]-[hash][extname]'
              : '_astro/[name]-[hash][extname]',
          entryFileNames: '_astro/[name]-[hash].js',
          chunkFileNames: '_astro/[name]-[hash].js',
        },
      },
    },
  },
});
