import copy
import json
from pathlib import Path
import unittest
from crouch_timing import apply_crouch_timing

root=Path(__file__).resolve().parents[1]


class CrouchTimingTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
        self.config=json.loads((root/'assets/crouch-timing.json').read_text(encoding='utf-8'))

    def test_repeated_build_and_duration_restore_preserve_sources(self):
        before=copy.deepcopy(self.data)
        apply_crouch_timing(self.data,self.config)
        self.config['durationMs']=750
        apply_crouch_timing(self.data,self.config)
        self.config['durationMs']=250
        apply_crouch_timing(self.data,self.config)
        self.assertEqual(before,self.data)

    def test_invalid_duration_rejected(self):
        self.config['durationMs']=0
        with self.assertRaisesRegex(ValueError,'Durata'):
            apply_crouch_timing(self.data,self.config)


if __name__=='__main__':
    unittest.main()
