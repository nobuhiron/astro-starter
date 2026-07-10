// shoot.mjs — Playwright でビルド結果(dev サーバ)を撮影する。
// SP 本体は 375px。セクション単位 or 全画面で撮れる。アニメ/トランジションは無効化。
//
// 使い方 (PowerShell, プロジェクト cwd で実行 / 別ターミナルで pnpm dev 起動済み前提):
//   $env:NODE_PATH="$PWD\node_modules"
//   $env:OUT="tmp/shot.png"; $env:SELECTOR=".p-ranking"
//   node "C:/Users/kyoei266/.claude/skills/seasonal-lp/scripts/shoot.mjs"
//
// env:
//   URL       既定 http://localhost:4321/
//   OUT       出力 PNG (既定 tmp/shot.png)
//   WIDTH     ビューポート幅 (既定 375 = カンプ幅)
//   SELECTOR  指定時はその要素だけ clip。未指定なら全画面(FULL)
//   FULL      "1" でフルページ撮影 (SELECTOR 未指定時の既定挙動)
//   SCALE     deviceScaleFactor (既定 2)
//   WAIT      追加待機 ms (既定 1200)
//   CLICK     撮影前にクリックするセレクタ(',' 区切りで複数可)。アコーディオンを開いた状態を撮る用
//   CHANNEL   "msedge"/"chrome" 等。指定するとそのシステムブラウザを使う
//             (Playwright 管理の chromium を別途 install せずに済む / Windows は msedge が常設)
import path from 'node:path';
import { createRequire } from 'node:module';
// 依存(playwright)は対象プロジェクト側に導入済み。cwd の node_modules から解決する。
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');

const URL = process.env.URL || 'http://localhost:4321/';
const OUT = process.env.OUT || 'tmp/shot.png';
const WIDTH = Number(process.env.WIDTH || 375);
const SELECTOR = process.env.SELECTOR || '';
const FULL = process.env.FULL === '1' || !SELECTOR;
const SCALE = Number(process.env.SCALE || 2);
const WAIT = Number(process.env.WAIT || 1200);

const CHANNEL = process.env.CHANNEL || '';
const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});
const context = await browser.newContext({
  viewport: { width: WIDTH, height: 1600 },
  deviceScaleFactor: SCALE,
});
const page = await context.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('load', { timeout: 60000 }).catch(() => {});
await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important;}' });
// loading="lazy" の画像はビューポート外キャプチャでは読み込まれないことがあるため、
// 一度最下部までスクロールして全画像のロードを発火させてから先頭に戻す
await page.evaluate(async () => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const bottom = () => document.documentElement.scrollHeight - innerHeight;
  for (let y = 0; y <= bottom(); y += 700) { scrollTo(0, y); await delay(60); }
  scrollTo(0, bottom());
  await delay(200);
  scrollTo(0, 0);
});

// アコーディオン等を開いた状態で撮る
const CLICK = process.env.CLICK || '';
for (const sel of CLICK.split(',').map((s) => s.trim()).filter(Boolean)) {
  const el = page.locator(sel).first();
  if (!(await el.count())) { console.error('CLICK selector not found:', sel); await browser.close(); process.exit(1); }
  await el.click();
  await page.waitForTimeout(300);
}

await page.waitForTimeout(WAIT);

if (SELECTOR) {
  // locator.screenshot はスクロール・ビューポート超えのクリップを Playwright 側で面倒みてくれる
  const target = page.locator(SELECTOR).first();
  if (!(await target.count())) { console.error('Selector not found:', SELECTOR); await browser.close(); process.exit(1); }
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await target.screenshot({ path: OUT, animations: 'disabled' });
} else {
  await page.screenshot({ path: OUT, fullPage: FULL });
}

console.log('Saved:', OUT, JSON.stringify({ url: URL, width: WIDTH, selector: SELECTOR || '(full)', scale: SCALE }));
await browser.close();
