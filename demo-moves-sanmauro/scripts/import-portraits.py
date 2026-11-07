"""Copia i ritratti selezionati da CharacterSelect.gd senza modificare Godot."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys


def import_portraits(root, source, data):
    config_path = 'scripts/CharacterSelect.gd'
    code = (source/config_path).read_text(encoding='utf-8-sig')
    function = re.search(r'func _get_portrait\(.*?(?=\nfunc |\Z)',code,re.S)[0]
    destination = root/'assets/portraits'
    destination.mkdir(parents=True,exist_ok=True)
    for character in data['characters']:
        ident = 'peiro' if character['id']=='peirolo' else character['id']
        constant = re.search(r'if character_id == "'+ident+r'":\s*return (\w+)',function)[1]
        relative = re.search(r'const '+constant+r' := preload\("res://([^"]+)"\)',code)[1]
        image_path = 'assets/portraits/'+Path(relative).name
        shutil.copy2(source/relative,root/image_path)
        character.update(portrait=image_path,portraitSource=dict(sourcePath=relative,
                         sourceConfigPath=config_path,sourceSha256=hashlib.sha256((source/relative).read_bytes()).hexdigest()))


if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('F:/Personali/Godot')
    data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
    import_portraits(root,source,data)
    (root/'assets/manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (root/'catalog.js').write_text('// Generato dai manifest locali Sanmauro.\nwindow.SANMAURO_CATALOG = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    print('Copiati i 7 ritratti Godot in assets/portraits; manifest e catalogo aggiornati.')
