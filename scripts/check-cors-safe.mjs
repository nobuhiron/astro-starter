/**
 * ビルド成果物に「クロスオリジンでブロックされる参照」「クラシック化に失敗した
 * バンドル」が混ざっていないか検査する。scripts/patch-dist-assets.mjs の直後に走る。
 *
 * MakeShop では HTML をショップ本体に、アセットを CDN に置くため常にクロスオリジンで、
 * CDN は Access-Control-Allow-Origin を返さない。
 *
 * CORS モードで取得される（= NG）:
 *   - <script type="module" src="https://cdn/...">
 *   - <link rel="modulepreload" href="https://cdn/...">
 *   - @font-face の src: url(https://cdn/...woff2)
 *
 * CORS 不要（= OK）:
 *   - <script src="https://cdn/..."> （type 無しのクラシックスクリプト）
 *   - <link rel="stylesheet" href="https://cdn/...">
 *   - <img>, background-image など
 *
 * さらに patch-dist-assets.mjs は type="module" を外してクラシック化する。これは
 * 「バンドルが import/export/import.meta を持たない自己完結なコード」であることを
 * 前提にしている。動的 import() やチャンク分割が起きるとその前提が崩れ、classic
 * スクリプトは import 文で構文エラーになって静かに死ぬ。ここではその残留も検査する。
 *
 * dev サーバーは同一オリジンなので、これらの事故はローカルで再現しない。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIST = process.env.DIST || 'dist';

const walk = (dir) => {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
};

const isAbsolute = (url) => /^https?:\/\//i.test(url);
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1];

// rollup が吐く module チャンクの特徴。ミニファイ後は1行なので行頭アンカーは使えない。
// 先頭、または直前が ; } のときの import/export、および動的 import()・import.meta を見る。
const MODULE_SYNTAX = [
  { name: 'import 文', re: /(^|[;}])\s*import[\s{"'*(]/ },
  { name: 'export 文', re: /(^|[;}])\s*export[\s{*]/ },
  { name: 'import.meta', re: /\bimport\.meta\b/ },
];

const problems = [];
const add = (file, kind, detail, hint) => problems.push({ file, kind, detail, hint });

const files = walk(DIST);
if (files.length === 0) {
  console.error(`[check-cors-safe] ${DIST}/ が空です。先に astro build を実行してください。`);
  process.exit(1);
}

// 1) HTML: module script / modulepreload、および classic 化された外部 script の収集
const classicScriptUrls = new Set();

for (const file of files.filter((f) => f.toLowerCase().endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');

  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const src = attr(tag, 'src');
    if (!src) continue;

    if (attr(tag, 'type') === 'module') {
      add(file, 'module script', src, 'patch-dist-assets.mjs が type を外せていません');
    } else if (isAbsolute(src)) {
      classicScriptUrls.add(src);
    }
  }

  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const href = attr(tag, 'href');
    if (attr(tag, 'rel')?.toLowerCase() === 'modulepreload' && href && isAbsolute(href)) {
      add(file, 'modulepreload', href, 'module script を無くせば modulepreload も消えます');
    }
  }
}

// 2) classic 化された外部 script の実体に module 構文が残っていないか
for (const url of classicScriptUrls) {
  const name = url.split('/').pop();
  const local = files.find((f) => path.basename(f) === name);
  if (!local) continue;

  const code = readFileSync(local, 'utf8');
  for (const { name: kind, re } of MODULE_SYNTAX) {
    if (re.test(code)) {
      add(
        local,
        `classic 化したバンドルに ${kind} が残存`,
        url,
        '動的 import() やチャンク分割をやめ、バンドルを自己完結にしてください'
      );
      break;
    }
  }
}

// 3) CSS: CDN 上の @font-face
for (const file of files.filter((f) => f.toLowerCase().endsWith('.css'))) {
  const css = readFileSync(file, 'utf8');
  for (const [block] of css.matchAll(/@font-face\s*\{[^}]*\}/gi)) {
    for (const [, url] of block.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      if (isAbsolute(url)) {
        add(
          file,
          '@font-face',
          url,
          'フォント取得は常に CORS モードです。配信元が ACAO を返すか確認してください'
        );
      }
    }
  }
}

if (problems.length === 0) {
  const n = classicScriptUrls.size;
  console.log(
    '[check-cors-safe] OK: クロスオリジンでブロックされる参照はありません' +
      (n > 0 ? `（classic script ${n} 件を検証済み）。` : '。')
  );
  process.exit(0);
}

console.error(
  '[check-cors-safe] NG: 本番でブラウザにブロックされる / 実行に失敗する参照があります。\n'
);
for (const { file, kind, detail, hint } of problems) {
  console.error(`  ${path.relative(process.cwd(), file)}`);
  console.error(`    ${kind}: ${detail}`);
  console.error(`    → ${hint}\n`);
}
console.error('詳細は docs/coding-rules.md の「クロスオリジン制約」を参照してください。');
process.exit(1);
