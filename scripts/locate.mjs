// locate.mjs — セクション画像が全体カンプのどこに、どの倍率で置かれているかを特定する。
//
// カンプの倍率を輝度しきい値で推定すると、ドロップシャドウを本体と誤認したり、
// 白いボタンをカードの一部と数えたりして静かに間違う。ここでは形そのものを
// 突き合わせる: セクション画像を色々な倍率に縮めてカンプ上を滑らせ、
// 最も一致する (x, y, scale) を返す。
//
// 二段構え:
//   粗探索  … カンプを COARSE_W(既定 180)px 幅に潰し、間引いた画素で総当り。
//              走査中に「現時点の最良」を超えたら即打ち切る。
//   精密化  … 粗探索の最良付近だけを FINE_W(既定 720)px 幅で細かく探す。
//
// 明るさのオフセットに強いよう、各パッチの平均を引いてから比較する
// （カンプ側の平均は積分画像で O(1) に求める）。
//
// confidence は「best から十分離れた次点」とのスコア差 ÷ best。
// 0.15 未満なら似た帯が複数あるので、結果を目視で確認すること。
//
// 使い方 (プロジェクト cwd で実行):
//   $env:COMP="5周年LP.png"; $env:SECTION="C:/.../about.png"; node scripts/locate.mjs
//
// env:
//   COMP     全体カンプ (必須)
//   SECTION  セクション画像 (必須)
//   MIN_F    セクションがカンプ幅に占める比率の下限 (既定 0.15)
//   MAX_F    同 上限 (既定 0.60)
//   STEPS    比率の刻み数 (既定 18)
//   CSS_W    本体の CSS 幅 (既定 375)。SCALE の換算に使う
//   COARSE_W 粗探索の幅 (既定 180) / FINE_W 精密化の幅 (既定 720)
//   FIX_WIDTH  セクションのカンプ内幅(px)を固定して y だけ探す。
//              テクスチャの乏しいセクション(平坦な背景のフッター等)は倍率が
//              一意に決まらないため、confidence の高いセクションで求めた幅を渡す
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const sharp = require('sharp');

const COMP = process.env.COMP;
const SECTION = process.env.SECTION;
if (!COMP || !SECTION) {
  console.error('COMP と SECTION は必須です');
  process.exit(1);
}
const MIN_F = Number(process.env.MIN_F || 0.15);
const MAX_F = Number(process.env.MAX_F || 0.6);
const STEPS = Number(process.env.STEPS || 18);
const CSS_W = Number(process.env.CSS_W || 375);
const COARSE_W = Number(process.env.COARSE_W || 180);
const FINE_W = Number(process.env.FINE_W || 720);
const FIX_WIDTH = Number(process.env.FIX_WIDTH || 0); // カンプ px。0 なら倍率も探索する

async function grey(src, width) {
  const { data, info } = await sharp(src)
    .flatten({ background: '#ffffff' })
    .greyscale()
    .resize({ width })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** 積分画像。矩形和を O(1) で取る */
function integral(img) {
  const { data, w, h } = img;
  const S = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += data[y * w + x];
      S[(y + 1) * (w + 1) + (x + 1)] = S[y * (w + 1) + (x + 1)] + row;
    }
  }
  return { S, w, h };
}
const rectSum = (I, x, y, w, h) => {
  const W = I.w + 1;
  return I.S[(y + h) * W + (x + w)] - I.S[y * W + (x + w)] - I.S[(y + h) * W + x] + I.S[y * W + x];
};

/**
 * 平均を引いた絶対差の平均。best を超えたら即打ち切る。
 * カンプ下端で切れている場合（フッターなど）は、収まっている行だけで評価する。
 * ただし MIN_COVER 未満しか重ならない位置は候補にしない。
 */
const MIN_COVER = Number(process.env.MIN_COVER || 0.6);

function zeroMeanMad(sec, secMean, comp, I, x, y, sx, sy, best) {
  const visibleH = Math.min(sec.h, comp.h - y);
  if (visibleH < sec.h * MIN_COVER) return Infinity;
  const patchMean = rectSum(I, x, y, sec.w, visibleH) / (sec.w * visibleH);
  let sum = 0;
  let n = 0;
  for (let j = 0; j < visibleH; j += sy) {
    const so = j * sec.w;
    const co = (y + j) * comp.w + x;
    for (let i = 0; i < sec.w; i += sx) {
      sum += Math.abs(sec.data[so + i] - secMean - (comp.data[co + i] - patchMean));
      n++;
    }
    if (n > 200 && sum / n > best * 1.6) return Infinity; // 見込みなし
  }
  return n ? sum / n : Infinity;
}

const mean = (img) => {
  let s = 0;
  for (let i = 0; i < img.data.length; i++) s += img.data[i];
  return s / img.data.length;
};

const compMeta = await sharp(COMP).metadata();
const secMeta = await sharp(SECTION).metadata();
const aspect = secMeta.height / secMeta.width;

async function search({ compW, fList, xRange, yRange, xStep, yStep }) {
  const comp = await grey(COMP, compW);
  const I = integral(comp);
  let best = { score: Infinity };
  const all = [];

  for (const f of fList) {
    const w = Math.round(compW * f);
    if (w < 8) continue;
    const h = Math.round(aspect * w);
    if (h >= comp.h) continue;
    const sec = await grey(SECTION, w);
    const secMean = mean(sec);
    const sx = Math.max(1, Math.round(sec.w / 24));
    const sy = Math.max(1, Math.round(sec.h / 48));

    const x0 = Math.max(0, xRange ? Math.round(xRange[0] * compW) : 0);
    const x1 = Math.min(comp.w - sec.w, xRange ? Math.round(xRange[1] * compW) : comp.w - sec.w);
    const y0 = Math.max(0, yRange ? Math.round(yRange[0] * comp.h) : 0);
    const yMax = comp.h - Math.ceil(sec.h * MIN_COVER);
    const y1 = Math.min(yMax, yRange ? Math.round(yRange[1] * comp.h) : yMax);

    // 端点を必ず含める。刻みで飛ばすと、ページ最下部にあるフッターが見つからない
    const positions = (a, b, step) => {
      const out = [];
      for (let v = a; v <= b; v += step) out.push(v);
      if (out[out.length - 1] !== b && b >= a) out.push(b);
      return out;
    };

    for (const x of positions(x0, x1, xStep)) {
      for (const y of positions(y0, y1, yStep)) {
        const sc = zeroMeanMad(sec, secMean, comp, I, x, y, sx, sy, best.score);
        if (sc === Infinity) continue;
        all.push({ f, x, y, w: sec.w, h: sec.h, score: sc });
        if (sc < best.score) best = { f, x, y, w: sec.w, h: sec.h, score: sc };
      }
    }
  }
  return { best, all, compW, compH: (await grey(COMP, compW)).h };
}

// --- 粗探索 -----------------------------------------------------------------
const fList = FIX_WIDTH
  ? [FIX_WIDTH / compMeta.width]
  : Array.from({ length: STEPS }, (_, i) => MIN_F + ((MAX_F - MIN_F) * i) / Math.max(1, STEPS - 1));
const coarse = await search({ compW: COARSE_W, fList, xStep: 2, yStep: 3 });
if (!isFinite(coarse.best.score)) {
  console.error('候補が見つかりませんでした。MIN_F / MAX_F を広げてください。');
  process.exit(1);
}

// --- 精密化: 粗探索の最良付近だけを高解像で ---------------------------------
const cb = coarse.best;
const fSpan = (MAX_F - MIN_F) / Math.max(1, STEPS - 1);
const fineF = [];
if (FIX_WIDTH) fineF.push(cb.f);
else for (let d = -1; d <= 1; d += 0.25) fineF.push(Math.max(MIN_F, Math.min(MAX_F, cb.f + d * fSpan)));

const pad = 0.02;
const fine = await search({
  compW: FINE_W,
  fList: [...new Set(fineF)],
  xRange: [Math.max(0, cb.x / COARSE_W - pad), Math.min(1, (cb.x + cb.w) / COARSE_W + pad)],
  yRange: [Math.max(0, cb.y / coarse.compH - pad), Math.min(1, (cb.y + cb.h) / coarse.compH + pad)],
  xStep: 2,
  yStep: 2,
});

// --- 仕上げ: 精密化の最良付近で、幅を 1px 刻み・位置を 1px 刻みで詰める ------
let best = isFinite(fine.best.score) ? fine.best : cb;
let usedW = isFinite(fine.best.score) ? FINE_W : COARSE_W;

if (isFinite(fine.best.score)) {
  const comp = await grey(COMP, FINE_W);
  const I = integral(comp);
  const fb = fine.best;
  let polished = { ...fb };

  const wLo = FIX_WIDTH ? Math.round((FIX_WIDTH / compMeta.width) * FINE_W) : Math.max(8, fb.w - 5);
  const wHi = FIX_WIDTH ? wLo : fb.w + 5;
  for (let w = wLo; w <= wHi; w++) {
    const h = Math.round(aspect * w);
    if (h >= comp.h) continue;
    const sec = await grey(SECTION, w);
    const secMean = mean(sec);
    const sx = Math.max(1, Math.round(sec.w / 40));
    const sy = Math.max(1, Math.round(sec.h / 80));
    for (let x = Math.max(0, fb.x - 6); x <= Math.min(comp.w - w, fb.x + 6); x++) {
      const yCap = comp.h - Math.ceil(h * MIN_COVER);
      for (let y = Math.max(0, fb.y - 6); y <= Math.min(yCap, fb.y + 6); y++) {
        const sc = zeroMeanMad(sec, secMean, comp, I, x, y, sx, sy, polished.score);
        if (sc < polished.score) polished = { f: w / FINE_W, x, y, w, h: sec.h, score: sc };
      }
    }
  }
  best = polished;
  usedW = FINE_W;
}

// --- 信頼度: 粗探索の結果から、best から十分離れた次点を探す ------------------
coarse.all.sort((a, b) => a.score - b.score);
const far = coarse.all.find((r) => Math.abs(r.x - cb.x) > cb.w / 3 || Math.abs(r.y - cb.y) > cb.h / 3);
const confidence = far ? +((far.score - cb.score) / (cb.score || 1)).toFixed(3) : 1;

const k = compMeta.width / usedW;
const compScalePerCss = (best.w * k) / CSS_W;

console.log(
  JSON.stringify(
    {
      comp: { src: COMP, width: compMeta.width, height: compMeta.height },
      section: { src: SECTION, width: secMeta.width, height: secMeta.height },
      placement: {
        x: Math.round(best.x * k),
        y: Math.round(best.y * k),
        width: Math.round(best.w * k),
        height: Math.round(best.h * k),
      },
      compScalePerSectionPx: +((best.w * k) / secMeta.width).toFixed(4),
      sectionScalePerCssPx: +(secMeta.width / CSS_W).toFixed(4),
      compScalePerCssPx: +compScalePerCss.toFixed(4),
      coverage: +Math.min(1, (compMeta.height - Math.round(best.y * k)) / Math.round(best.h * k)).toFixed(3),
      meanAbsDiff: +best.score.toFixed(2),
      confidence,
    },
    null,
    2
  )
);

if (confidence < 0.15) {
  console.error('\n[locate] confidence が低いです。似た帯が複数あるため、結果を目視で確認してください。');
}
