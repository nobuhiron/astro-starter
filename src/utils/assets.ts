/**
 * public/ に置いたファイルの URL を返す。
 *
 * astro.config.mjs の assetsPrefix は src/ 由来のバンドル済みアセット（_astro/, images/）
 * にしか適用されない。public/ のファイルは絶対パスのまま出力されるため、HTML を
 * ショップ本体に置く MakeShop 構成ではショップのルートを指してしまい 404 になる。
 *
 * 本番ビルドかつ PUBLIC_CDN_URL がある場合だけ CDN を前置する。
 */
const cdnBase = (import.meta.env.PUBLIC_CDN_URL || process.env.PUBLIC_CDN_URL || '').replace(
  /\/$/,
  ''
);

export const publicAssetPath = (assetPath: string) => {
  const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;

  return import.meta.env.PROD && cdnBase ? `${cdnBase}${normalized}` : normalized;
};
