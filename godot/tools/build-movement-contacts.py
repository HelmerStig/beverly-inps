"""Regenerate sole contacts for movement animations using the demo's extractor."""
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parent/'demo-moves-sanmauro/scripts'))
from feet_contacts import extract_contacts
roster=json.loads((ROOT/'data/debug-roster.json').read_text(encoding='utf-8'))
result={}
for c in roster['characters']:
    result[c['id']]={name:extract_contacts(ROOT,a) for name,a in c['animations'].items()}
    print(c['id'],'back-jump bottoms:',[max((p['y'] for p in row),default=0) for row in result[c['id']]['back-jump']])
(ROOT/'data/movement-contacts.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
