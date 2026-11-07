import copy
import json
from pathlib import Path
import unittest
from guard_timing import apply_guard_timing

root = Path(__file__).resolve().parents[1]


class GuardTimingTests(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
        self.config=json.loads((root/'assets/guard-timing.json').read_text(encoding='utf-8'))

    def test_repeat_build_preserves_source_frames_scales_and_timings(self):
        before=copy.deepcopy(self.data)
        apply_guard_timing(self.data,self.config)
        apply_guard_timing(self.data,self.config)
        self.assertEqual(before,self.data)

    def test_source_timing_does_not_change_after_new_demo_duration(self):
        before=copy.deepcopy(self.data)
        self.config['durationMs']=750
        apply_guard_timing(self.data,self.config)
        self.config['durationMs']=500
        apply_guard_timing(self.data,self.config)
        self.assertEqual(before,self.data)

    def test_invalid_duration_rejected(self):
        self.config['durationMs']=0
        with self.assertRaisesRegex(ValueError,'Durata'):
            apply_guard_timing(self.data,self.config)


if __name__=='__main__':
    unittest.main()
