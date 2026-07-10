/**
 * ビルド成果物を CDN 配信向けに書き換える。
 *
 * 1. assetsPrefix が拾いきれない /_astro/ /images/ の参照を CDN 化する
 *    （インライン style 属性内の url("...") など、HTML エスケープされた箇所）
 * 2. 外部 <script type="module" src> から type="module" を外す
 *
 * 2 の理由:
 *   HTML はショップ本体、アセットは CDN に置くため常にクロスオリジンになる。
 *   ES モジュールは CORS モードで取得されるため、Access-Control-Allow-Origin を
 *   返さない CDN では弾かれて初期化されない。バンドルが import/export/import.meta を
 *   持たない自己完結なコードであれば、type を外してクラシックスクリプトにすれば
 *   CORS 不要で実行できる。
 *
 *   その前提が崩れていないか（import が残っていないか）は、この直後に走る
 *   scripts/check-cors-safe.mjs が検査する。
 *
 * src 無しのインライン module は同一 HTML 内なのでそのまま温存する。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const rootDir = process.cwd();
const distDir = resolve(rootDir, process.env.DIST || 'dist');
const envFiles = ['.env', '.env.production', '.env.local', '.env.production.local'];

const loadedEnv = {};

const parseEnvFile = (filePath) => {
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    loadedEnv[key] = value;
  }
};

for (const relativePath of envFiles) {
  const filePath = resolve(rootDir, relativePath);
  if (existsSync(filePath)) parseEnvFile(filePath);
}

const cdnBase = (process.env.PUBLIC_CDN_URL || loadedEnv.PUBLIC_CDN_URL || '').replace(/\/$/, '');

if (!cdnBase || !existsSync(distDir)) {
  console.log('[patch-dist-assets] PUBLIC_CDN_URL が未設定のためスキップします。');
  process.exit(0);
}

const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt']);

// 直前の区切りは生のクォート/括弧/空白/= に加え、HTML エスケープされたクォート
// (&#34; &#39; &quot; &apos; など) も許可する。インライン style 属性内の
// url("...") は &#34; にエスケープされるため、これを拾わないと CDN 化が漏れる。
const rewriteContent = (content) =>
  content.replace(
    /(["'(\s=]|&#?\w+;)\/(_astro|images)\//g,
    (_match, start, folder) => `${start}${cdnBase}/${folder}/`
  );

// 属性順に依存しないよう、script タグ全体を見てから type="module" を落とす。
const rewriteHtmlScripts = (content) =>
  content.replace(/<script\b[^>]*>/gi, (tag) => {
    if (!/\ssrc=["']/i.test(tag)) return tag;
    if (!/\stype=["']module["']/i.test(tag)) return tag;
    return tag.replace(/\stype=["']module["']/i, '');
  });

let patched = 0;

const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const ext = extname(entry.name).toLowerCase();
    if (!textExtensions.has(ext)) continue;

    const original = readFileSync(fullPath, 'utf8');
    let updated = rewriteContent(original);
    if (ext === '.html') updated = rewriteHtmlScripts(updated);

    if (updated !== original) {
      writeFileSync(fullPath, updated, 'utf8');
      patched += 1;
    }
  }
};

walk(distDir);
console.log(`[patch-dist-assets] ${patched} ファイルを CDN 向けに書き換えました。`);
