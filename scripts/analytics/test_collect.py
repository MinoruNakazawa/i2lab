import csv
from datetime import date
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs
from urllib.error import HTTPError
import collect
import hourly


class AnalyticsTests(unittest.TestCase):
    def test_hourly_jst_boundaries(self):
        for hour, expected in [(0, '2026-09-26T15:00:00+00:00'),
                               (23, '2026-09-27T14:00:00+00:00')]:
            query = parse_qs(collect.query_for(date(2026, 9, 27), hour))
            self.assertEqual(query['start'], [expected])
            self.assertEqual(query['end'], [expected])
        with self.assertRaises(ValueError):
            collect.query_for(date(2026, 9, 27), 24)

    def test_hourly_history_roundtrip_and_missing_hour(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            day = date(2026, 9, 28)
            hours = {day: list(range(24))}
            collect.render(output, {day: 276}, date(2026, 9, 27), 'example', hours)
            self.assertEqual(hourly.load(output / 'data/hourly.csv'), hours)
            self.assertIn('Mon (1d)', (output / 'charts/weekday-hourly.svg').read_text())
            path = output / 'data/hourly.csv'
            path.write_text('\n'.join(path.read_text().splitlines()[:-1]) + '\n')
            with self.assertRaises(ValueError):
                hourly.load(path)

    def test_profile_window_zero_days_and_activation_day(self):
        from datetime import timedelta
        start = date(2026, 8, 31)
        days = {start + timedelta(days=i): [0]*24 for i in range(36)}
        days[start][10] = 999
        days[start + timedelta(days=7)][10] = 999  # outside latest 28 days
        days[start + timedelta(days=35)][10] = 8  # Monday
        totals, n, rows = hourly.profile(days, start)
        self.assertEqual(n, 28)
        self.assertEqual(totals[10], 8)
        self.assertEqual(rows[10], ('Mon', 10, 8, 4, 2.0))
        _, n, rows = hourly.profile({start: [99]*24}, start)
        self.assertEqual(n, 0)
        self.assertTrue(all(r[4] is None for r in rows))

    def test_jst_hour_boundaries(self):
        query = parse_qs(collect.query_for(date(2026, 9, 27)))
        self.assertEqual(query['start'], ['2026-09-26T15:00:00+00:00'])
        self.assertEqual(query['end'], ['2026-09-27T14:00:00+00:00'])

    def test_week_year_and_leap_month(self):
        values = {date(2024, 2, d): d for d in range(1, 30)}
        self.assertEqual(collect.aggregate(values, 'monthly'),
                         [('2024-02-01', '2024-02-29', 435, 29, 'complete')])
        weeks = collect.aggregate({date(2025, 12, 31): 2, date(2026, 1, 1): 3}, 'weekly')
        self.assertEqual(weeks, [('2025-12-29', '2026-01-04', 5, 2, 'partial')])

    def test_csv_roundtrip_and_rerender(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            values = {date(2026, 9, 25): 2, date(2026, 9, 26): 0}
            collect.render(output, values, min(values), 'example')
            self.assertEqual(collect.load_daily(output / 'data/daily.csv'), values)
            first = (output / 'data/daily.csv').read_bytes()
            collect.render(output, values, min(values), 'example')
            self.assertEqual((output / 'data/daily.csv').read_bytes(), first)
            self.assertEqual(json.loads((output / 'metadata.json').read_text())['through'], '2026-09-26')
            self.assertIn('partial', (output / 'data/monthly.csv').read_text())

    def test_empty_is_not_fake_zero_day(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            collect.render(output, {}, date(2026, 9, 27), 'example')
            self.assertEqual((output / 'data/daily.csv').read_text(), 'date,visits\n')

    def test_invalid_api_not_zero(self):
        from io import StringIO
        for response in [{'total': -1, 'total_events': 0}, {},
                         {'total': True, 'total_events': 0},
                         {'total': 2, 'total_events': 1}]:
            with patch('collect.urlopen', return_value=StringIO(json.dumps(response))):
                with self.assertRaises(ValueError):
                    collect.fetch_day('example', 'not-a-real-token', date(2026, 9, 26))

    def test_auth_failure_does_not_retry_or_write(self):
        with patch('collect.urlopen', side_effect=HTTPError('https://example', 401, '', {}, None)), \
             patch('collect.clock.sleep') as sleep:
            with self.assertRaisesRegex(RuntimeError, '401'):
                collect.fetch_day('example', 'not-a-real-token', date(2026, 9, 26))
            sleep.assert_not_called()


if __name__ == '__main__':
    unittest.main()
