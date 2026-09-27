# Webサイトの訪問数計測

GoatCounterで共通レイアウトのページへの訪問を計測し、GitHub Actionsが毎日06:17 JSTに前日までの集計を保存します。
サイトに訪問数を表示する部品は追加しません。

## 保存先

- [analyticsブランチのダッシュボード](https://github.com/MinoruNakazawa/i2lab/tree/analytics): 日・週・月のSVGグラフとCSV。初回成功時に作成。
- [Actionsの実行履歴](https://github.com/MinoruNakazawa/i2lab/actions/workflows/site-analytics.yml)
- `data/daily.csv`: 日本時間の日付、推定訪問数
- `data/weekly.csv`, `data/monthly.csv`: 日別の延べ合計、観測日数、完全/部分期間
- `charts/*.svg`: GitHubのREADMEに画像として表示。JavaScript不要。
- `metadata.json`: 計測先、開始日、集計済み日付

保存先は公開ブランチです。個人単位のログを残さず、集計値のみ公開します。
GitHubのリポジトリTrafficとは別の、Webサイト自体の計測です。

## 初回設定

1. https://minorunakazawa.goatcounter.com のサイト設定で **Sessionsを有効** にします。このアカウントはi2lab専用にし、他サイトの計測やイベントを混在させないでください。ダッシュボードは非公開のままで構いません。
2. ユーザー名 → APIで **stats（統計の読み取り）** 権限のAPIキーを作成します。
3. [GitHub Actionsの設定](https://github.com/MinoruNakazawa/i2lab/settings/secrets/actions)に以下を登録します。キーをソースやチャットに貼らないでください。

| 種類 | 名前 | 値 |
| --- | --- | --- |
| Secret | `GOATCOUNTER_API_TOKEN` | 発行したAPIキー |
| Variable | `GOATCOUNTER_CODE` | `minorunakazawa` |
| Variable | `ANALYTICS_START_DATE` | 実際に計測を開始した日本時間の日付（YYYY-MM-DD） |

4. `gh-pages` の `_config.yml` の `goatcounter_code` を同じ値に設定し、Pagesを公開します。
5. **既定ブランチはmaster** です。`.github/workflows/site-analytics.yml` はmasterにも配置してください。スケジュールは既定ブランチ上のワークフローのみ実行されます。実行時はgh-pagesのスクリプトを取得します。既定ブランチやPages公開元を変更する必要はありません。
6. Actions → Site visitor analytics → Run workflow。成功後analyticsブランチを確認します。計測当日は前日分がないためCSVはヘッダーのみです。翌日から数値が表示されます。

## 数え方と範囲

全対象ページを同じパス `/i2lab/` としてGoatCounterへ送るため、同一セッションのページ移動・再読み込みによる重複を抑えます。
GoatCounterのセッションは約8時間で、厳密な日別実人数ではありません。日をまたぐ同一セッションの再訪問も必ずしも再加算されません。
週・月は日別の延べ合計であり、週・月を通じたユニーク人数ではありません。
開始日は一日の途中からの計測なので部分日と扱い、その週・月もpartialにします。

日本語・英語のhome/page、およびhead-customを呼ぶテーマが対象です。
Jekyllレイアウトを通らない独立HTML、PDF・画像への直接アクセスは対象外です。
JavaScript無効・広告ブロックなどにより過少計測の可能性があります。導入前の訪問数は復元できません。
ホストが `minorunakazawa.github.io` かつ `/i2lab` 配下の場合のみスクリプトを読み込みます。
URLやタイトルは固定値、参照元は空文字で送ります。ブラウザーからGoatCounterへの通信は発生します。

## 更新と障害復旧

GoatCounterの指定時間範囲の合計 `total` を、日本時間の00時〜23時（両端を含む24時間）の範囲で取得します。
直近7日を再取得し、過去の欠測日も開始日から検索して補完します。再実行しても同じ日を重複追加しません。
認証エラー・不正な応答・接続失敗は処理を失敗させ、0で補完しません。全日分を取得するまでファイルを書き換えず、全処理成功後にのみpushします。
CSVは全期間、グラフは直近90日・26週・24か月です。週は月曜始まり、月は暦月です。
GoatCounter側で履歴を消した場合は復元できないため、データ保持期間を確認してください。
公開リポジトリは60日間活動がないと定期ワークフローが停止することがあります。更新が止まったらActionsで有効化し、手動実行してください。
APIキーを更新する場合はSecretだけ差し替えます。停止する場合は `_config.yml` のコードを空にして公開し、ワークフローを無効化します。

## 検証

```sh
python3 -m unittest discover -s scripts/analytics -p 'test_*.py' -v
```

公式仕様: [GoatCounter API](https://www.goatcounter.com/help/api)、[訪問・セッション](https://www.goatcounter.com/help/sessions)、[JS API](https://www.goatcounter.com/help/js)、[Actionsスケジュール](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。
