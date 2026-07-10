// check-copy.mjs — 支給画像どうしで文言が食い違っていないかを突き合わせる。
//
// 同じラベルが複数の画像に出てくることは多い（バナー / スケジュールのカード /
// セクション見出し / フッターのナビ）。カンプ側の誤植は、この「同じはずの文字列が
// 微妙に違う」という形で現れる。実際、5周年LP では次の 2 件が見つかった:
//   - バナーは Campaign01 だが、セクション見出しは Campagin04（綴り違い）
//   - フッターは 8/3(金) だが、カレンダーと本体は 8/3(月)（曜日が違う）
// どちらも実装の誤りではなくカンプ側の欠陥で、人に確認を上げるべきもの。
//
// 入力: tmp/copy/*.json （画像ごとの書き起こし）
//   { "image": "nav.png", "strings": ["Campaign01", "おめでとう! 大好き!キャンペーン", ...] }
//
// 出力: 「ほぼ同じだが一致しない」文字列の組。編集距離が DIST 以下で、
//       かつ完全一致ではないものを、別画像どうしで報告する。
//
// 使い方:
//   node scripts/check-copy.mjs
//
// env:
//   DIR   書き起こしの置き場 (既定 tmp/copy)
//   DIST  これ以下の編集距離を「同じ文字列のつもり」とみなす (既定 3)
//   MIN   これ未満の長さの文字列は無視する (既定 4)
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = process.env.DIR || 'tmp/copy';
const DIST = Number(process.env.DIST || 3);
const MIN = Number(process.env.MIN || 4);

/** 比較用に正規化する。全角半角・空白・記号ゆれを吸収する */
const normalize = (s) =>
  s
    .normalize('NFKC')
    .replace(/[\s　]+/g, '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** レーベンシュタイン距離（DIST を超えたら打ち切る） */
function levenshtein(a, b, cap) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

let files;
try {
  files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
} catch {
  console.error(`${DIR} がありません。画像ごとの書き起こしを { image, strings } の JSON で置いてください。`);
  process.exit(1);
}
if (files.length < 2) {
  console.error(`${DIR} に 2 つ以上の書き起こしが必要です（画像どうしを突き合わせるため）。`);
  process.exit(1);
}

/** [{ raw, norm, image }] */
const entries = [];
for (const f of files) {
  const doc = JSON.parse(await readFile(path.join(DIR, f), 'utf8'));
  const image = doc.image || f;
  for (const raw of doc.strings || []) {
    const norm = normalize(raw);
    if (norm.length < MIN) continue;
    entries.push({ raw, norm, image });
  }
}

/** 連番は別物なので、数字は伏せてから比べる（Campaign01 と Campaign02 は食い違いではない） */
const maskDigits = (s) => s.replace(/\d/g, '#');

/**
 * 差分の性質で分類する。
 *   substitution … 長さが同じで文字が違う。誤植（Campagin/Campaign、(金)/(月)）の典型
 *   insertion    … 片方がもう片方に連続した文字列を 1 箇所足しただけ。
 *                  略称と正式名の関係（Plus1キャンペーン / 〜第1弾）で、誤植ではない
 */
function classify(a, b) {
  if (a === b) return 'same';
  if (a.length === b.length) return 'substitution';
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let p = 0;
  while (p < short.length && short[p] === long[p]) p++;
  let s = 0;
  while (s < short.length - p && short[short.length - 1 - s] === long[long.length - 1 - s]) s++;
  return p + s === short.length ? 'insertion' : 'mixed';
}

const agreements = new Map(); // norm -> Set(image)
for (const e of entries) {
  if (!agreements.has(e.norm)) agreements.set(e.norm, new Set());
  agreements.get(e.norm).add(e.image);
}

const buckets = { substitution: [], mixed: [], insertion: [] };
const seen = new Set();

for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const a = entries[i];
    const b = entries[j];
    if (a.image === b.image) continue; // 同じ画像内のゆれは対象外
    if (a.norm === b.norm) continue;

    const ma = maskDigits(a.norm);
    const mb = maskDigits(b.norm);
    if (ma === mb) continue; // 連番違いだけ

    const d = levenshtein(ma, mb, DIST);
    if (d > DIST) continue;

    const kind = classify(ma, mb);
    if (kind === 'same') continue;

    const key = [ma, mb].sort().join('||');
    if (seen.has(key)) continue;
    seen.add(key);

    buckets[kind].push({ a, b, d });
  }
}

const shared = [...agreements.values()].filter((imgs) => imgs.size > 1).length;
console.log(`[check-copy] ${files.length} 画像 / ${entries.length} 文字列。複数画像で一致している文字列: ${shared} 件`);

const show = (title, list) => {
  if (list.length === 0) return;
  console.log(`\n${title}`);
  for (const c of list) {
    console.log(`  編集距離 ${c.d}`);
    console.log(`    ${c.a.image}: 「${c.a.raw}」`);
    console.log(`    ${c.b.image}: 「${c.b.raw}」`);
  }
};

show('■ 要確認（置換・転置。誤植の可能性が高い）', buckets.substitution);
show('■ 要確認（挿入と置換が混在）', buckets.mixed);
show('□ 参考（片方が連続した語を足しただけ。略称と正式名の関係と思われる）', buckets.insertion);

const suspicious = buckets.substitution.length + buckets.mixed.length;
if (suspicious === 0) {
  console.log('\n[check-copy] OK: 誤植を疑う食い違いはありません。');
  process.exit(0);
}
console.error(`\n[check-copy] 要確認 ${suspicious} 件。どちらに揃えるかを人に確認してから実装してください。`);
process.exit(1);
