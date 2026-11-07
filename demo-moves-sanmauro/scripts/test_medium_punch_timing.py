import copy
import json
from pathlib import Path
import unittest
from PIL import Image, ImageChops
from medium_punch_timing import apply_medium_punch_timing

root=Path(__file__).resolve().parents[1]


class MediumPunchTimingTests(unittest.TestCase):
    def test_mangler_atlas_preserves_pixels_and_phase_order(self):
        character=next(c for c in self.data['characters'] if c['id']=='mangler')
        animation=next(a for a in character['animations'] if a['id']=='medium-punch')
        index=0
        with Image.open(root/animation['image']) as atlas:
            for part in animation['sourceSheets']:
                with Image.open(root/part['image']) as original:
                    for x,y,w,h in part['frames']:
                        ax,ay,aw,ah=animation['frames'][index]
                        expected=original.crop((x,y,x+w,y+h)).convert('RGBA')
                        actual=atlas.crop((ax,ay,ax+aw,ay+ah)).convert('RGBA')
                        self.assertEqual(expected.tobytes(),actual.tobytes())
                        index+=1
        self.assertEqual(index,42)

    def setUp(self):
        self.data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
        self.config=json.loads((root/'assets/medium-punch-timing.json').read_text(encoding='utf-8'))

    def test_repeated_build_and_duration_restore_preserve_sources(self):
        before=copy.deepcopy(self.data)
        apply_medium_punch_timing(self.data,self.config)
        self.config['durationMs']=550
        apply_medium_punch_timing(self.data,self.config)
        self.config['durationMs']=750
        apply_medium_punch_timing(self.data,self.config)
        self.assertEqual(before,self.data)

    def test_invalid_duration_rejected(self):
        self.config['durationMs']=0
        with self.assertRaisesRegex(ValueError,'Durata'):
            apply_medium_punch_timing(self.data,self.config)

    def test_stale_selection_rejected(self):
        self.config['items'][0]['sourceSha256']='changed'
        with self.assertRaisesRegex(ValueError,'Rivedere estensione'):
            apply_medium_punch_timing(self.data,self.config)

    def test_invalid_impact_rejected(self):
        self.config['impactMs']=self.config['durationMs']
        with self.assertRaisesRegex(ValueError,'Tempo estensione'):
            apply_medium_punch_timing(self.data,self.config)

    def test_out_of_range_frame_rejected(self):
        self.config['items'][0]['impactFrame']=999
        with self.assertRaisesRegex(ValueError,'Frame estensione'):
            apply_medium_punch_timing(self.data,self.config)


if __name__=='__main__':
    unittest.main()
