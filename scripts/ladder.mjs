// ladder.mjs — セクションの高さ差が「どのブロックで生まれたか」を局在化する。
//
// セクション合計の高さだけ見ていると、誤差がどこに溜まっているか分からない。
// 「Campaign01 が -7%」と分かっても、直す場所は分からない。
//
// そこで、カンプ側は行方向の ink バンド（文字や図が乗っている帯）、実装側は
// 指定セレクタの bbox を、それぞれ上から順に並べて突き合わせる。
// 各段の「位置の差」と「直前からの間隔の差」を出すので、誤差が積み上がり
// 始める段が一目で分かる。間隔の差が大きい段が、直すべき余白。
//
// 読み方の注意: Δy はカンプ側が「文字が乗り始める位置(ink)」、実装側が
// 「要素のボックス上端」なので、行間(leading)のぶんだけ系統的にずれる。
// 判断は Δgap（直前の段からの間隔の差）で行うこと。系統誤差は打ち消される。
//
// 使い方 (別ターミナルで pnpm dev 起動済み前提):
//   $env:DESIGN="C:/.../Campagin01.png"; $env:SCALE="4"
//   $env:ROOT="#campaign01"
//   $env:SELECTORS=".c-heading__en,.c-heading__ja,.p-campaign01__bubble,.p-campaign01__friend"
//   $env:CHANNEL="msedge"; node scripts/ladder.mjs
//
// カンプ側の基準は 2 通り:
//   LANDMARKS を渡す … 実測した CSS y を直接指定する（推奨。写真の多いセクションでは
//                       ink バンドの自動検出はブロックを 1 本に融合させてしまう）
//   渡さない        … ink バンドの検出結果を上から順に対応づける（構造の粗い確認用）
// どちらの場合も、検出したバンド一覧は候補として必ず表示する。
//
// env:
//   DESIGN     セクションのカンプ画像 (必須)
//   SCALE      カンプ px / CSS px (既定 4)
//   ROOT       セクションのルートセレクタ (必須)。bbox はここからの相対で見る
//   SELECTORS  ',' 区切り。ドキュメント順に並べる (必須)
//   LANDMARKS  ',' 区切りの CSS y。SELECTORS と同数・同順 (任意)
//   X0 X1      カンプ側で ink を数える横方向の範囲 (px, 既定 全幅)
//   DELTA      背景との差とみなす閾値 (既定 24)
//   MIN_BAND   これ未満の帯 px は捨てる (既定 8)
//   MIN_GAP    これ未満の隙間 px は帯を分けない (既定 12)
//   URL CLICK WIDTH CHANNEL … shoot.mjs と同じ
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const sharp = require('sharp');
const { chromium } = require('playwright');

const DESIGN = process.env.DESIGN;
const ROOT = process.env.ROOT;
const SELECTORS = (process.env.SELECTORS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!DESIGN || !ROOT || SELECTORS.length === 0) {
  console.error('DESIGN / ROOT / SELECTORS は必須です');
  process.exit(1);
}
const SCALE = Number(process.env.SCALE || 4);
const DELTA = Number(process.env.DELTA || 24);
const MIN_BAND = Number(process.env.MIN_BAND || 8);
const MIN_GAP = Number(process.env.MIN_GAP || 12);
const URL = process.env.URL || 'http://localhost:4321/';
const WIDTH = Number(process.env.WIDTH || 375);
const CHANNEL = process.env.CHANNEL || '';

// --- カンプ側: ink バンドを検出 ---------------------------------------------
const { data, info } = await sharp(DESIGN).flatten({ background: '#ffffff' }).toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const X0 = Number(process.env.X0 || 0);
const X1 = Number(process.env.X1 || width);

const px = (x, y) => {
  const i = (y * width + x) * channels;
  return [data[i], data[i + 1], data[i + 2]];
};

/** 各行の背景色は、その行の左右端の平均とする（縦グラデーションに強い） */
const rowBg = (y) => {
  const a = px(1, y);
  const b = px(width - 2, y);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
};

const minPx = Math.max(2, Math.round((X1 - X0) * 0.004));
const active = new Array(height).fill(0);
for (let y = 0; y < height; y++) {
  const bg = rowBg(y);
  let n = 0;
  for (let x = X0; x < X1; x++) {
    const p = px(x, y);
    if (Math.max(Math.abs(p[0] - bg[0]), Math.abs(p[1] - bg[1]), Math.abs(p[2] - bg[2])) > DELTA) n++;
  }
  active[y] = n;
}

const bands = [];
let cur = null;
for (let y = 0; y < height; y++) {
  if (active[y] >= minPx) {
    if (!cur) cur = { s: y, e: y };
    else cur.e = y;
  } else if (cur && y - cur.e >= MIN_GAP) {
    bands.push(cur);
    cur = null;
  }
}
if (cur) bands.push(cur);
const designBands = bands.filter((b) => b.e - b.s + 1 >= MIN_BAND).map((b) => +(b.s / SCALE).toFixed(1));

// --- 実装側: bbox を取得 -----------------------------------------------------
const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});
const context = await browser.newContext({ viewport: { width: WIDTH, height: 1600 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });

for (const sel of (process.env.CLICK || '').split(',').map((s) => s.trim()).filter(Boolean)) {
  await page.locator(sel).first().click();
  await page.waitForTimeout(300);
}
await page.waitForTimeout(800);

const live = await page.evaluate(
  ({ root, sels }) => {
    const r = document.querySelector(root);
    if (!r) return null;
    const top = r.getBoundingClientRect().top + window.scrollY;
    return sels.map((s) => {
      const el = document.querySelector(s);
      if (!el) return { sel: s, y: null };
      const b = el.getBoundingClientRect();
      return { sel: s, y: +(b.top + window.scrollY - top).toFixed(1) };
    });
  },
  { root: ROOT, sels: SELECTORS }
);
await browser.close();

if (!live) {
  console.error(`ROOT が見つかりません: ${ROOT}`);
  process.exit(1);
}

// --- 突き合わせ --------------------------------------------------------------
console.log(`[ladder] design=${path.basename(DESIGN)} (scale ${SCALE}) / root=${ROOT}\n`);
console.log(`カンプの ink バンド (CSS y) — 候補: ${designBands.length} 本`);
console.log('  ' + designBands.join(', ') + '\n');

const LANDMARKS = (process.env.LANDMARKS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

let reference;
if (LANDMARKS.length) {
  if (LANDMARKS.length !== live.length) {
    console.error(`LANDMARKS (${LANDMARKS.length}) と SELECTORS (${live.length}) の数が一致しません。`);
    process.exit(1);
  }
  reference = LANDMARKS;
  console.log('基準: LANDMARKS（実測値）\n');
} else {
  reference = designBands;
  console.log('基準: ink バンド（自動検出）。写真の多いセクションでは融合しやすいので、');
  console.log('      ずれるようなら LANDMARKS に実測値を渡してください。\n');
  if (designBands.length !== live.length) {
    console.log(`注意: バンド ${designBands.length} 本に対しセレクタ ${live.length} 個。上から順に対応づけます。\n`);
  }
}

const rows = [];
const n = Math.min(reference.length, live.length);
for (let i = 0; i < n; i++) {
  const dY = reference[i];
  const lY = live[i].y;
  const dGap = i === 0 ? dY : +(dY - reference[i - 1]).toFixed(1);
  const lGap = i === 0 ? lY : lY === null ? null : +(lY - live[i - 1].y).toFixed(1);
  rows.push({
    i,
    dY,
    lY,
    dGap,
    lGap,
    dyDelta: lY === null ? null : +(lY - dY).toFixed(1),
    gapDelta: lGap === null ? null : +(lGap - dGap).toFixed(1),
    sel: live[i].sel,
  });
}

console.log('  #  design_y   live_y      Δy   design_gap  live_gap    Δgap   selector');
for (const r of rows) {
  const flag = r.gapDelta !== null && Math.abs(r.gapDelta) > 4 ? ' <<' : '';
  console.log(
    '  ' +
      String(r.i).padStart(2) +
      String(r.dY).padStart(10) +
      String(r.lY ?? '—').padStart(9) +
      String(r.dyDelta ?? '—').padStart(8) +
      String(r.dGap).padStart(13) +
      String(r.lGap ?? '—').padStart(10) +
      String(r.gapDelta ?? '—').padStart(8) +
      '   ' +
      r.sel +
      flag
  );
}

const worst = rows.filter((r) => r.gapDelta !== null).sort((a, b) => Math.abs(b.gapDelta) - Math.abs(a.gapDelta))[0];
if (worst && Math.abs(worst.gapDelta) > 4) {
  console.log(
    `\n誤差が最も生まれている段: #${worst.i} ${worst.sel}` +
      `（直前からの間隔が カンプ ${worst.dGap}px に対し 実装 ${worst.lGap}px、${worst.gapDelta > 0 ? '+' : ''}${worst.gapDelta}px）`
  );
} else {
  console.log('\n各段の間隔はカンプと 4px 以内で一致しています。');
}
