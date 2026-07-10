// check-html.mjs — ビルド成果物の HTML が「ブラウザに書き換えられていないか」を検査する。
//
// 狙いは foster parenting の検出。<tr> の直下に <span> を置くなど、テーブルの
// コンテンツモデルに反する要素はパーサがテーブルの外へ押し出す。型チェックも
// ビルドも通り、見た目も一見それらしいのに、要素が消える／別の場所に出る。
//
// 検出方法: parse5 でソース位置つきに解析し、各要素について
//   「ソース上でその要素を最も内側に包んでいる要素」と「ツリー上の親」
// が一致するかを見る。ずれていれば、その要素はパーサに移動させられている。
// 併せて parse5 のトークナイザエラー(重複属性など)も報告する。
//
// 使い方 (プロジェクト cwd で実行。既定は dist/ を走査):
//   node scripts/check-html.mjs
//   $env:FILES="dist/index.html"; node scripts/check-html.mjs
//
// env:
//   FILES  検査する HTML を ',' 区切りで指定 (未指定なら dist/**/*.html)
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { parse } = require('parse5');

async function collectHtml(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectHtml(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = process.env.FILES
  ? process.env.FILES.split(',').map((s) => s.trim()).filter(Boolean)
  : await collectHtml('dist').catch(() => []);

if (files.length === 0) {
  console.error('検査対象の HTML がありません。先に `pnpm build` を実行してください。');
  process.exit(1);
}

/** 要素の「開始タグの終わり」と「終了タグの始まり」= 中身の範囲 */
const contentSpan = (node) => {
  const loc = node.sourceCodeLocation;
  if (!loc) return null;
  const start = loc.startTag ? loc.startTag.endOffset : loc.startOffset;
  const end = loc.endTag ? loc.endTag.startOffset : loc.endOffset;
  return start <= end ? { start, end } : null;
};

/** ソース位置を持つ最も近い祖先（parse5 が暗黙補完した tbody 等を飛ばす） */
const locatedAncestor = (node) => {
  let p = node.parentNode;
  while (p && !p.sourceCodeLocation) p = p.parentNode;
  return p;
};

let problems = 0;

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const tokenErrors = [];
  const doc = parse(html, {
    sourceCodeLocationInfo: true,
    onParseError: (err) => tokenErrors.push(err),
  });

  // ソース位置を持つ要素を全部集める
  const elements = [];
  const walk = (node) => {
    if (node.tagName && node.sourceCodeLocation) elements.push(node);
    for (const child of node.childNodes || []) walk(child);
  };
  walk(doc);

  // 各要素について、ソース上で最も内側に包む要素を求める
  const spans = elements
    .map((el) => ({ el, span: contentSpan(el) }))
    .filter((e) => e.span);

  for (const { el } of spans) {
    const loc = el.sourceCodeLocation;
    let innermost = null;
    for (const { el: other, span } of spans) {
      if (other === el) continue;
      if (span.start <= loc.startOffset && loc.endOffset <= span.end) {
        if (!innermost || span.end - span.start < innermost.size) {
          innermost = { el: other, size: span.end - span.start };
        }
      }
    }
    if (!innermost) continue;

    const treeParent = locatedAncestor(el);
    if (treeParent && treeParent !== innermost.el) {
      problems++;
      console.error(
        `${file}:${loc.startLine}:${loc.startCol}  <${el.tagName}> は ` +
          `ソース上は <${innermost.el.tagName}> の中にあるが、` +
          `ブラウザは <${treeParent.tagName}> の下へ移動させる（foster parenting 等）`
      );
    }
  }

  for (const err of tokenErrors) {
    if (err.code === 'missing-doctype') continue; // Astro 出力では起きないが念のため
    problems++;
    console.error(`${file}:${err.startLine}:${err.startCol}  parse error: ${err.code}`);
  }
}

if (problems > 0) {
  console.error(`\n[check-html] ${problems} 件の構造問題を検出しました。`);
  process.exit(1);
}
console.log(`[check-html] OK: ${files.length} ファイル。要素の移動・パースエラーはありません。`);
