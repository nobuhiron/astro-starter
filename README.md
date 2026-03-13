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

[site.ts](/C:/Users/kyoei139/astro-starter/src/config/site.ts)

ここでは以下を管理します。

- サイト名
- デフォルトの `title`
- `description`
- `locale`
- `siteUrl`
- デフォルト OGP 画像
- フォント読み込み URL

### 2. `src/styles/global/variables.css`

[variables.css](/C:/Users/kyoei139/astro-starter/src/styles/global/variables.css)

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

- 読み込み URL の設定: [site.ts](/C:/Users/kyoei139/astro-starter/src/config/site.ts)
- フォント名の変数管理: [variables.css](/C:/Users/kyoei139/astro-starter/src/styles/global/variables.css)

実装側では既存のフォント alias を使います。

- `--font-jp--serif`
- `--font-jp--sanserif`
- `--font-en`
- `--font-en--decor`

## 共通 meta 設定

[src/layouts/Layout.astro](/C:/Users/kyoei139/astro-starter/src/layouts/Layout.astro) は次の props を受け取れます。

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
| `pnpm build` | 本番ビルド |
| `pnpm preview` | ビルド結果確認 |
| `pnpm check` | Astro の型チェック |

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

## 実装ルール

実装ルールは README から分離しています。詳細は以下を参照してください。

- [docs/coding-rules.md](/C:/Users/kyoei139/astro-starter/docs/coding-rules.md)
- [docs/design-handoff-flow.md](/C:/Users/kyoei139/astro-starter/docs/design-handoff-flow.md)
- [docs/prompt-templates.md](/C:/Users/kyoei139/astro-starter/docs/prompt-templates.md)

## 補足

- MakeShop 固有の CSS ハックや環境変数は、このテンプレートの前提として残しています
- 色 token は最小構成で始め、必要になったときだけ追加する運用を想定しています
