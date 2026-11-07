import copy
import json
from pathlib import Path
import unittest
from remaining_moves import apply_remaining_timing

root=Path(__file__).resolve().parents[1]


class RemainingMovesTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
        self.config=json.loads((root/'assets/remaining-moves-timing.json').read_text(encoding='utf-8'))

    def test_rebuild_is_idempotent_and_sources_preserved(self):
        before=copy.deepcopy(self.data)
        apply_remaining_timing(self.data,self.config)
        apply_remaining_timing(self.data,self.config)
        self.assertEqual(before,self.data)

    def test_outdated_selection_rejected(self):
        self.config['items'][0]['sourceSha256']='changed'
        with self.assertRaisesRegex(ValueError,'Rivedere estensione'):
            apply_remaining_timing(self.data,self.config)

    def test_extremum_cannot_be_terminal_idle(self):
        self.config['items'][0]['impactFrame']=9999
        with self.assertRaisesRegex(ValueError,'Timing o frame'):
            apply_remaining_timing(self.data,self.config)


if __name__=='__main__':unittest.main()
