import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');
const cdnUrl = (process.env.PUBLIC_CDN_URL || env.PUBLIC_CDN_URL || '').replace(/\/$/, '');

export default defineConfig({
  // scripts/patch-dist-assets.mjs が成果物の HTML を書き換えるため、
  // タグ間の空白を潰さない。
  compressHTML: false,
  build: {
    assetsPrefix: cdnUrl,
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
