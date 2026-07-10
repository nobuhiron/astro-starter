// drive.mjs — ページを実際に操作して壊れていないか確かめる。
//
// スクショ差分でも寸法計測でも見つからない事故がある:
//   - 別の要素に覆われてクリックできない（Swiper の .swiper-wrapper は z-index:1 を持つ）
//   - カルーセルが初期化されず、スライドが縦に積まれている
//   - ポップアップが開かない / 閉じない / Escape が効かない
//   - コンソールに例外が出ている
// これらは「クリックしてみる」以外の方法では検出できない。
//
// 何をするか:
//   1. data-* の操作要素を列挙し、順にクリックする
//   2. クリックが 3 秒で通らなければ、何に覆われているかを elementFromPoint で特定する
//   3. aria-expanded / hidden の遷移、ダイアログの開閉、Escape を検証する
//   4. Swiper の初期化とスライド幅（縦積みになっていないか）を確認する
//   5. console.error / pageerror を集める（IGNORE で除外パターンを渡せる）
//
// 使い方 (別ターミナルで pnpm dev 起動済み前提):
//   $env:CHANNEL="msedge"; node scripts/drive.mjs
//
// env:
//   URL      既定 http://localhost:4321/
//   WIDTH    ビューポート幅 (既定 375)。PC を見るなら 1440
//   TRIGGERS クリック対象の属性名を ',' 区切り (既定 data-*-toggle,data-*-trigger の総当り)
//   IGNORE   無視する console エラーの部分一致を ',' 区切り (既定 axobject-query)
//   CHANNEL  "msedge"/"chrome"
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');

const URL = process.env.URL || 'http://localhost:4321/';
const WIDTH = Number(process.env.WIDTH || 375);
const CHANNEL = process.env.CHANNEL || '';
const IGNORE = (process.env.IGNORE || 'axobject-query')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});
const context = await browser.newContext({ viewport: { width: WIDTH, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e.message)));

await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(1500);

const problems = [];
const ok = [];

/** クリックが通らないとき、実際に何がその点を占めているかを調べる */
async function blockedBy(handle) {
  return page.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    if (!top || top === el || el.contains(top)) return null;
    const describe = (n) =>
      `${n.tagName.toLowerCase()}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : ''}`;
    const chain = [];
    for (let n = top; n && n !== document.body; n = n.parentElement) chain.push(describe(n));
    const cs = getComputedStyle(top);
    return { top: describe(top), zIndex: cs.zIndex, position: cs.position, chain: chain.slice(0, 3) };
  }, handle);
}

async function clickChecked(locator, label) {
  const handle = await locator.elementHandle();
  try {
    await locator.click({ timeout: 3000 });
    ok.push(`click: ${label}`);
    return true;
  } catch (err) {
    const b = handle ? await blockedBy(handle) : null;
    if (b) {
      problems.push(
        `${label} をクリックできません。${b.top} (position:${b.position}, z-index:${b.zIndex}) が手前にあります。` +
          ` 対象に position と z-index を明示してください。`
      );
    } else {
      problems.push(`${label} をクリックできません: ${String(err.message).split('\n')[0]}`);
    }
    return false;
  }
}

// --- 1) アコーディオン（aria-expanded を持つボタン） -------------------------
for (const el of await page.locator('[aria-expanded]').all()) {
  const label = (await el.getAttribute('aria-controls')) || (await el.textContent())?.trim().slice(0, 12) || 'toggle';
  const before = await el.getAttribute('aria-expanded');
  if (!(await clickChecked(el, `accordion[${label}]`))) continue;
  await page.waitForTimeout(350);
  const after = await el.getAttribute('aria-expanded');
  if (before === after) {
    problems.push(`accordion[${label}]: クリックしても aria-expanded が ${before} のままです。`);
    continue;
  }
  const controls = await el.getAttribute('aria-controls');
  if (controls) {
    const panel = page.locator(`#${controls}`);
    const visible = await panel.isVisible().catch(() => false);
    if (String(after === 'true') !== String(visible)) {
      problems.push(`accordion[${label}]: aria-expanded=${after} なのにパネルの表示状態が ${visible} です。`);
    } else {
      ok.push(`accordion[${label}]: 開閉とパネル表示が一致`);
    }
  }
}

// --- 2) ダイアログ（[data-*-trigger] → role=dialog） -------------------------
const triggers = await page.locator('[data-treasure-trigger], [data-dialog-trigger]').all();
for (const el of triggers) {
  const key =
    (await el.getAttribute('data-treasure-trigger')) || (await el.getAttribute('data-dialog-trigger')) || '?';
  if (!(await clickChecked(el, `dialog-trigger[${key}]`))) continue;
  await page.waitForTimeout(350);

  const dialog = page.locator('[role="dialog"]:not([hidden])').first();
  if (!(await dialog.count())) {
    problems.push(`dialog-trigger[${key}]: クリックしてもダイアログが開きません。`);
    continue;
  }
  // Escape で閉じるか
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await page.locator('[role="dialog"]:not([hidden])').count()) {
    problems.push(`dialog-trigger[${key}]: Escape で閉じません。`);
    // 閉じないと次に進めないので閉じるボタンを探す
    await page.locator('[data-treasure-close], [data-dialog-close]').first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(250);
  } else {
    ok.push(`dialog-trigger[${key}]: 開いて Escape で閉じる`);
  }
}

// --- 3) カルーセル（縦積みになっていないか） --------------------------------
const carousels = await page.locator('[data-carousel]').all();
for (const el of carousels) {
  const info = await el.evaluate((node) => {
    const slides = [...node.querySelectorAll('.swiper-slide')];
    const wrapper = node.querySelector('.swiper-wrapper');
    return {
      init: !!node.swiper,
      count: slides.length,
      wrapperDisplay: wrapper ? getComputedStyle(wrapper).display : null,
      widths: slides.slice(0, 3).map((s) => Math.round(s.getBoundingClientRect().width)),
      containerWidth: Math.round(node.getBoundingClientRect().width),
      sameRow: slides.length < 2 || Math.abs(slides[0].getBoundingClientRect().top - slides[1].getBoundingClientRect().top) < 2,
    };
  });
  const name = (await el.getAttribute('data-carousel')) || 'carousel';
  if (!info.init) problems.push(`carousel[${name}]: Swiper が初期化されていません。`);
  else if (!info.sameRow) problems.push(`carousel[${name}]: スライドが縦に積まれています（swiper の CSS が当たっていない）。`);
  else if (info.widths[0] >= info.containerWidth)
    problems.push(
      `carousel[${name}]: スライド幅が ${info.widths[0]}px でコンテナ幅 ${info.containerWidth}px と同じです。` +
        ` swiper/css の .swiper-slide{width:100%} に詳細度で負けている可能性があります。`
    );
  else ok.push(`carousel[${name}]: ${info.count} 枚 / スライド幅 ${info.widths[0]}px`);
}

// --- 4) console エラー -------------------------------------------------------
const realErrors = consoleErrors.filter((e) => !IGNORE.some((i) => e.includes(i)));
for (const e of realErrors) problems.push(`console: ${e.split('\n')[0]}`);

// --- 出力 --------------------------------------------------------------------
console.log(`[drive] ${URL} @ ${WIDTH}px`);
for (const line of ok) console.log('  OK  ' + line);
if (problems.length) {
  console.error('');
  for (const p of problems) console.error('  NG  ' + p);
  console.error(`\n[drive] ${problems.length} 件の操作上の問題を検出しました。`);
  await browser.close();
  process.exit(1);
}
console.log('\n[drive] OK: すべての操作が期待どおりです。');
await browser.close();
