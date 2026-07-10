/**
 * ビルド成果物に「クロスオリジンで読めない参照」が混ざっていないか検査する。
 *
 * MakeShop では HTML はショップ本体（例: www.tea-and-coffee.shop）に置き、
 * アセットは CDN（gigaplus.makeshop.jp）に置くため、両者は常にクロスオリジンになる。
 * gigaplus は Access-Control-Allow-Origin を返さないので、CORS モードで取得される
 * 参照はすべてブラウザにブロックされる。
 *
 * CORS モードで取得されるもの（= NG）:
 *   - <script type="module" src="https://cdn/...">
 *   - <link rel="modulepreload" href="https://cdn/...">
 *   - @font-face の src: url(https://cdn/...woff2)
 *
 * CORS 不要なもの（= OK）:
 *   - <script src="https://cdn/..."> （type 無しのクラシックスクリプト）
 *   - <link rel="stylesheet" href="https://cdn/...">
 *   - <img>, background-image など
 *
 * dev サーバーは同一オリジンのため、この事故はローカルで再現しない。
 * 本番で初めて壊れるのを防ぐため、build に組み込んで落とす。
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIST = process.env.DIST || 'dist';

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const isAbsolute = (url) => /^https?:\/\//i.test(url);
const attr = (tag, name) =>
  tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1];

function findInHtml(html) {
  const problems = [];

  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const src = attr(tag, 'src');
    if (src && isAbsolute(src) && attr(tag, 'type') === 'module') {
      problems.push({
        kind: 'module script',
        url: src,
        hint: 'この <script> をインライン化するか is:inline で書いてください',
      });
    }
  }

  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attr(tag, 'rel');
    const href = attr(tag, 'href');
    if (rel?.toLowerCase() === 'modulepreload' && href && isAbsolute(href)) {
      problems.push({
        kind: 'modulepreload',
        url: href,
        hint: 'module script を無くせば modulepreload も消えます',
      });
    }
  }

  return problems;
}

function findInCss(css) {
  const problems = [];
  for (const [block] of css.matchAll(/@font-face\s*\{[^}]*\}/gi)) {
    for (const [, url] of block.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      if (isAbsolute(url)) {
        problems.push({
          kind: '@font-face',
          url,
          hint: 'フォント取得は常に CORS モードです。CDN が ACAO を返さないなら使えません',
        });
      }
    }
  }
  return problems;
}

const files = await walk(DIST);
if (files.length === 0) {
  console.error(`[check-cors-safe] ${DIST}/ が空です。先に astro build を実行してください。`);
  process.exit(1);
}

const found = [];
for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.html' && ext !== '.css') continue;
  const source = await readFile(file, 'utf8');
  const problems = ext === '.html' ? findInHtml(source) : findInCss(source);
  for (const problem of problems) found.push({ file, ...problem });
}

if (found.length === 0) {
  console.log('[check-cors-safe] OK: クロスオリジンでブロックされる参照はありません。');
  process.exit(0);
}

console.error('[check-cors-safe] NG: 本番でブラウザにブロックされる参照があります。\n');
for (const { file, kind, url, hint } of found) {
  console.error(`  ${path.relative(process.cwd(), file)}`);
  console.error(`    ${kind}: ${url}`);
  console.error(`    → ${hint}\n`);
}
console.error('詳細は docs/coding-rules.md の「クロスオリジン制約」を参照してください。');
process.exit(1);
