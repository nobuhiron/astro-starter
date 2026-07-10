// compare.mjs — デザイン画像(design)と現状スクショ(current)を同じ「幅」に揃えて
// DESIGN | CURRENT | DIFF の3面合成 + 差分率(diffRatio)を出力する。
// 幅合わせなので、縦の寸法ズレ(余白ミス等)は高さの差としてそのまま見える。
// DIFF 面: 赤 = 画素差、青 = current だけにある領域、橙 = design だけにある領域。
// diffRatio は収束判定に使う(例: セクションで ~3% 未満 & 赤の塊が無ければ次へ)。
//
// 使い方 (PowerShell, プロジェクト cwd で実行):
//   $env:DESIGN="tmp/tiles/tile-03.png"; $env:CURRENT="tmp/shot.png"; $env:OUT="tmp/compare.png"
//   node scripts/compare.mjs
//
// env:
//   DESIGN  カンプ(支給)画像 (必須)
//   CURRENT 現状スクショ (必須)
//   OUT     出力 PNG (既定 tmp/compare.png)
//   W       1面の幅 px (既定 min(両画像の幅) = 縮小のみで劣化なし)
//   DELTA   画素差とみなす閾値 0-255 (既定 25。アンチエイリアス差を無視する程度)
//   GAP     面の間隔 px (既定 12)
//   出力は視覚入力の縮小限界(~1.15MP)に収まるよう自動スケールされる(finalScale で報告)
import path from 'node:path';
import { createRequire } from 'node:module';
// 依存(sharp)は対象プロジェクト側に導入済み。cwd の node_modules から解決する。
const require = createRequire(path.join(process.cwd(), 'package.json'));
const sharp = require('sharp');

const DESIGN = process.env.DESIGN;
const CURRENT = process.env.CURRENT;
if (!DESIGN || !CURRENT) { console.error('DESIGN and CURRENT are required'); process.exit(1); }
const OUT = process.env.OUT || 'tmp/compare.png';
const DELTA = Number(process.env.DELTA || 25);
const GAP = Number(process.env.GAP || 12);
const LABEL_H = 36;
const BUDGET_PX = 1_120_000; // 視覚入力が縮小されない上限(~1.15MP)の少し下

const dMeta = await sharp(DESIGN).metadata();
const cMeta = await sharp(CURRENT).metadata();
const W = Number(process.env.W || 0) || Math.min(dMeta.width, cMeta.width);

const norm = (src) => sharp(src).flatten({ background: '#ffffff' }).toColourspace('srgb')
  .resize({ width: W }).raw().toBuffer({ resolveWithObject: true });
const [d, c] = await Promise.all([norm(DESIGN), norm(CURRENT)]);
const hD = d.info.height, hC = c.info.height;
const minH = Math.min(hD, hC), maxH = Math.max(hD, hC);
const chD = d.info.channels, chC = c.info.channels;

// --- 画素差分 + DIFF 面 (グレー化した current の上に 赤=差分 / 青=current余剰 / 橙=design余剰) ---
let diffCount = 0;
const diffBuf = Buffer.alloc(W * maxH * 3);
for (let y = 0; y < maxH; y++) {
  for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3;
    if (y < minH) {
      const di = (y * W + x) * chD, ci = (y * W + x) * chC;
      const delta = Math.max(
        Math.abs(d.data[di] - c.data[ci]),
        Math.abs(d.data[di + 1] - c.data[ci + 1]),
        Math.abs(d.data[di + 2] - c.data[ci + 2]),
      );
      if (delta > DELTA) {
        diffCount++;
        diffBuf[o] = 220; diffBuf[o + 1] = 30; diffBuf[o + 2] = 40;
      } else {
        const g = Math.round((0.299 * c.data[ci] + 0.587 * c.data[ci + 1] + 0.114 * c.data[ci + 2]) * 0.35 + 160);
        diffBuf[o] = g; diffBuf[o + 1] = g; diffBuf[o + 2] = g;
      }
    } else if (hC > hD) { // current が design より長い領域 → 青系
      const ci = (y * W + x) * chC;
      const g = Math.round((0.299 * c.data[ci] + 0.587 * c.data[ci + 1] + 0.114 * c.data[ci + 2]) * 0.3 + 120);
      diffBuf[o] = Math.round(g * 0.55); diffBuf[o + 1] = Math.round(g * 0.75); diffBuf[o + 2] = 255 - Math.round((255 - g) * 0.3);
    } else { // design が current より長い領域 → 橙系
      const di = (y * W + x) * chD;
      const g = Math.round((0.299 * d.data[di] + 0.587 * d.data[di + 1] + 0.114 * d.data[di + 2]) * 0.3 + 120);
      diffBuf[o] = 255 - Math.round((255 - g) * 0.2); diffBuf[o + 1] = Math.round(g * 0.72); diffBuf[o + 2] = Math.round(g * 0.35);
    }
  }
}
const diffRatio = diffCount / (W * minH);
const heightDiffPct = +((hC - hD) / hD * 100).toFixed(2);

const toPng = (buf, ch, h) => sharp(buf, { raw: { width: W, height: h, channels: ch } }).png().toBuffer();
const [dPng, cPng, diffPng] = await Promise.all([
  toPng(d.data, chD, hD), toPng(c.data, chC, hC), toPng(diffBuf, 3, maxH),
]);

const totalW = W * 3 + GAP * 2;
const totalH = maxH + LABEL_H;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const labelSvg = `<svg width="${totalW}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#222"/>
  <text x="${W / 2}" y="24" font-family="sans-serif" font-size="18" fill="#fff" text-anchor="middle">DESIGN ${hD}px</text>
  <text x="${W + GAP + W / 2}" y="24" font-family="sans-serif" font-size="18" fill="#fff" text-anchor="middle">CURRENT ${hC}px (${heightDiffPct >= 0 ? '+' : ''}${esc(heightDiffPct)}%)</text>
  <text x="${(W + GAP) * 2 + W / 2}" y="24" font-family="sans-serif" font-size="18" fill="#fff" text-anchor="middle">DIFF ${esc((diffRatio * 100).toFixed(2))}%</text>
</svg>`;

let composed = sharp({ create: { width: totalW, height: totalH, channels: 3, background: { r: 250, g: 250, b: 250 } } })
  .composite([
    { input: Buffer.from(labelSvg), top: 0, left: 0 },
    { input: dPng, top: LABEL_H, left: 0 },
    { input: cPng, top: LABEL_H, left: W + GAP },
    { input: diffPng, top: LABEL_H, left: (W + GAP) * 2 },
  ]).png();

// 合成結果が視覚入力の縮小限界を超えるなら、こちらで制御してスケールする
let finalScale = 1;
if (totalW * totalH > BUDGET_PX) {
  finalScale = +Math.sqrt(BUDGET_PX / (totalW * totalH)).toFixed(3);
  const buf = await composed.toBuffer();
  composed = sharp(buf).resize({ width: Math.round(totalW * finalScale) }).png();
}
await composed.toFile(OUT);

console.log(JSON.stringify({
  out: OUT, paneWidth: W,
  design: { src: DESIGN, w: dMeta.width, h: dMeta.height, normH: hD },
  current: { src: CURRENT, w: cMeta.width, h: cMeta.height, normH: hC },
  heightDiffPct, delta: DELTA,
  diffRatio: +diffRatio.toFixed(4), diffPct: +(diffRatio * 100).toFixed(2),
  comparedHeight: minH, finalScale,
}, null, 2));
