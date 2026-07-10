# Coding Rules

このドキュメントは、MakeShop LP 用 Astro スターターの実装ルールです。

## 1. Goal

このプロジェクトでは、ブランド体験、アクセシビリティ、Core Web Vitals を重視した EC / LP を制作する。  
速さより一貫性、場当たり対応より再利用しやすい実装を優先する。

## 2. Implementation Principles

実装時は以下を優先する。

- HTML は常にセマンティックに組む
- CSS は FLOCSS + BEM の考え方で整理する
- クラス命名は役割が分かるようにする
- 変更理由を短く説明できる状態で実装する
- アクセシビリティ違反を入れない
- Core Web Vitals を意識する
- レイアウトは `max-width` と `margin: auto` を優先する

接頭辞は以下を使う。

- `l-*`: layout
- `c-*`: component
- `p-*`: page or product specific block

## 3. Non-Negotiable Rules

### HTML

- `<main>`, `<section>`, `<article>`, `<nav>`, `<header>`, `<footer>`, `<aside>` を適切に使う
- 見出しは `h1` から順に階層を守る
- `p` は段落にだけ使い、レイアウト目的では使わない

### CSS

- FLOCSS + BEM の考え方で整理する
- 不要なネストは避ける
- スライダーを導入する場合は Splide を優先する

## 4. CSS Architecture

### Color Tokens

色は [variables.css](../src/styles/global/variables.css) で管理する。

案件ごとに主に編集するのは上部の `--base-*` で、初期状態では次の 6 色を使う。

- `--base-main`
- `--base-accent`
- `--base-sub`
- `--base-text`
- `--base-bg`
- `--base-surface`

実装側では、同ファイル下部の semantic token を使う。

- `--color-text`
- `--color-bg`
- `--color-surface`
- `--color-main`
- `--color-accent`
- `--color-sub`

色が足りなくなった場合だけ、案件ごとに token を追加する。

### Typography

- 基本の文字サイズは `--font-size-base` を基準にする
- 個別サイズは必要に応じて `src/assets/js/functions.js` の `fz()` を使う
- フォントは alias を通して使う
  - `--font-jp--serif`
  - `--font-jp--sanserif`
  - `--font-en`
  - `--font-en--decor`

### Layout Sizing

- レイアウトの器は固定幅より `max-width` を優先する
- `width: 1200px` のような大きな固定幅は避ける
- `max-width`, `margin-inline: auto`, `padding-inline` を基本にする
- 横並びは固定幅より Grid / Flex の自動調整を優先する
- 画像は基本 `width: 100%` と `height: auto`
- `clamp()`, `min()`, `max()` は積極的に使ってよい

### Media Queries and Container Queries

- ページ全体のレイアウト変更は `@media` を使う
- 再利用コンポーネント内部の調整は `@container` を優先する
- `l-*` の大枠や viewport 基準の切り替えは `@media`
- `c-*` の幅依存レイアウトは `@container`
- コンテナクエリを使う要素には `container-type: inline-size` を設定する
- まずは size query を使い、style query は必要になった場合だけ採用する

### Layout and Component Separation

- `.l-*` はページ全体の骨組み用
- `.c-*` は再利用可能な UI 用
- `.p-*` はページ固有、商品固有の見た目用

## 5. Image Rules

画像は `src/assets/images` に置く。

```astro
import hero from '../assets/images/hero.jpg';
```

- 意味のある画像には適切な `alt` を入れる
- 装飾画像は `alt=""` または CSS 背景で扱う
- 画像のサイズや比率を安定させて CLS を防ぐ
- Astro の画像機能を使える場合は優先する
- WebP / AVIF など最適化しやすい形式を優先する

## 6. Accessibility Rules

- セマンティック HTML を ARIA より優先する
- ARIA は必要な場合だけ使う
- `:focus-visible` を消さない
- ボタンやリンクには意味のあるラベルを入れる
- 装飾アイコンや装飾画像だけに `aria-hidden="true"` を使う
- キーボード操作を壊さない
- コントラスト比に注意する

## 7. Reasoned Defaults

- 迷ったら、実装スピードより世界観と一貫性を優先する
- 見た目の調整は `c-*` または `p-*` の中に閉じる
- 可変余白は section 単位で考える
- デザインに直接見えない情報は HTML 構造とラベルで補う

## 8. Performance / Core Web Vitals

- LCP:
  - ヒーロー画像や主要ビジュアルは最適化する
  - Above the fold に不要な JS を置かない
- CLS:
  - 画像や埋め込み要素はサイズを安定させる
  - フォント切り替えで大きくレイアウトが揺れないようにする
- INP:
  - 初期化処理は軽く保つ
  - 重い処理は遅延または操作後に実行する

## 9. Directory Structure

```txt
src/
  assets/
    images/
    js/
  blocks/
  components/
  layouts/
  pages/
  scripts/
  sections/
  styles/
    global/
    foundation/
    layout/
    products/
    components/
```

## 10. Astro: pages and layouts

### `src/pages/`

- URL ごとのページ本体を置く
- Layout を選ぶ
- Section を並べる
- ページ固有の `title` などを渡す

### `src/layouts/`

- `<html>`, `<head>`, `<body>` を含む全体構造を持つ
- CSS / JS の読み込みを担当する
- `<slot />` でページ固有の中身を受け取る

## 11. CSS Loading Rules

- エントリーポイントは `src/styles/style.css`
- `style.css` から各階層の `index.css` を `@import` する

## 12. JavaScript Rules

- JS ファイルは `src/scripts` 配下に作る
- 初期化の入口は `src/scripts/main.js`
- 新しい機能は `src/scripts/[feature].js` に分け、`src/scripts/main.js` から呼び出す
- 動的 `import()` は使わない（次章の理由による）

## 13. クロスオリジン制約

MakeShop では HTML をショップ本体（例: `www.tea-and-coffee.shop`）に置き、アセットを CDN（`gigaplus.makeshop.jp`）に置く。両者は**常にクロスオリジン**になる。

そして gigaplus は `Access-Control-Allow-Origin` を返さない。

```
$ curl -I -H "Origin: https://www.tea-and-coffee.shop" \
    https://gigaplus.makeshop.jp/morihan1836/assets/js/swiper.min.js
HTTP/1.1 200 OK
Content-Type: application/javascript
（Access-Control-Allow-Origin なし）
```

そのため、**CORS モードで取得されるリソースはすべてブラウザにブロックされる**。

| 取得方法 | CORS | CDN から読めるか |
| :-- | :-- | :-- |
| `<script type="module" src>` | 必要 | **不可** |
| `<link rel="modulepreload">` | 必要 | **不可** |
| `@font-face` の `url()` | 必要 | **不可** |
| `<script src>`（`type` 無し） | 不要 | 可 |
| `<link rel="stylesheet">` | 不要 | 可 |
| `<img>`, `background-image` | 不要 | 可 |

`pnpm dev` は同一オリジンなので、この事故はローカルで再現しない。**本番に上げて初めて壊れる。**

### 対策1: JS は必ずインライン化する

`astro.config.mjs` で `assetsInlineLimit` に関数を渡し、`.js` は常にインライン化している。これにより、Astro がバンドルした `<script>` は外部ファイルにならず、`import` もミニファイもそのまま使える。

```js
assetsInlineLimit: (filePath) => (filePath.endsWith('.js') ? true : null),
```

`null` を返した場合は既定（4096 バイト）にフォールバックするため、画像など他のアセットの挙動は変わらない。

### 対策2: それでも外部化される場合がある

Astro のインライン判定（`astro/dist/core/build/plugins/plugin-scripts.js`）は、サイズだけでなく次も条件にしている。

```js
output.imports.length === 0 && output.dynamicImports.length === 0 && shouldInlineAsset(...)
```

つまり**動的 `import()` やチャンク分割が起きると、サイズに関係なく外部 module 化される**。これは `assetsInlineLimit` では防げない。だから動的 `import()` を使わない。

### 対策3: ビルドで検査して止める

`pnpm build` は `scripts/check-cors-safe.mjs` を実行し、成果物に上表の「不可」が混ざっていたら**ビルドを失敗させる**。事故を本番ではなくビルドで捕まえるための最後の砦。単独では `pnpm check:cors` で走る。

### 外部ライブラリの読み込み

Swiper など重い外部ライブラリは、インライン化すると HTML が肥大するため、**クラシックスクリプトとして CDN から読む**。`type` を付けなければ CORS は発生しない。

```astro
<script is:inline src="https://gigaplus.makeshop.jp/morihan1836/assets/js/swiper.min.js"></script>
```

### フォント

`@font-face` の取得は常に CORS モードなので、フォントを gigaplus に置くと読めない。Google Fonts は `Access-Control-Allow-Origin` を返すため利用できる。自前ホストに切り替える場合は、配信元が CORS ヘッダを返すか必ず確認する。
