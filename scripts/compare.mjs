// compare.mjs — デザイン画像(design)と現状スクショ(current)を同じ高さに揃えて
// 横並び合成し、DESIGN | CURRENT のラベルを付けた1枚の比較画像を出力する。
// 出力画像を見て差分(余白/サイズ/配色/字面)を判断するための道具。
//
// 使い方 (プロジェクトルートで実行):
//   DESIGN=design/section.png CURRENT=tmp/shot.png OUT=tmp/compare.png node scripts/compare.mjs
//
// env:
//   DESIGN  カンプ(支給)画像 (必須)
//   CURRENT 現状スクショ (必須)
//   OUT     出力 PNG (既定 tmp/compare.png)
//   H       揃える高さ px (既定 1200)
//   GAP     2枚の間隔 px (既定 20)
import sharp from 'sharp';

const DESIGN = process.env.DESIGN;
const CURRENT = process.env.CURRENT;
if (!DESIGN || !CURRENT) { console.error('DESIGN and CURRENT are required'); process.exit(1); }
const OUT = process.env.OUT || 'tmp/compare.png';
const H = Number(process.env.H || 1200);
const GAP = Number(process.env.GAP || 20);
const LABEL_H = 36;

const dBuf = await sharp(DESIGN).resize({ height: H }).toBuffer();
const cBuf = await sharp(CURRENT).resize({ height: H }).toBuffer();
const d = await sharp(dBuf).metadata();
const c = await sharp(cBuf).metadata();

const totalW = d.width + c.width + GAP;
const totalH = H + LABEL_H;
const labelSvg = `<svg width="${totalW}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#222"/>
  <text x="${d.width / 2}" y="24" font-family="sans-serif" font-size="18" fill="#fff" text-anchor="middle">DESIGN</text>
  <text x="${d.width + GAP + c.width / 2}" y="24" font-family="sans-serif" font-size="18" fill="#fff" text-anchor="middle">CURRENT</text>
</svg>`;

await sharp({ create: { width: totalW, height: totalH, channels: 4, background: { r: 250, g: 250, b: 250, alpha: 1 } } })
  .composite([
    { input: Buffer.from(labelSvg), top: 0, left: 0 },
    { input: dBuf, top: LABEL_H, left: 0 },
    { input: cBuf, top: LABEL_H, left: d.width + GAP },
  ])
  .png()
  .toFile(OUT);

console.log('Saved:', OUT, JSON.stringify({ design: { w: d.width, h: d.height }, current: { w: c.width, h: c.height } }));
