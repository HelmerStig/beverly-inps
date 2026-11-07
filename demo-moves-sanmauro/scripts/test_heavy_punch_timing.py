import copy
import json
from pathlib import Path
import unittest
from heavy_punch_timing import apply_heavy_punch_timing

root=Path(__file__).resolve().parents[1]


class HeavyPunchTimingTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
        self.config=json.loads((root/'assets/heavy-punch-timing.json').read_text(encoding='utf-8'))

    def test_repeated_build_and_duration_restore_preserve_sources(self):
        before=copy.deepcopy(self.data)
        apply_heavy_punch_timing(self.data,self.config)
        self.config['durationMs']=750
        apply_heavy_punch_timing(self.data,self.config)
        self.config['durationMs']=1000
        apply_heavy_punch_timing(self.data,self.config)
        self.assertEqual(before,self.data)

    def test_invalid_duration_rejected(self):
        self.config['durationMs']=0
        with self.assertRaisesRegex(ValueError,'Durata'):
            apply_heavy_punch_timing(self.data,self.config)

    def test_stale_selection_rejected(self):
        self.config['items'][0]['sourceSha256']='changed'
        with self.assertRaisesRegex(ValueError,'Rivedere estensione'):
            apply_heavy_punch_timing(self.data,self.config)

    def test_invalid_impact_rejected(self):
        self.config['impactMs']=self.config['durationMs']
        with self.assertRaisesRegex(ValueError,'Tempo estensione'):
            apply_heavy_punch_timing(self.data,self.config)

    def test_out_of_range_frame_rejected(self):
        self.config['items'][0]['impactFrame']=999
        with self.assertRaisesRegex(ValueError,'Frame estensione'):
            apply_heavy_punch_timing(self.data,self.config)


if __name__=='__main__':
    unittest.main()
