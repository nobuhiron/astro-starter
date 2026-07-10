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
      // HTML はショップ本体、アセットは CDN に置くため常にクロスオリジンになる。
      // gigaplus は Access-Control-Allow-Origin を返さないので、外部ファイル化された
      // <script type="module"> は本番でブロックされる。JS は必ずインライン化する。
      // 画像など他のアセットは null を返して既定（4096 バイト）のままにする。
      assetsInlineLimit: (filePath) => (filePath.endsWith('.js') ? true : null),
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
