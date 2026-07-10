// check-css-order.mjs — CSS の読み込み順と取りこぼしを静的に検査する。
//
// テンプレ既定の style.css は products → components の順で、FLOCSS の
// カスケード（component < project）と逆になっていることがある。この順だと
// component 側の `.c-placeholder { width:100% }` のような指定が、
// `p-*` 側の幅指定を「同詳細度の後勝ち」で全部打ち消す。型チェックもビルドも
// 通り、崩れ方も派手ではないため、計測して初めて気づく。
//
// 併せて次も見る:
//   - 各レイヤの index.css が、同ディレクトリの css を全部 import しているか
//   - 実装レイヤ(components/products)に色の直書きが残っていないか
//   - !important が使われていないか
//
// 使い方 (プロジェクト cwd で実行):
//   node scripts/check-css-order.mjs
//
// env:
//   ENTRY   エントリ CSS (既定 src/styles/style.css)
//   LAYERS  期待する順序を ',' 区切りで (既定 global,foundation,layout,components,products)
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ENTRY = process.env.ENTRY || 'src/styles/style.css';
const LAYERS = (process.env.LAYERS || 'global,foundation,layout,components,products')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const IMPL_LAYERS = ['components', 'products'];
let problems = 0;
const fail = (msg) => {
  problems++;
  console.error(msg);
};

// 1) エントリの import 順が FLOCSS のカスケード順か
const entry = await readFile(ENTRY, 'utf8');
const imported = [...entry.matchAll(/@import\s+['"]\.\/([^/'"]+)\//g)].map((m) => m[1]);
const expected = LAYERS.filter((l) => imported.includes(l));

if (imported.join(',') !== expected.join(',')) {
  fail(
    `${ENTRY}: @import の順序が FLOCSS のカスケード順ではありません。\n` +
      `  実際: ${imported.join(' → ')}\n` +
      `  期待: ${expected.join(' → ')}\n` +
      `  （後に読むレイヤほど強い。component より project(products) を後に読む）`
  );
}

// 2) 各レイヤの index.css が同ディレクトリの css を全部 import しているか
const stylesDir = path.dirname(ENTRY);
for (const layer of imported) {
  const dir = path.join(stylesDir, layer);
  let indexCss;
  try {
    indexCss = await readFile(path.join(dir, 'index.css'), 'utf8');
  } catch {
    continue; // index.css を持たないレイヤはスキップ
  }
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.css') || file === 'index.css') continue;
    if (!indexCss.includes(file)) fail(`${dir}/${file}: ${layer}/index.css から import されていません（デッド CSS）`);
  }
}

/** ブロックコメントを空白に潰す（行番号と桁を保つ） */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

// 3) 実装レイヤの色の直書きと !important（コメント内は対象外）
for (const layer of IMPL_LAYERS) {
  const dir = path.join(stylesDir, layer);
  let files;
  try {
    files = await readdir(dir);
  } catch {
    continue;
  }
  for (const file of files) {
    if (!file.endsWith('.css')) continue;
    const full = path.join(dir, file);
    const src = await readFile(full, 'utf8');
    const code = stripComments(src);
    code.split('\n').forEach((line, i) => {
      // 宣言の値の中にある hex だけを見る（セレクタの #id は除外）
      const decl = /:\s*[^;{]*$|:\s*[^;{]*;/.exec(line);
      if (decl && /#[0-9a-fA-F]{3,8}\b/.test(decl[0])) {
        fail(`${full}:${i + 1}: 色の直書き（variables.css の token を使う）: ${line.trim()}`);
      }
      if (/!important/.test(line)) {
        fail(`${full}:${i + 1}: !important は使わない（詳細度で解決する）: ${line.trim()}`);
      }
    });
  }
}

if (problems > 0) {
  console.error(`\n[check-css-order] ${problems} 件。`);
  process.exit(1);
}
console.log('[check-css-order] OK: カスケード順・import 漏れ・色の直書き・!important いずれも問題なし。');
