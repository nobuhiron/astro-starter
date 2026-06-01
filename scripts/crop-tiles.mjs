// crop-tiles.mjs — 巨大な支給画像を高解像の縦タイルに分割する。
// 全体画像(縦に長い)をそのまま見るとダウンサンプルで文字が潰れるため、
// 元解像度のまま縦に切り出して各タイルを確認できるようにする。
//
// 使い方 (プロジェクトルートで実行):
//   SRC=design/TOP.png OUT_DIR=tmp/tiles node scripts/crop-tiles.mjs   (bash)
//   $env:SRC="design/TOP.png"; node scripts/crop-tiles.mjs            (PowerShell)
//
// env:
//   SRC      入力画像 (必須)
//   OUT_DIR  出力ディレクトリ (既定 ./tmp/tiles)
//   TILE_H   1タイルの高さ px (既定 1400)
//   OVERLAP  タイル間の重なり px (既定 120, 境界で要素が切れても次タイルで読める)
//   MAX_W    横幅がこれを超えたら縮小してから分割 (既定 1200, 0で無効)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SRC = process.env.SRC;
if (!SRC) { console.error('SRC is required'); process.exit(1); }
const OUT_DIR = process.env.OUT_DIR || 'tmp/tiles';
const TILE_H = Number(process.env.TILE_H || 1400);
const OVERLAP = Number(process.env.OVERLAP || 120);
const MAX_W = Number(process.env.MAX_W ?? 1200);

await mkdir(OUT_DIR, { recursive: true });

let img = sharp(SRC);
let meta = await img.metadata();

if (MAX_W && meta.width > MAX_W) {
  const buf = await img.resize({ width: MAX_W }).toBuffer();
  img = sharp(buf);
  meta = await img.metadata();
}
const baseBuf = await img.png().toBuffer();

const { width, height } = meta;
const step = Math.max(1, TILE_H - OVERLAP);
const tiles = [];
let i = 0;
for (let top = 0; top < height; top += step) {
  const h = Math.min(TILE_H, height - top);
  if (h <= 0) break;
  const out = path.join(OUT_DIR, `tile-${String(i).padStart(2, '0')}.png`);
  await sharp(baseBuf).extract({ left: 0, top, width, height: h }).png().toFile(out);
  tiles.push({ file: out, top, height: h });
  i++;
  if (top + h >= height) break;
}

console.log(JSON.stringify({ src: SRC, width, height, tileH: TILE_H, overlap: OVERLAP, count: tiles.length, tiles }, null, 2));
