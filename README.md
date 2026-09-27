# i2lab 訪問数ログ

> 初期状態：API Secretの登録と初回自動集計の成功待ちです。グラフ・CSVに実測データはまだありません。

対象: https://minorunakazawa.github.io/i2lab/ の共通レイアウトを使うページ。集計済み: **未集計**（日本時間）。
計測開始日: 2026-09-27。毎日06:17 JSTに前日までを更新予定（Actionsの遅延あり）。

訪問数はGoatCounterのセッションに基づく推定値です。同一セッションのサイト内移動・再読み込みをまとめます。
週・月は日別訪問数の延べ合計で、期間を通した実人数ではありません。開始日と、それを含む週・月、進行中の期間は不完全（*）です。
JavaScript無効・広告ブロック等は計測できません。導入前のアクセスは復元できません。

## 日毎

![日別](charts/daily.svg)

## 週毎（月曜〜日曜）

![週別](charts/weekly.svg)

## 月毎（暦月）

![月別](charts/monthly.svg)

## CSVと履歴

- [日別CSV](data/daily.csv) / [週別CSV](data/weekly.csv) / [月別CSV](data/monthly.csv)
- [更新履歴](https://github.com/MinoruNakazawa/i2lab/commits/analytics/)
- [自動実行ログ](https://github.com/MinoruNakazawa/i2lab/actions/workflows/site-analytics.yml)

CSVは全期間を保持し、グラフは直近90日・26週・24か月を表示します。
API取得失敗は0件として記録せず、更新を失敗させます。直近7日を再取得し、欠測日も補完します。
このブランチには日付と集計値のみを保存し、IP・セッションID・閲覧URLなどの個別ログは保存しません。
公開リポジトリのため集計値は公開されます。サイト本体には表示しません。
