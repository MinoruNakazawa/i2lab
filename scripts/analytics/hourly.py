"""JST hourly archives and a 28-day time-of-day profile. No raw visitor data."""
import csv
from datetime import date, timedelta

WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


def load(path):
    if not path.exists():
        return {}
    days = {}
    with path.open(newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ['date', 'hour_jst', 'visits']:
            raise ValueError('Unexpected hourly CSV columns.')
        for row in reader:
            day = date.fromisoformat(row['date'])
            hour, count = int(row['hour_jst']), int(row['visits'])
            hours = days.setdefault(day, {})
            if not 0 <= hour < 24 or count < 0 or hour in hours:
                raise ValueError('Invalid or duplicate hourly record.')
            hours[hour] = count
    if any(len(hours) != 24 for hours in days.values()):
        raise ValueError('Incomplete day in hourly history.')
    return {day: [hours[h] for h in range(24)] for day, hours in days.items()}


def profile(days, start):
    latest = max(days) if days else start
    first = latest - timedelta(days=27)
    selected = {d: v for d, v in days.items() if first <= d <= latest and d > start}
    totals = [sum(v[h] for v in selected.values()) for h in range(24)]
    weekday_rows = []
    for weekday in range(7):
        observed = [v for d, v in selected.items() if d.weekday() == weekday]
        for h in range(24):
            count = sum(v[h] for v in observed)
            average = count / len(observed) if observed else None
            weekday_rows.append((WEEKDAYS[weekday], h, count, len(observed), average))
    return totals, len(selected), weekday_rows


def heatmap(path, rows):
    maximum = max([r[4] or 0 for r in rows] + [1])
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="430" viewBox="0 0 1100 430" role="img">',
             '<title>Weekday by hour: average visits per observed day, JST</title>',
             '<rect width="1100" height="430" rx="16" fill="#f6f8fa"/>',
             '<g font-family="Arial, sans-serif" fill="#1f2937">',
             '<text x="30" y="32" font-size="21" font-weight="bold">Weekday × hour | latest 28 days</text>',
             '<text x="30" y="57" font-size="13">JST | Mean visits per observed weekday | darker = more visits | — = no observations</text>']
    for h in range(24):
        parts.append(f'<text x="{110+h*40}" y="87" text-anchor="middle" font-size="12">{h:02d}</text>')
    for i, weekday in enumerate(WEEKDAYS):
        n = rows[i*24][3]
        parts.append(f'<text x="80" y="{121+i*39}" text-anchor="end" font-size="12">{weekday} ({n}d)</text>')
    for i, (_, h, count, observed, average) in enumerate(rows):
        y, x = 98+(i//24)*39, 91+h*40
        intensity = (average or 0) / maximum
        color = f'rgb({int(239-202*intensity)},{int(246-147*intensity)},{int(255-20*intensity)})' if observed else '#e5e7eb'
        label = f'{average:.1f}' if observed else '—'
        parts.append(f'<rect x="{x}" y="{y}" width="38" height="36" rx="3" fill="{color}"><title>{WEEKDAYS[i//24]} {h:02d}:00: {count} visits / {observed} days</title></rect>')
        parts.append(f'<text x="{x+19}" y="{y+23}" text-anchor="middle" font-size="11" fill="{"white" if intensity > .6 and observed else "#1f2937"}">{label}</text>')
    parts.append('<text x="30" y="405" font-size="12">Activation day excluded. Zero-visit observed days included. This is an estimated visit metric, not raw pageviews.</text></g></svg>')
    path.write_text('\n'.join(parts) + '\n', encoding='utf-8')


def render(output, days, start, chart, write_csv):
    write_csv(output / 'data/hourly.csv', ['date', 'hour_jst', 'visits'],
              [(d.isoformat(), h, counts[h]) for d, counts in sorted(days.items()) for h in range(24)])
    latest = max(days) if days else None
    chart(output / 'charts/hourly-latest.svg', f'Hourly visits | {latest or "awaiting first completed day"}',
          [(f'{h:02d}:00', days[latest][h], latest == start) for h in range(24)] if latest else [],
          'Estimated visits / JST | each bar = one hour | * activation day is partial')
    totals, observed, rows = profile(days, start)
    write_csv(output / 'data/hourly-profile.csv', ['hour_jst', 'visits', 'observed_days', 'mean_visits'],
              [(h, totals[h], observed, f'{totals[h]/observed:.4f}' if observed else '') for h in range(24)])
    write_csv(output / 'data/weekday-hourly.csv', ['weekday', 'hour_jst', 'visits', 'observed_days', 'mean_visits'],
              [(*r[:4], f'{r[4]:.4f}' if r[4] is not None else '') for r in rows])
    chart(output / 'charts/hourly-profile.svg', f'Time-of-day visits | latest 28 days | {observed} observed days',
          [(f'{h:02d}:00', totals[h], False) for h in range(24)] if observed else [],
          'Estimated visits / JST | sum by hour of day | activation day excluded')
    heatmap(output / 'charts/weekday-hourly.svg', rows)
