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


class AnalyticsTests(unittest.TestCase):
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
