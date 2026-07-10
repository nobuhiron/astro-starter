// sample-colors.mjs — デザイン/コーディングルール画像から代表色を抽出する。
// variables.css の Project Editable Tokens(base 6色・palette・gradient)を埋める材料にする。
//
// 使い方 (PowerShell, プロジェクト cwd で実行):
//   $env:NODE_PATH="$PWD\node_modules"
//   $env:SRC="C:/Users/kyoei266/Downloads/コーディングルール.png"
//   node "C:/Users/kyoei266/.claude/skills/seasonal-lp/scripts/sample-colors.mjs"
//
// env:
//   SRC     入力画像 (必須)
//   POINTS  "ラベル:xRatio,yRatio;..." で任意座標を指定 (比率 0..1)。
//           未指定なら代表 9 点 (四隅+辺中央+中心) を自動サンプル。
//   R       平均を取る半径 px (既定 6)
//   PALETTE "1" で頻出色トップ N も出力 (sharp stats ベースの粗い近似)
import path from 'node:path';
import { createRequire } from 'node:module';
// 依存(sharp)は対象プロジェクト側に導入済み。cwd の node_modules から解決する。
const require = createRequire(path.join(process.cwd(), 'package.json'));
const sharp = require('sharp');

const SRC = process.env.SRC;
if (!SRC) { console.error('SRC is required'); process.exit(1); }
const R = Number(process.env.R || 6);

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const hex = (n) => n.toString(16).padStart(2, '0');

function avg(cx, cy, r = R) {
  let R_ = 0, G = 0, B = 0, n = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = Math.round(cx + dx), y = Math.round(cy + dy);
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const idx = (y * width + x) * channels;
    R_ += data[idx]; G += data[idx + 1]; B += data[idx + 2]; n++;
  }
  R_ = Math.round(R_ / n); G = Math.round(G / n); B = Math.round(B / n);
  return { rgb: [R_, G, B], hex: `#${hex(R_)}${hex(G)}${hex(B)}` };
}

let points;
if (process.env.POINTS) {
  points = process.env.POINTS.split(';').filter(Boolean).map((s) => {
    const [label, coord] = s.split(':');
    const [xr, yr] = coord.split(',').map(Number);
    return { label, x: width * xr, y: height * yr };
  });
} else {
  points = [
    ['top-left', 0.1, 0.05], ['top-center', 0.5, 0.05], ['top-right', 0.9, 0.05],
    ['mid-left', 0.1, 0.5], ['center', 0.5, 0.5], ['mid-right', 0.9, 0.5],
    ['bot-left', 0.1, 0.95], ['bot-center', 0.5, 0.95], ['bot-right', 0.9, 0.95],
  ].map(([label, xr, yr]) => ({ label, x: width * xr, y: height * yr }));
}

const samples = points.map((p) => ({ label: p.label, x: Math.round(p.x), y: Math.round(p.y), ...avg(p.x, p.y) }));
const result = { src: SRC, width, height, samples };

if (process.env.PALETTE === '1') {
  const { dominant } = await sharp(SRC).stats();
  result.dominant = dominant ? { rgb: [dominant.r, dominant.g, dominant.b], hex: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}` } : null;
}

console.log(JSON.stringify(result, null, 2));
