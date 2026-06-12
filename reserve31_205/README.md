# 31-205 会議室予約カレンダー

Webブラウザで利用できる、会議室 31-205 専用の予約カレンダーです。

## 概要
- 会議室 31-205 の予約を登録
- 予約情報として「日時・用途・予約者」を表示
- 既存予約と時間帯が重複する場合はアラート表示
- 月間カレンダーと予約一覧で確認
- データはブラウザの LocalStorage に保存

## 主な機能
1. 新規予約登録
- 開始日時、終了日時、用途、予約者を入力して予約

2. 重複予約アラート
- 既存予約と時間帯が重なる場合は登録を拒否して警告

3. 予約一覧表示
- 予約の詳細（日時、用途、予約者）を一覧表示
- 不要な予約は削除可能

4. 月間カレンダー表示
- 前月/次月へ移動可能
- 日ごとの予約をチップ表示（多い日は「ほか n 件」表示）

## 画面構成
- 新規予約フォーム
- 月間カレンダー
- 予約一覧

## 実行手順
### 方法1: ファイルを直接開く
1. [index.html](index.html) をブラウザで開く
2. 予約フォームに入力して「予約を登録」を押す

### 方法2: 簡易サーバーで実行（推奨）
1. ターミナルでプロジェクトフォルダに移動
2. 以下のいずれかを実行

```bash
# Python 3
python3 -m http.server 8000
```

```bash
# Node.js (serve を使う場合)
npx serve .
```

3. ブラウザで表示された URL にアクセス

## GitHub Pages で公開する手順
このアプリは静的ファイル構成のため、そのまま GitHub Pages で公開できます。

### i2lab 配下で運用する場合（推奨）
`https://minorunakazawa.github.io/i2lab/` の内部に置きたい場合は、
`minorunakazawa/minorunakazawa.github.io` リポジトリの `i2lab` ディレクトリ配下に
このアプリをサブフォルダとして配置してください。

配置例:

```text
minorunakazawa.github.io/
	i2lab/
		reserve31-205/
			index.html
			styles.css
			app.js
```

公開 URL 例:
- `https://minorunakazawa.github.io/i2lab/reserve31-205/`

この構成なら、既存の `i2lab` コンテンツを壊さずに追加できます。

1. GitHub に push する
- [index.html](index.html), [styles.css](styles.css), [app.js](app.js), [README.md](README.md) を含めて push

2. GitHub 側で Pages を有効化する
- リポジトリの Settings を開く
- Pages を開く
- Build and deployment の Source を Deploy from a branch に設定
- Branch は master、Folder は /(root) を選択して Save

3. 公開 URL を確認する
- 数十秒から数分で公開される
- URL 例: https://nakalab.github.io/progress2018/

4. 動作確認する
- フォーム入力、予約登録、重複時アラートが期待通りか確認

## GitHub Pages 運用時の注意
- LocalStorage はブラウザごとに保存されるため、利用者間で予約データは共有されません
- 複数ユーザーで共通運用する場合は、サーバー側 DB と API の追加が必要です
- 公開 URL に対して HTTPS でアクセスされるため、混在コンテンツは使用しないでください

## バリデーション仕様
- 必須項目が未入力の場合はアラート
- 日時形式が不正な場合はアラート
- 開始日時 >= 終了日時 の場合はアラート
- 予約重複時はアラートして登録しない

## 重複判定ロジック
既存予約 `A` と新規予約 `B` の重複は、以下を満たす場合です。

- `B.start < A.end`
- `A.start < B.end`

## データ保存
- 保存先: ブラウザ LocalStorage
- キー: `reserve31_205_items`
- 別ブラウザ/別端末とは同期されません

## ファイル構成
- [index.html](index.html): 画面構造
- [styles.css](styles.css): スタイル定義
- [app.js](app.js): 予約ロジック、描画、重複判定

## 注意事項
- 本実装はフロントエンド単体構成です
- 永続化や複数端末共有が必要な場合はバックエンド連携が必要です

## 今後の拡張案
1. 予約編集機能の追加
2. 複数会議室対応
3. サーバー保存（DB）と認証
4. Google Calendar など外部連携
