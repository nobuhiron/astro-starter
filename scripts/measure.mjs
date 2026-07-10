// measure.mjs — カンプ/スクショの余白・要素寸法を「目測でなく計測」で得る。
// 行(または列)ごとに背景色と異なるピクセル数を数え、コンテンツの帯(band)と
// 余白(gap)の境界 px を JSON で出力する。カンプの余白/要素高さ/文字サイズを
// 数値で確定し、snapshot.mjs の bbox と直接突き合わせるための道具。
//
// 使い方 (PowerShell, プロジェクト cwd で実行):
//   $env:SRC="tmp/tiles/tile-03.png"
//   node scripts/measure.mjs
//   # セクション内の横方向(左右余白・カラム間)を測る:
//   $env:SRC="tmp/tiles/tile-03.png"; $env:AXIS="x"; $env:REGION="0,400,1200,300"
//
// env:
//   SRC      入力画像 (必須)
//   REGION   "left,top,width,height" で解析範囲を限定 (raw px, 既定は全体)
//   AXIS     "y"(既定, 横帯=縦方向の寸法) / "x"(縦帯=横方向の寸法)
//   SCALE    カンプ倍率 (カンプ幅 / 375 など)。指定すると css px 換算も出力
//   BG       背景色 "#rrggbb" を明示。既定 "auto" (解析範囲の外周から推定)
//   DELTA    背景との差とみなす閾値 0-255 (既定 12。JPEGノイズが多ければ上げる)
//   MIN_GAP  これ未満の隙間 px は帯を分割しない (既定 3)
//   MIN_BAND これ未満の帯 px はノイズとして捨てる (既定 2)
//   MIN_PX   1行(列)を「コンテンツ」と数える最少ピクセル数 (既定 max(2, 幅の0.3%))
import path from 'node:path';
import { createRequire } from 'node:module';
// 依存(sharp)は対象プロジェクト側に導入済み。cwd の node_modules から解決する。
const require = createRequire(path.join(process.cwd(), 'package.json'));
const sharp = require('sharp');

const SRC = process.env.SRC;
if (!SRC) { console.error('SRC is required'); process.exit(1); }
const AXIS = (process.env.AXIS || 'y').toLowerCase() === 'x' ? 'x' : 'y';
const SCALE = Number(process.env.SCALE || 1);
const DELTA = Number(process.env.DELTA || 12);
const MIN_GAP = Number(process.env.MIN_GAP || 3);
const MIN_BAND = Number(process.env.MIN_BAND || 2);

let img = sharp(SRC).flatten({ background: '#ffffff' }).toColourspace('srgb');
const meta = await sharp(SRC).metadata();

let region = { left: 0, top: 0, width: meta.width, height: meta.height };
if (process.env.REGION) {
  const [l, t, w, h] = process.env.REGION.split(',').map(Number);
  region = { left: l, top: t, width: w, height: h };
  img = img.extract(region);
}

// 巨大画像の raw 展開はメモリを食うため上限を設ける(全体カンプは crop-tiles 後のタイルを測る)
if (region.width * region.height > 60_000_000) {
  console.error(`Region too large (${region.width}x${region.height}). Use REGION or measure a cropped tile.`);
  process.exit(1);
}

const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const MIN_PX = Number(process.env.MIN_PX || Math.max(2, Math.round((AXIS === 'y' ? width : height) * 0.003)));

// --- 背景色: 明示指定 or 外周ピクセルの最頻色(16階調で量子化)から推定 ---
function parseHex(hexStr) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hexStr.trim());
  if (!m) { console.error('BG must be #rrggbb'); process.exit(1); }
  const n = parseInt(m[1], 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
function detectBg() {
  const bins = new Map();
  const push = (x, y) => {
    const i = (y * width + x) * channels;
    const key = (data[i] >> 4) << 8 | (data[i + 1] >> 4) << 4 | (data[i + 2] >> 4);
    const b = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
    bins.set(key, b);
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  let best = null;
  for (const b of bins.values()) if (!best || b.n > best.n) best = b;
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}
const bg = process.env.BG && process.env.BG !== 'auto' ? parseHex(process.env.BG) : detectBg();
const hex = (n) => n.toString(16).padStart(2, '0');
const bgHex = `#${hex(bg[0])}${hex(bg[1])}${hex(bg[2])}`;

// --- プロファイル: 行(y) / 列(x) ごとに背景と DELTA 超で異なるピクセル数 ---
const lineCount = AXIS === 'y' ? height : width;
const active = new Array(lineCount).fill(0);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const d = Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2]));
    if (d > DELTA) active[AXIS === 'y' ? y : x]++;
  }
}

// --- 帯の検出: 連続する active 行をまとめ、MIN_GAP 未満の隙間は結合 ---
let bands = [];
let cur = null;
for (let i = 0; i < lineCount; i++) {
  if (active[i] >= MIN_PX) {
    if (!cur) cur = { start: i, end: i };
    else cur.end = i;
  } else if (cur && i - cur.end >= MIN_GAP) {
    bands.push(cur); cur = null;
  }
}
if (cur) bands.push(cur);
bands = bands.filter((b) => b.end - b.start + 1 >= MIN_BAND);

const offset = AXIS === 'y' ? region.top : region.left;
const css = (v) => (SCALE !== 1 ? +(v / SCALE).toFixed(1) : undefined);
const bandsOut = bands.map((b) => {
  const start = b.start + offset, end = b.end + offset + 1, size = end - start;
  return { start, end, size, cssStart: css(start), cssSize: css(size) };
});
const gapsOut = [];
let prev = offset;
for (const b of bandsOut) {
  if (b.start > prev) gapsOut.push({ start: prev, end: b.start, size: b.start - prev, cssSize: css(b.start - prev) });
  prev = b.end;
}
const limit = offset + lineCount;
if (prev < limit) gapsOut.push({ start: prev, end: limit, size: limit - prev, cssSize: css(limit - prev) });

console.log(JSON.stringify({
  src: SRC, axis: AXIS, region, imageSize: { w: meta.width, h: meta.height },
  bg: bgHex, params: { delta: DELTA, minGap: MIN_GAP, minBand: MIN_BAND, minPx: MIN_PX, scale: SCALE },
  bands: bandsOut, gaps: gapsOut,
}, null, 2));
