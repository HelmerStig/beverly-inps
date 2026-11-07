import copy
import json
from pathlib import Path
import unittest
from hurt_timing import apply_hurt_timing

root=Path(__file__).resolve().parents[1]


class HurtTimingTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
        self.config=json.loads((root/'assets/hurt-timing.json').read_text(encoding='utf-8'))

    def test_repeated_build_preserves_sources_and_geometry(self):
        before=copy.deepcopy(self.data)
        apply_hurt_timing(self.data,self.config)
        apply_hurt_timing(self.data,self.config)
        self.assertEqual(before,self.data)

    def test_duration_change_and_restore_preserve_source_timings(self):
        before=copy.deepcopy(self.data)
        self.config['durationMs']=750
        apply_hurt_timing(self.data,self.config)
        self.config['durationMs']=500
        apply_hurt_timing(self.data,self.config)
        self.assertEqual(before,self.data)

    def test_invalid_duration_rejected(self):
        self.config['durationMs']=0
        with self.assertRaisesRegex(ValueError,'Durata'):
            apply_hurt_timing(self.data,self.config)


if __name__=='__main__':
    unittest.main()
