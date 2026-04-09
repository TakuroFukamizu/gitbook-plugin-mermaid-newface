# E2E Test Design for gitbook-plugin-mermaid-newface

## Overview

HonKit（GitBook 3互換フォーク）でテスト用ミニブックをビルドし、出力にMermaid図が正しく埋め込まれているかを検証するE2Eテスト。

## テスト対象

- **Website出力（HTML/SVG）**: `honkit build` で生成されたHTMLにSVG要素が埋め込まれていること
- **PDF出力（PNG data URI）**: `honkit pdf` が正常終了し、中間生成物にdata URI形式のPNG画像が含まれること

## ファイル構成

```
test/
├── e2e.test.js                 # テスト本体
└── fixtures/
    └── test-book/
        ├── book.json           # プラグイン設定
        ├── SUMMARY.md          # 目次
        ├── README.md           # mermaidコードブロックを含むテストページ
        └── puppeteer-config.json  # CI用 Puppeteer設定
```

## テストフィクスチャ

### book.json

```json
{
  "plugins": ["mermaid-newface"],
  "pluginsConfig": {
    "mermaid-newface": {
      "theme": "default"
    }
  }
}
```

### README.md に含めるテストケース

1. **Flowchart** — 基本的なフロー図
2. **Sequence diagram** — 別の図種
3. **通常のコードブロック（javascript）** — mermaid変換されないことの確認

### puppeteer-config.json

```json
{
  "args": ["--no-sandbox"]
}
```

## テスト実行フロー

### セットアップ（Jest beforeAll）

1. `test-book/node_modules/gitbook-plugin-mermaid-newface` にプロジェクトルートへのシンボリックリンクを作成
2. `test-book/` 内で `npm install`（honkit + 依存をインストール）
3. `npx honkit build` を実行 → `test-book/_book/` に出力
4. Calibreが利用可能な場合のみ `npx honkit pdf` を実行 → `test-book/output.pdf`

### テストケース

#### Website（HTML/SVG）

- `_book/index.html` を `cheerio` でパース
- Flowchartに対応する `<svg>` 要素が存在すること
- Sequence diagramに対応する `<svg>` 要素が存在すること
- `javascript` コードブロックが `<code>` 要素としてそのまま残っていること

#### PDF（PNG data URI）

- `honkit pdf` が exit code 0 で終了すること
- ビルド中間HTML内に `<img src="data:image/png;base64,...">` が存在すること
- Calibreがインストールされていない環境では自動スキップ
- **注意**: `honkit pdf` は内部でHTMLを生成後にCalibreでPDF変換する。中間HTMLへの直接アクセスが困難な場合は、代替として `honkit build` 出力を `format=OTHER` 相当（PNG data URI）で生成するテスト用セットアップを検討する

### クリーンアップ（Jest afterAll）

- `_book/`、`output.pdf`、シンボリックリンクを削除

## 追加する依存（devDependencies）

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| jest | ^29.0.0 | テストランナー |
| cheerio | ^1.0.0 | HTML パース・検証 |
| honkit | ^5.0.0 | テスト用ブックビルド |

## package.json 変更

```json
{
  "scripts": {
    "test": "jest --testTimeout=120000"
  }
}
```

## GitHub Actions CI

### `.github/workflows/test.yml`

- **トリガー**: push, pull_request
- **マトリクス**: Node 18, 20
- **OS**: ubuntu-latest
- **ステップ**:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` + `npm install`
  3. `apt-get install calibre`（PDF テスト用）
  4. `npm test`

### CI固有の考慮事項

- `puppeteer-config.json` の `--no-sandbox` でLinux上のChromiumサンドボックス問題を回避
- Jestタイムアウトを120秒に設定（mermaid-cliのChromium起動を考慮）

## PDF テストのスキップ判定

テスト内で `which ebook-convert` を実行し、Calibreの有無を検出。存在しなければ `describe.skip` でPDF関連テストをスキップ。これによりローカル環境でCalibre未インストールでもテストが失敗しない。
