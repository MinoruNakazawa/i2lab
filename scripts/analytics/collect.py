#!/usr/bin/env python3
"""Archive aggregate GoatCounter visits only; Python standard library, JST days."""
import argparse
import csv
from datetime import date, datetime, time, timedelta, timezone
from html import escape
import json
import os
from pathlib import Path
import re
import time as clock
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import hourly

JST = timezone(timedelta(hours=9))
DAY = timedelta(days=1)


def configuration():
    code = os.environ.get('GOATCOUNTER_CODE', '')
    token = os.environ.get('GOATCOUNTER_API_TOKEN', '')
    start = os.environ.get('ANALYTICS_START_DATE', '')
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', code):
        raise ValueError('Set GOATCOUNTER_CODE to the registered subdomain (not a URL).')
    if not token:
        raise ValueError('Set the GOATCOUNTER_API_TOKEN Actions secret.')
    start = date.fromisoformat(start)
    if start > datetime.now(JST).date():
        raise ValueError('ANALYTICS_START_DATE cannot be in the future.')
    return code, token, start


def query_for(day, hour=None):
    # GoatCounter hit_counts use inclusive hourly boundaries; 23:00 includes
    # the last hour, whereas next midnight would also include the next day.
    first = datetime.combine(day, time(), JST).astimezone(timezone.utc)
    last = first + timedelta(hours=23)
    if hour is not None:
        if type(hour) is not int or not 0 <= hour <= 23:
            raise ValueError('Hour must be 0 through 23 in JST.')
        first += timedelta(hours=hour)
        last = first
    return urlencode({'start': first.isoformat(), 'end': last.isoformat()})


def fetch_day(code, token, day, hour=None):
    request = Request(f'https://{code}.goatcounter.com/api/v0/stats/total?{query_for(day, hour)}',
                      headers={'Authorization': f'Bearer {token}',
                               'Content-Type': 'application/json',
                               'Accept': 'application/json'})
    for attempt in range(4):
        try:
            with urlopen(request, timeout=45) as response:
                result = json.load(response)
            # total uses the exact start/end interval. total_utc is a separate
            # dashboard denominator and may use the account timezone.
            count = result.get('total')
            if type(count) is not int or count < 0:
                raise ValueError('Invalid API response: total must be a nonnegative integer.')
            if result.get('total_events') != 0:
                raise ValueError('Use a dedicated GoatCounter site with no event tracking.')
            return count
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                detail = ''
                try:
                    body = json.loads(error.read(4096))
                    message = body.get('error', '')
                    if isinstance(message, str):
                        detail = ' ' + message.replace(token, '[redacted]')[:300]
                except (ValueError, AttributeError):
                    pass
                raise RuntimeError(f'GoatCounter returned HTTP {error.code}.{detail} History was not updated.') from None
        except (URLError, TimeoutError):
            if attempt == 3:
                raise RuntimeError('GoatCounter unavailable; history was not updated.') from None
        clock.sleep(2 ** (attempt + 1))


def load_daily(path):
    if not path.exists():
        return {}
    values = {}
    with path.open(newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ['date', 'visits']:
            raise ValueError('Unexpected daily CSV columns.')
        for row in reader:
            day, count = date.fromisoformat(row['date']), int(row['visits'])
            if day in values or count < 0:
                raise ValueError('Duplicate date or negative count in history.')
            values[day] = count
    return values


def aggregate(values, period):
    buckets = {}
    for day, count in sorted(values.items()):
        first = day - timedelta(days=day.weekday()) if period == 'weekly' else day.replace(day=1)
        bucket = buckets.setdefault(first, [0, 0])
        bucket[0] += count
        bucket[1] += 1
    result = []
    for first, (count, observed) in buckets.items():
        end = first + timedelta(days=6) if period == 'weekly' else (
            (first.replace(day=28) + timedelta(days=4)).replace(day=1) - DAY)
        result.append((first.isoformat(), end.isoformat(), count, observed,
                       'complete' if observed == (end - first).days + 1 else 'partial'))
    return result


def write_csv(path, header, rows):
    with path.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle, lineterminator='\n')
        writer.writerow(header)
        writer.writerows(rows)


def chart(path, title, rows, subtitle=None):
    """Standalone SVG with integer axes and explicit partial-period marks."""
    width, height = 1100, 360
    left, top, bottom, plot_width = 70, 80, 270, 1000
    ceiling = max([r[1] for r in rows] + [4])
    step = max(1, (ceiling + 3) // 4)
    ceiling = step * 4
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">',
             f'<title>{escape(title)}</title>',
             '<rect width="100%" height="100%" rx="16" fill="#f6f8fa"/>',
             '<g font-family="Arial, sans-serif" fill="#1f2937">',
             f'<text x="30" y="32" font-size="21" font-weight="bold">{escape(title)}</text>',
             f'<text x="30" y="56" font-size="13">{escape(subtitle or "Estimated visits / JST | * partial period | weekly/monthly = sum of daily visits")}</text>']
    for i in range(5):
        y = bottom - (bottom - top) * i / 4
        parts += [f'<path d="M{left} {y} H1070" stroke="#d8dee4"/>',
                  f'<text x="58" y="{y + 4}" text-anchor="end" font-size="12">{i * step}</text>']
    spacing = plot_width / max(1, len(rows))
    for i, (label, count, partial) in enumerate(rows):
        bar_height = (bottom - top) * count / ceiling
        x = left + i * spacing + spacing * .15
        parts.append(f'<rect x="{x:.2f}" y="{bottom-bar_height:.2f}" width="{spacing*.7:.2f}" height="{bar_height:.2f}" rx="2" fill="{"#94a3b8" if partial else "#2563eb"}"><title>{escape(label)}: {count}{" (partial)" if partial else ""}</title></rect>')
        if i % max(1, (len(rows) + 11) // 12) == 0:
            parts.append(f'<text transform="translate({x + spacing * .35:.2f},285) rotate(-30)" text-anchor="end" font-size="11">{escape(label)}{"*" if partial else ""}</text>')
    if not rows:
        parts.append('<text x="550" y="170" text-anchor="middle">No completed days yet</text>')
    parts.append('</g></svg>')
    path.write_text('\n'.join(parts) + '\n', encoding='utf-8')


def render(output, values, start, code, hours=None):
    (output / 'data').mkdir(parents=True, exist_ok=True)
    (output / 'charts').mkdir(exist_ok=True)
    hourly.render(output, hours or {}, start, chart, write_csv)
    write_csv(output / 'data/daily.csv', ['date', 'visits'],
              [(d.isoformat(), v) for d, v in sorted(values.items())])
    chart(output / 'charts/daily.svg', 'Daily visits | latest 90 days',
          [(d.isoformat(), v, d == start) for d, v in sorted(values.items())][-90:])
    for period, limit in [('weekly', 26), ('monthly', 24)]:
        rows = aggregate(values, period)
        # The activation day may have begun partway through a calendar day.
        rows = [(*r[:4], 'partial' if r[0] <= start.isoformat() <= r[1] else r[4]) for r in rows]
        write_csv(output / f'data/{period}.csv',
                  ['period_start', 'period_end', 'visits', 'observed_days', 'status'], rows)
        chart(output / f'charts/{period}.svg', f'{period.title()} visits | latest {limit} periods',
              [(r[0], r[2], r[4] == 'partial') for r in rows][-limit:])
    latest = max(values).isoformat() if values else '未集計'
    metadata = {'provider': 'GoatCounter', 'code': code, 'timezone': 'Asia/Tokyo',
                'start_date': start.isoformat(), 'through': latest,
                'metric': 'estimated site visits; weekly/monthly are daily sums'}
    (output / 'metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    (output / 'README.md').write_text(f'''# i2lab 訪問数ログ

対象: https://minorunakazawa.github.io/i2lab/ の共通レイアウトを使うページ。集計済み: **{latest}**（日本時間）。
計測開始日: {start}。毎日06:17 JSTに前日までを更新予定（Actionsの遅延あり）。

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
- [日時別CSV](data/hourly.csv) / [時間帯別CSV](data/hourly-profile.csv) / [曜日×時間帯CSV](data/weekday-hourly.csv)
- [更新履歴](https://github.com/MinoruNakazawa/i2lab/commits/analytics/)
- [自動実行ログ](https://github.com/MinoruNakazawa/i2lab/actions/workflows/site-analytics.yml)

CSVは全期間を保持し、グラフは直近90日・26週・24か月を表示します。
API取得失敗は0件として記録せず、更新を失敗させます。直近7日を再取得し、欠測日も補完します。
このブランチには日付と集計値のみを保存し、IP・セッションID・閲覧URLなどの個別ログは保存しません。
公開リポジトリのため集計値は公開されます。サイト本体には表示しません。

## 時間毎（日本時間）

直近の集計済み日の0〜23時の訪問数です。開始日は部分日です。

![直近日の時間毎](charts/hourly-latest.svg)

## 時間帯別の傾向（直近28日）

日別CSVの最終日を基準とする直近28日間の、各時間帯の延べ訪問数です。
途中から計測した開始日は、時間帯の比較と下の平均から除外します。
日時別CSVには開始日も残します。0件の日も観測日数に含めます。

![時間帯の傾向](charts/hourly-profile.svg)

## 曜日×時間帯の傾向（直近28日）

各曜日の観測日数で割った「1日あたりの平均訪問数」です。未観測は「—」、観測済みの0件は「0.0」です。
同一セッションの再訪問が毎時間数え直されるわけではなく、既存の推定訪問数を発生した時間帯に分けたものです。
毎朝の更新で前日までを表示します（リアルタイム更新ではありません）。

![曜日と時間帯](charts/weekday-hourly.svg)
''', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path('/tmp/i2lab-analytics'))
    parser.add_argument('--check-config', action='store_true')
    args = parser.parse_args()
    code, token, start = configuration()
    if args.check_config:
        config = Path('_config.yml').read_text()
        match = re.search(r'^goatcounter_code:\s*[\"\']?([a-z0-9-]+)', config, re.M)
        if not match or match[1] != code:
            raise ValueError('_config.yml goatcounter_code must match the Actions variable.')
        print('Configuration checked (API credentials not yet verified).')
        return
    metadata_file = args.output / 'metadata.json'
    if metadata_file.exists():
        old = json.loads(metadata_file.read_text())
        if old['code'] != code or old['start_date'] != start.isoformat():
            raise ValueError('Site/start date differ from saved history; do not mix datasets.')
    values = load_daily(args.output / 'data/daily.csv')
    hours = hourly.load(args.output / 'data/hourly.csv')
    yesterday = datetime.now(JST).date() - DAY
    # Authenticate even on activation day, when there are no completed days.
    # Today's provisional count is deliberately not written to history.
    if start > yesterday:
        fetch_day(code, token, start, hour=0)
    if any(day < start or day > yesterday for day in set(values) | set(hours)):
        raise ValueError('History contains out-of-range dates.')
    day = start
    while day <= yesterday:
        if day not in values or day not in hours or day > yesterday - timedelta(days=7):
            counts = []
            for hour in range(24):
                counts.append(fetch_day(code, token, day, hour=hour))
                clock.sleep(.3)
            total = fetch_day(code, token, day)
            if sum(counts) != total:
                raise ValueError(f'Hourly/daily totals differ for {day}; retry later.')
            hours[day], values[day] = counts, total
        day += DAY
    if set(hours) != set(values) or any(sum(hours[d]) != values[d] for d in values):
        raise ValueError('Hourly history does not match daily history.')
    # No writes occur until every requested day has succeeded.
    render(args.output, values, start, code, hours)
    print(f'Wrote {len(values)} daily records; no individual visitor data saved.')


if __name__ == '__main__':
    main()
