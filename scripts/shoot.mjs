// shoot.mjs — Playwright でビルド結果(dev サーバ)を撮影する。
// SP 本体は --layout-main-width (既定 375px)。セクション単位 or 全画面で撮れる。
// アニメ/トランジションは無効化してから撮影する。
//
// 使い方 (別ターミナルで pnpm dev 起動済み前提 / プロジェクトルートで実行):
//   OUT=tmp/shot.png SELECTOR=".p-ranking" node scripts/shoot.mjs        (bash)
//   $env:OUT="tmp/shot.png"; node scripts/shoot.mjs                      (PowerShell)
//
// env:
//   URL       既定 http://localhost:4321/
//   OUT       出力 PNG (既定 tmp/shot.png)
//   WIDTH     ビューポート幅 (既定 375 = SP本体幅)
//   SELECTOR  指定時はその要素だけ clip。未指定なら全画面(FULL)
//   FULL      "1" でフルページ撮影 (SELECTOR 未指定時の既定挙動)
//   SCALE     deviceScaleFactor (既定 2)
//   WAIT      追加待機 ms (既定 1200)
//   CHANNEL   "msedge"/"chrome" 等。指定するとそのシステムブラウザを使う
//             (Playwright 管理 chromium を別途 install せずに済む / Windows は msedge が常設)
import { chromium } from 'playwright';

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
await page.waitForTimeout(WAIT);

if (SELECTOR) {
  const target = await page.$(SELECTOR);
  if (!target) { console.error('Selector not found:', SELECTOR); await browser.close(); process.exit(1); }
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const box = await target.boundingBox();
  if (!box) { console.error('No bounding box for', SELECTOR); await browser.close(); process.exit(1); }
  await page.screenshot({ path: OUT, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
} else {
  await page.screenshot({ path: OUT, fullPage: FULL });
}

console.log('Saved:', OUT, JSON.stringify({ url: URL, width: WIDTH, selector: SELECTOR || '(full)', scale: SCALE }));
await browser.close();
