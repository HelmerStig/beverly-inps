import copy
import json
from pathlib import Path
import unittest
from character_proportions import apply_proportions

root = Path(__file__).resolve().parents[1]


class CharacterProportionsTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
        self.config = json.loads((root/'assets/character-proportions.json').read_text(encoding='utf-8'))

    def test_repeated_build_does_not_accumulate_scale(self):
        before = copy.deepcopy(self.data)
        apply_proportions(self.data,self.config)
        apply_proportions(self.data,self.config)
        self.assertEqual(before,self.data)

    def test_new_height_can_be_reverted_without_changing_source_normalization(self):
        before = copy.deepcopy(self.data)
        taller = copy.deepcopy(self.config)
        taller['heightsCm']['oscare'] = 190
        apply_proportions(self.data,taller)
        apply_proportions(self.data,self.config)
        self.assertEqual(before,self.data)

    def test_invalid_height_rejected(self):
        self.config['heightsCm']['oscare'] = 0
        with self.assertRaisesRegex(ValueError,'Altezze non valide'):
            apply_proportions(self.data,self.config)


if __name__ == '__main__':
    unittest.main()
