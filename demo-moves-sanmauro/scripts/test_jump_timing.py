import copy
import json
from pathlib import Path
import unittest
from jump_timing import apply_timing

root = Path(__file__).resolve().parents[1]


class JumpTimingTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
        self.timing = json.loads((root/'assets/jump-timing.json').read_text(encoding='utf-8'))

    def test_repeat_build_preserves_source_and_preview(self):
        before = copy.deepcopy(self.data)
        apply_timing(self.data, self.timing)
        apply_timing(self.data, self.timing)
        self.assertEqual(before, self.data)

    def test_replaced_sheet_requires_review(self):
        self.data['characters'][0]['animations'][2]['sourceSha256'] = 'new'
        with self.assertRaisesRegex(ValueError, 'Rivedere apice'):
            apply_timing(self.data, self.timing)

    def test_changed_cut_requires_review(self):
        self.data['characters'][0]['animations'][2]['frames'].pop()
        with self.assertRaisesRegex(ValueError, 'Rivedere apice'):
            apply_timing(self.data, self.timing)

    def test_invalid_or_missing_selection_rejected(self):
        self.timing['items'][0]['apexFrame'] = 0
        with self.assertRaisesRegex(ValueError, 'fuori sequenza'):
            apply_timing(self.data, self.timing)
        self.timing['items'].pop()
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            apply_timing(self.data, self.timing)


if __name__ == '__main__':
    unittest.main()
