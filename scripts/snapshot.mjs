// snapshot.mjs — 構造・文言の決定的(deterministic)検証アーティファクトを出力する。
// スクショ差分が苦手な「文言取りこぼし・誤字・要素抜け・見出し階層崩れ」を機械検出するため、
//   1) ARIA snapshot (YAML)   = アクセシビリティツリー(role + テキスト)を列挙
//   2) computed/bbox (JSON)   = 主要要素の font-size/line-height/color/margin と boundingBox
// を吐く。タイルから読んだ「正解テキスト」と突き合わせて答え合わせに使う。
//
// 使い方 (PowerShell, プロジェクト cwd で実行 / pnpm dev 起動済み前提):
//   $env:NODE_PATH="$PWD\node_modules"
//   $env:SELECTOR=".p-ranking"; $env:OUT="tmp/ranking.snapshot.yml"
//   node "C:/Users/kyoei266/.claude/skills/seasonal-lp/scripts/snapshot.mjs"
//
// env:
//   URL       既定 http://localhost:4321/
//   SELECTOR  対象要素 (未指定なら body 全体)
//   OUT       YAML 出力 (既定 tmp/snapshot.yml)。同名 .json に computed/bbox を併出力
//   WIDTH     ビューポート幅 (既定 375)
//   METRICS   computed/bbox を採取するセレクタを ',' 区切りで指定
//             (未指定なら SELECTOR 配下の見出し/段落/ボタン/画像を自動採取)
//   MAX       セレクタごとの採取上限 (既定 13)。超過時は truncated に打ち切りを報告
//   CHANNEL   "msedge"/"chrome" 等。指定するとそのシステムブラウザを使う(別途 install 不要)
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
// 依存(playwright)は対象プロジェクト側に導入済み。cwd の node_modules から解決する。
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');

const URL = process.env.URL || 'http://localhost:4321/';
const SELECTOR = process.env.SELECTOR || 'body';
const OUT = process.env.OUT || 'tmp/snapshot.yml';
const OUT_JSON = OUT.replace(/\.ya?ml$/i, '') + '.json';
const WIDTH = Number(process.env.WIDTH || 375);

const CHANNEL = process.env.CHANNEL || '';
const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});
const context = await browser.newContext({ viewport: { width: WIDTH, height: 1600 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('load', { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1000);

const root = page.locator(SELECTOR).first();
if (!(await root.count())) { console.error('Selector not found:', SELECTOR); await browser.close(); process.exit(1); }

// 1) ARIA snapshot (YAML)
const aria = await root.ariaSnapshot();
await writeFile(OUT, aria, 'utf8');

// 2) computed style + boundingBox
const metricSel = process.env.METRICS
  ? process.env.METRICS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'img'].map((t) => `${SELECTOR} ${t}`);

const MAX = Number(process.env.MAX || 13);
const { metrics, truncated } = await page.evaluate(({ sels, max }) => {
  const want = ['font-family', 'font-size', 'line-height', 'font-weight', 'color', 'background-color',
    'margin-top', 'margin-bottom', 'padding-top', 'padding-bottom', 'text-align'];
  const out = [];
  const truncated = [];
  for (const sel of sels) {
    const els = Array.from(document.querySelectorAll(sel));
    if (els.length > max) truncated.push({ selector: sel, total: els.length, kept: max });
    for (const el of els.slice(0, max)) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const style = {};
      for (const k of want) style[k] = cs.getPropertyValue(k);
      out.push({
        selector: sel,
        text: (el.textContent || '').trim().slice(0, 80),
        box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        style,
        src: el.tagName === 'IMG' ? el.getAttribute('src') : undefined,
        alt: el.tagName === 'IMG' ? el.getAttribute('alt') : undefined,
      });
    }
  }
  return { metrics: out, truncated };
}, { sels: metricSel, max: MAX });

await writeFile(OUT_JSON, JSON.stringify({ url: URL, selector: SELECTOR, width: WIDTH, truncated, metrics }, null, 2), 'utf8');

const note = truncated.length ? ` [truncated: ${truncated.map((t) => `${t.selector} ${t.kept}/${t.total}`).join(', ')}]` : '';
console.log('Saved:', OUT, '(ARIA YAML) +', OUT_JSON, `(${metrics.length} elements)${note}`);
await browser.close();
