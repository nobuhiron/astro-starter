# Astro Starter Kit: Minimal

```sh
pnpm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                | Action                                           |
| :--------------------- | :----------------------------------------------- |
| `pnpm install`         | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build your production site to `./dist/`          |
| `pnpm preview`         | Preview your build locally, before deploying     |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

# Project Rules for Cursor

## 1. Goal (Outcome)

このプロジェクトは **ブランド体験と世界観を重視した EC / LP** を制作する。
**速さより一貫性**、**統一感のある余白とタイポ**、**落ち着いた色設計**を優先する。

## 2. Cursor Instruction Block（最重要）

以下のルールに従ってコードを提案してください：

- **HTML**: 常にセマンティック HTML を使用（`<main> <section> <h2> ...`）
- **CSS**: FLOCSS + BEM 構成、クラス命名は接頭辞で役割明示
  - layout → `.l-*`
  - component → `.c-*`
  - product → `.p-*`
- **余白**: `var(--sp-*)` のトークンのみ使用、`px`の直接指定は禁止
- **命名**: 役割 → ブロック → 要素 → 修飾の順で判断
- **変更提案**: 理由を 1 行添えること
- **タイポグラフィ・カラー**: Base を正とし、コンポーネント内で必要な差分のみ上書き

## 3. Non-Negotiable Rules (変更不可)

### HTML

- **セマンティック要素の使用**: `<main>`, `<section>`, `<article>`, `<nav>`, `<header>`, `<footer>`, `<aside>`を適切に使用
- **見出し構造**: `<h1>`から順に階層を守り、レベルをスキップしない
- **段落の使用**: `<p>`は意味的にまとまったテキストの塊（段落）にのみ使用。レイアウト目的では`<div>`を使用

### CSS

- **FLOCSS + BEM**: クラス命名は接頭辞で役割明示
- **ネスト禁止**: 検索性と影響範囲の明確化のため
- **余白のトークン化**: `var(--sp-*)`のみ使用、`px`の直接指定は禁止
- **スライダー**: Splide を使用（`@splidejs/splide`を優先）

### アクセシビリティ

- **`:focus-visible`の保持**: フォーカスインジケーターは絶対に削除しない
- **セマンティック HTML 優先**: 適切な HTML 要素が使える場合は ARIA 属性は不要

## 4. CSS Architecture

### Typography（タイポグラフィ）

- **基本フォントサイズ**: `var(--font-size-base)`を優先的に使用（`src/styles/foundation/base.css`で定義）
- **個別フォントサイズ**: レスポンシブ対応が必要な場合は`src/assets/js/functions.js`の`fz()`関数を使用
  - 例：`font-size: ${functions.fz(14, 20)};`（14px〜20px の fluid 指定）
- **ユーティリティ**: 見た目ユーティリティ（`.u-text-center`など）は禁止
  - 役割ユーティリティのみ許可：`.visually-hidden`, `.is-sm`, `.is-lg`

### レイアウトパターン

#### カードコンポーネントの横並び（subgrid 使用）

横並びのカードコンポーネントで要素の高さを揃える場合は、**CSS subgrid**を使用する。

**実装：**

- 親（`.c-card-list`）で`grid-template-rows`を定義
- 子（`.c-card`）で`grid-template-rows: subgrid`を使用
- 各要素に`grid-row`を指定

**注意：** ブラウザサポートを確認。モバイルでは通常の grid、PC サイズで subgrid を適用。

### モダンな CSS 機能の積極的な活用

以下の機能を積極的に使用する：

- **Container Queries**: コンテナサイズに基づくレスポンシブ対応（`container-type: inline-size`）
- **`:has()`**: 子要素の状態に基づく親要素のスタイリング
- **`:is()`**: 複数セレクターの簡潔な記述
- **`:where()`**: 詳細度 0 でセレクターをグループ化
- **`min()`, `max()`**:最大値、最小値の設定

**注意：** ブラウザサポートを確認し、必要に応じてフォールバックを用意。

## 5. Image Guidelines (画像の扱い)
画像：src/assets/images

そこから import hero from '@/assets/images/hero.jpg';

<Image src={hero} /> や <img src={hero.src}> で利用

dist後はassetsPrefix(CDN_URL) が効く

### アクセシビリティ（必須）

- **`alt`属性**: 意味のある画像は具体的な説明、装飾画像は空文字列 `alt=""`
- **装飾画像**: 情報を持たない装飾は`<img>`ではなく`background-image`もしくは疑似要素を使用
- **`<figure>`と`<figcaption>`**: 画像に説明が必要な場合は`<figure>`で囲む
- **SVG アイコン**: 装飾アイコンは`<svg>`要素で直接埋め込み、`aria-hidden="true"`を指定

### パフォーマンス（必須）

- **Astro の`Image`コンポーネント**: 最適化とレスポンシブ対応のため優先
- **遅延読み込み**: ビューポート外の画像は`loading="lazy"`を指定
- **フォーマット**: WebP/AVIF を優先、フォールバックを用意

### レスポンシブ（必須）

- **`srcset`と`sizes`属性**: 画面サイズに応じた画像サイズを指定
- **アートディレクション**: 画面サイズで切り替える場合は`<picture>`要素を使用
- **アスペクト比**: `width`と`height`属性でアスペクト比を保持（CLS 防止）

### セマンティック（必須）

- **役割の明確化**: 商品画像、ヒーロー画像、アイコンなど、役割に応じた構造を選択
- **リンク内の画像**: `<a>`内の`<img>`は、リンク先を説明する`alt`を記述

### 禁止事項

- **`object-fit: cover`の乱用**: アスペクト比が重要な画像では使用を避ける
- **固定サイズ**: レスポンシブ対応を優先し、固定`width/height`の直接指定は避ける
- **装飾画像の`<img>`使用**: 情報を持たない装飾は必ず CSS 背景画像に

### 推奨事項

- **読み込み状態**: 大きな画像はプレースホルダーやスケルトン表示を検討
- **エラーハンドリング**: `onerror`で代替画像を表示する場合は、アクセシビリティを損なわない範囲で

## 6. Accessibility Guidelines (アクセシビリティ)

### ARIA 属性の使用原則（必須）

- **セマンティック HTML 優先**: 適切な HTML 要素（`<button>`, `<nav>`, `<main>`など）が使える場合は ARIA 属性は不要
- **ARIA は補完的に使用**: セマンティック HTML だけでは表現できない場合のみ使用
- **`aria-label`**: 要素に可視テキストがない場合、または可視テキストが不十分な場合に使用
  - 例：アイコンボタン `<button aria-label="閉じる">×</button>`
- **`aria-labelledby`**: 他の要素の ID を参照してラベルを指定
  - 例：`<section aria-labelledby="section-title"><h2 id="section-title">見出し</h2></section>`
- **`aria-describedby`**: 追加の説明が必要な場合に使用
  - 例：フォームのエラーメッセージ `<input aria-describedby="error-message">`
- **`aria-hidden="true"`**: 装飾的な要素（アイコン、装飾画像など）に指定してスクリーンリーダーから除外

### ラベルとテキスト（必須）

- **ボタンとリンク**: 常に明確なラベルを提供（可視テキストまたは`aria-label`）
- **フォーム要素**: `<label>`要素と`for`属性で関連付け、または`aria-label`を使用
- **見えないテキスト**: `.visually-hidden`クラスを使用してスクリーンリーダー用のテキストを追加
  - 例：`<button><span class="visually-hidden">メニューを開く</span>☰</button>`

### ランドマークと構造（必須）

- **主要なランドマーク**: `<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>`を適切に使用
- **見出し構造**: `<h1>`から順に階層を守り、レベルをスキップしない
- **`role`属性**: セマンティック HTML で表現できない場合のみ使用
  - 例：カスタムウィジェット `<div role="dialog" aria-labelledby="dialog-title">`

### インタラクティブ要素（必須）

- **キーボード操作**: すべてのインタラクティブ要素はキーボードで操作可能に
- **フォーカス管理**: モーダルやドロップダウンなど、フォーカスの移動を適切に管理
- **フォーカスインジケーター**: `:focus-visible`スタイルは絶対に削除しない

### 状態の通知（必須）

- **動的な変更**: `aria-live`属性で重要な変更をスクリーンリーダーに通知
  - 例：検索結果の更新 `<div aria-live="polite" aria-atomic="true">`
- **展開/折りたたみ**: `aria-expanded`属性で状態を明示
  - 例：アコーディオン `<button aria-expanded="false" aria-controls="content">`
- **選択状態**: `aria-selected`, `aria-checked`などで状態を明示

### 禁止事項

- **冗長な ARIA**: セマンティック HTML で十分な場合に ARIA 属性を追加しない
  - 悪い例：`<button role="button" aria-label="ボタン">クリック</button>`
- **`role="presentation"`の乱用**: セマンティックな意味を無視しない
- **`tabindex`の乱用**: `tabindex="0"`以上は必要な場合のみ使用（通常は不要）

### 推奨事項

- **テスト**: 実際のスクリーンリーダー（NVDA、JAWS、VoiceOver など）で動作確認
- **キーボードナビゲーション**: マウスなしで全機能にアクセス可能か確認
- **コントラスト比**: テキストと背景のコントラスト比は WCAG 2.1 AA 基準（4.5:1 以上）を満たす

## 7. Reasoned Defaults (判断が必要な場面での基準)

- 「迷ったら **世界観の維持 > 実装スピード**」
- 「見た目の調整は **c-_ または p-_ 内に閉じる**」
- 「可変余白は **section 単位** で決める。ユーティリティで調整しない」
- 「デザインに現れない情報は **HTML 構造とラベルで表現**」

 セクションコンポーネントは `src/sections/SectionXxx.astro` の命名に揃えてください。
- 再利用 UI コンポーネントは `src/components/` 配下に役割ベースで命名してください。
- 新しい JS の機能は `src/scripts/[機能名].js` に `initXxx()` 関数を定義し、`main.js` から呼び出してください。

## ディレクトリ構成（このプロジェクトの実体）

```txt
src/
  assets/
    images/            # 画像ファイル（必ずここから import して使う）

  pages/               # ページ本体（Astro標準）
    index.astro        # TOPページ

  layouts/             # レイアウト（BaseLayout など）

  sections/            # ページ内セクション（Hero, Features, FAQ などのまとまり）
                       # 例：SectionHero.astro, SectionFeatureList.astro

  components/          # 小さな再利用 UI コンポーネント
                       # 例：Button.astro, SectionTitle.astro, Badge.astro

  blocks/              # 必要に応じて使う共通ブロック（ヘッダーナビ／フッター等）
                       # sections より小さく、components より文脈が強い単位を想定

  styles/
    style.css          # CSS のエントリーポイント（ここから各 index.css を @import）

    foundation/        # Reset / Base / 共通フォント・カラーなどの基礎
      reset.css
      base.css
      index.css

    global/            # 変数・カスタムメディア・ユーティリティ
      variables.css    # 色・余白などのトークン
      custom_media.css # @custom-media の定義
      utilities.css    # .visually-hidden など "役割ユーティリティ"
      index.css

    layout/            # .l-* のレイアウト系
      l-container.css
      index.css

    components/        # .c-* のコンポーネント系スタイル
      index.css        # 各コンポーネントCSSをここから import する

    products/          # .p-* の商品・ページ固有スタイル
      index.css        # ページ／プロダクト固有のスタイルをここに集約

## JavaScript / インタラクションのルール

- JS ファイルは `src/scripts` 配下に作成する
- すべての初期化処理の入口は `src/scripts/main.js`
  - 新しい機能を追加する場合は `src/scripts/[機能名].js` に `initXxx()` を定義し、
    `main.js` から呼び出す
