# Astro Starter Kit: Minimal

```sh
pnpm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
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

## 2. Non-Negotiable Rules (変更不可)
- HTMLは **セマンティック**：`<main> <section> <h2> ...`
- CSSは **FLOCSS + BEM**、**クラス命名は接頭辞で役割明示**
  - layout → `.l-*`
  - component → `.c-*`
  - product/section → `.p-*`
- **ネスト禁止**（検索性と影響範囲の明確化）
- 余白は **トークン (--sp-*)** のみ使用。`px` の直接指定は禁止。
- 見た目ユーティリティ (`.u-text-center` など) **禁止**
  - 役割ユーティリティのみ許可：`.visually-hidden`, `.is-sm`, `.is-lg`
- `:focus-visible` は**絶対に保持**（アクセシビリティ優先）

## 3. Reasoned Defaults (判断が必要な場面での基準)
- 「迷ったら **世界観の維持 > 実装スピード**」
- 「見た目の調整は **c-* または p-* 内に閉じる**」
- 「可変余白は **section単位** で決める。ユーティリティで調整しない」
- 「デザインに現れない情報は **HTML構造とラベルで表現**」

## 4. CSS Architecture


## 5. Cursor Instruction Block（← ここが最重要）
以下のルールに従ってコードを提案してください：

- 常にセマンティックHTMLを使用する
- CSSは **FLOCSS + BEM** 構成で作成する
- スタイルは **components / products 内に閉じる**（グローバルには書かない）
- 余白は `var(--sp-*)` のトークンのみ使う
- クラス命名は **役割 → ブロック → 要素 → 修飾** の順で判断する
- 変更の提案を行う際は、**理由を1行添えること**

**Example output format:**

