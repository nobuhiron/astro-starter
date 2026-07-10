// crop-tiles.mjs — 巨大な支給画像を高解像の縦タイルに分割する。
// 全体画像(縦に長い)をそのまま Read するとダウンサンプルで文字が潰れるため、
// 元解像度のまま縦に切り出して各タイルを Read できるようにする。
//
// 使い方 (PowerShell, プロジェクト cwd で実行):
//   $env:NODE_PATH="$PWD\node_modules"
//   $env:SRC="C:/Users/kyoei266/Downloads/TOP.png"; $env:OUT_DIR="tmp/tiles"
//   node "C:/Users/kyoei266/.claude/skills/seasonal-lp/scripts/crop-tiles.mjs"
//
// env:
//   SRC       入力画像 (必須)
//   OUT_DIR   出力ディレクトリ (既定 ./tmp/tiles)
//   TILE_H    1タイルの高さ px の上限 (既定 1400)。実際の高さは「幅 × 高さ が
//             BUDGET_PX 以下 かつ 長辺 1500 以下」になるよう自動クランプされる
//             (視覚入力は ~1.15MP / 長辺 1568px を超えると縮小され文字が潰れるため)
//   OVERLAP   タイル間の重なり px (既定 120, 境界で要素が切れても次タイルで読める)
//   MAX_W     横幅がこれを超えたら縮小してから分割 (既定 1200, 0で無効)
//   BUDGET_PX 1タイルの画素数上限 (既定 1_120_000)
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
// 依存(sharp)は対象プロジェクト側に導入済み。cwd の node_modules から解決する。
const require = createRequire(path.join(process.cwd(), 'package.json'));
const sharp = require('sharp');

const SRC = process.env.SRC;
if (!SRC) { console.error('SRC is required'); process.exit(1); }
const OUT_DIR = process.env.OUT_DIR || 'tmp/tiles';
const TILE_H = Number(process.env.TILE_H || 1400);
const OVERLAP = Number(process.env.OVERLAP || 120);
const MAX_W = Number(process.env.MAX_W ?? 1200);

await mkdir(OUT_DIR, { recursive: true });

let img = sharp(SRC);
let meta = await img.metadata();

// 横幅が大きすぎる場合は読みやすさのため一旦縮小（文字は残る範囲で）
if (MAX_W && meta.width > MAX_W) {
  const buf = await img.resize({ width: MAX_W }).toBuffer();
  img = sharp(buf);
  meta = await img.metadata();
}
const baseBuf = await img.png().toBuffer();

const { width, height } = meta;

// 視覚入力の縮小限界(~1.15MP / 長辺1568px)にタイルが収まるよう高さをクランプする
const BUDGET_PX = Number(process.env.BUDGET_PX || 1_120_000);
const tileH = Math.max(200, Math.min(TILE_H, Math.floor(BUDGET_PX / width), 1500));
const clamped = tileH < TILE_H;
const overlap = tileH > OVERLAP * 2 ? OVERLAP : Math.floor(tileH / 4);

const step = Math.max(1, tileH - overlap);
const tiles = [];
let i = 0;
for (let top = 0; top < height; top += step) {
  const h = Math.min(tileH, height - top);
  if (h <= 0) break;
  const out = path.join(OUT_DIR, `tile-${String(i).padStart(2, '0')}.png`);
  await sharp(baseBuf).extract({ left: 0, top, width, height: h }).png().toFile(out);
  tiles.push({ file: out, top, height: h });
  i++;
  if (top + h >= height) break;
}

console.log(JSON.stringify({
  src: SRC, width, height,
  tileH, overlap, clamped: clamped ? `TILE_H ${TILE_H} -> ${tileH} (budget ${BUDGET_PX}px^2)` : false,
  count: tiles.length, tiles,
}, null, 2));
