# Astro Starter for MakeShop LP

MakeShop 向け LP 制作用の Astro スターターです。  
新規案件を始めるときにこのフォルダを複製し、案件ごとの差分だけを追加して使う前提で整えています。

## このテンプレートの目的

- Astro で LP を素早く立ち上げる
- MakeShop 向けの設定を最初から持たせる
- 色とフォントを少ない編集箇所で差し替えられるようにする
- 実装ルールはテンプレート本体と分離して管理する

## 最初に編集するファイル

新規案件を開始したら、まず次の2ファイルを確認してください。

### 1. `src/config/site.ts`

[site.ts](src/config/site.ts)

ここでは以下を管理します。

- サイト名
- デフォルトの `title`
- `description`
- `locale`
- `siteUrl`
- デフォルト OGP 画像
- フォント読み込み URL

### 2. `src/styles/global/variables.css`

[variables.css](src/styles/global/variables.css)

ここでは案件ごとのデザイントークンを管理します。

- ベースカラー 6 色
- フォントファミリー
- レイアウト幅
- 余白
- 角丸
- ベースの文字サイズ

## カラー運用

最初に触る色は 6 色だけです。

```css
:root {
  --base-main: #234a7a;
  --base-accent: #ff7a00;
  --base-sub: #ffb400;
  --base-text: #1f2937;
  --base-bg: #f7f4ee;
  --base-surface: #ffffff;
}
```

実装側では次の semantic token を使います。

- `--color-text`
- `--color-bg`
- `--color-surface`
- `--color-main`
- `--color-accent`
- `--color-sub`

色数が足りない場合だけ、案件ごとに後から追加してください。

## フォント運用

フォントは次のように分けています。

- 読み込み URL の設定: [site.ts](src/config/site.ts)
- フォント名の変数管理: [variables.css](src/styles/global/variables.css)

実装側では既存のフォント alias を使います。

- `--font-jp--serif`
- `--font-jp--sanserif`
- `--font-en`
- `--font-en--decor`

## 共通 meta 設定

[src/layouts/Layout.astro](src/layouts/Layout.astro) は次の props を受け取れます。

- `title`
- `description`
- `canonical`
- `ogImage`
- `noindex`

`site.ts` の `siteUrl` を設定すると、相対パスの `canonical` と `ogImage` は絶対 URL 化されます。

## 環境変数

`.env.development` / `.env.production` を使用します。

- `PUBLIC_LINK_BASE`
  MakeShop の商品 URL ベース
- `CDN_URL`
  `assetsPrefix` に渡す CDN パス

## コマンド

| Command | 内容 |
| :-- | :-- |
| `pnpm dev` | 開発サーバー起動 |
| `pnpm build` | 本番ビルド（＋クロスオリジン検査） |
| `pnpm preview` | ビルド結果確認 |
| `pnpm check` | Astro の型チェック |
| `pnpm check:cors` | 成果物のクロスオリジン検査のみ実行 |

## クロスオリジン制約（重要）

HTML はショップ本体、アセットは CDN（gigaplus）に置くため、両者は常にクロスオリジンです。gigaplus は `Access-Control-Allow-Origin` を返さないので、**CORS モードで取得されるリソースは本番でブロックされます**。

- `<script type="module" src>` … **不可**
- `<link rel="modulepreload">` … **不可**
- `@font-face` の `url()` … **不可**
- `<script src>`（`type` 無し）、`<link rel="stylesheet">`、画像 … 可

`pnpm dev` は同一オリジンのため**ローカルでは再現しません**。対策は3層です。

1. `astro.config.mjs` の `assetsInlineLimit` で `.js` を常にインライン化する
2. 動的 `import()` を使わない（サイズに関係なく外部 module 化されるため）
3. `pnpm build` が `scripts/check-cors-safe.mjs` で成果物を検査し、違反があればビルドを落とす

Swiper のような重い外部ライブラリは、クラシックスクリプトとして CDN から読みます。

```astro
<script is:inline src="https://gigaplus.makeshop.jp/.../swiper.min.js"></script>
```

詳細は [docs/coding-rules.md](docs/coding-rules.md) の「クロスオリジン制約」を参照してください。

## PowerShell の文字化け対策

Windows で PowerShell を使う場合は、UTF-8 を明示しておくと文字化けを避けやすくなります。

### 推奨

- 可能なら `powershell.exe` より `pwsh` を使う
- ソースファイルは UTF-8 で統一する
- 必要に応じて `-Encoding UTF8` を明示する

### 起動時の設定例

```powershell
chcp 65001
[Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
```

## ディレクトリ方針

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

## レイアウトの骨格（SP本体＋PC左右chrome）

このテンプレートは「**スマホ幅の中央 1 列が本体**、PC では左右に chrome（メニュー等）を出す」構成を既定にしています。コンテンツの中身は案件ごとに変わる前提で、骨格とトークンだけを用意しています。

- 本体幅は `--layout-main-width`（既定 `375px`、カンプ幅に合わせる）。
- `src/styles/layout/l-shell.css`
  - SP: 中央 1 列（`.l-main-column` が `max-width: var(--layout-main-width)`）。
  - PC(`--lg`): `grid-template-columns: minmax(0,1fr) var(--layout-main-width) minmax(0,1fr)` で左右に chrome。
- `src/components/PageChromeLeft.astro` / `PageChromeRight.astro`
  - PC 左右カラムの中身。**空のスケルトン**なので、案件ごとに（ロゴ / ページタイトル / 補助ナビ / LINE 登録など）を実装する。
- `.l-container` はセクション内コンテンツの器（`width: min(100%, var(--layout-main-width))`）。

> 構成が違う案件では、`Layout.astro` の `l-shell` を使わずに組むこともできます。`--layout-main-width` を変えれば本体幅だけ差し替えできます。

## ビジュアル差分スクリプト（任意・`scripts/`）

支給画像（カンプ）どおりに作れているかを、Playwright スクショ × sharp 比較で確認するための補助スクリプトです。`sharp` / `playwright` は導入済み。

| script | 役割 | 主な env |
| :-- | :-- | :-- |
| `crop-tiles.mjs` | 縦長の支給画像を高解像タイルに分割（文字を潰さず読む） | `SRC` `OUT_DIR` `TILE_H` `OVERLAP` |
| `shoot.mjs` | dev を撮影（SP375/2x・アニメ無効、セクション or 全画面） | `OUT` `SELECTOR` `WIDTH` `CHANNEL` |
| `compare.mjs` | デザイン画像と現状スクショを横並び合成（DESIGN｜CURRENT） | `DESIGN` `CURRENT` `OUT` |
| `sample-colors.mjs` | 画像から代表色を抽出（トークン埋め） | `SRC` `POINTS` `PALETTE` |
| `snapshot.mjs` | ARIA snapshot(YAML)＋computed/bbox(JSON)（文言・構造検証） | `SELECTOR` `OUT` `CHANNEL` |

出力は `tmp/`（gitignore 済み）。`shoot` / `snapshot` のブラウザは、Windows なら `CHANNEL=msedge` でシステム Edge を使うのが手軽（`npx playwright install chromium` のダウンロードが不要）。

```powershell
# 例: ランキングセクションをカンプと比較
$env:CHANNEL="msedge"
$env:OUT="tmp/ranking.png"; $env:SELECTOR=".p-ranking"; node scripts/shoot.mjs
$env:DESIGN="design/ranking.png"; $env:CURRENT="tmp/ranking.png"; $env:OUT="tmp/cmp.png"; node scripts/compare.mjs
```

## 実装ルール

実装ルールは README から分離しています。詳細は以下を参照してください。

- [docs/coding-rules.md](docs/coding-rules.md)
- [docs/design-handoff-flow.md](docs/design-handoff-flow.md)
- [docs/prompt-templates.md](docs/prompt-templates.md)

## 補足

- MakeShop 固有の CSS ハックや環境変数は、このテンプレートの前提として残しています
- 色 token は最小構成で始め、必要になったときだけ追加する運用を想定しています
