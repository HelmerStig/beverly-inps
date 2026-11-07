"""Genera catalogo stage, contatti delle suole e preset incorporati, da asset locali."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image
from character_proportions import apply_proportions, write_portraits
from feet_contacts import extract_contacts

root = Path(__file__).resolve().parents[1]
folder = root / 'assets/stages/Piazza Europa'
manifest = json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
proportions = json.loads((root/'assets/character-proportions.json').read_text(encoding='utf-8'))
apply_proportions(manifest, proportions)
write_portraits(root, manifest)


def relative(path):
    return path.relative_to(root).as_posix()


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


with Image.open(folder/'piazza-europa.png') as foreground:
    width, height = foreground.size
layers = []
for ident, filename, z_index, speed, haze in [
    ('sky','cielo.png',0,0,0),
    ('clouds-far','01-nuvole-lontane.png',2,6,1),
    ('clouds-mid','02-nuvole-intermedie.png',3,12,.35),
    ('clouds-near','03-nuvole-vicine.png',4,20,0),
    ('foreground','piazza-europa.png',4,0,0),
]:
    with Image.open(folder/filename) as image:
        if image.height != height:
            raise ValueError('Altezza layer diversa dallo stage: '+filename)
        layer = dict(id=ident, image=relative(folder/filename), zIndex=z_index,
            width=image.width, height=image.height)
        if speed:
            layer['speed'] = speed
        if haze:
            layer['haze'] = haze
        layers.append(layer)

fighters, contacts = [], []
for character in manifest['characters']:
    ident = character['id']
    animation = next(a for a in character['animations'] if a['id'] == 'idle')
    feet_frames = extract_contacts(root,animation)
    if any(len(feet)!=2 or feet[1]['x']-feet[0]['x']<=40 for feet in feet_frames):
        raise ValueError('Separazione piedi idle non valida: '+ident)
    reactions={}
    for reaction in character['animations']:
        if reaction['id'] in ['hurt-high','knockdown','get-up']:
            reactions[reaction['id']]=dict(image=reaction['image'],
                pngSha256=hashlib.sha256((root/reaction['image']).read_bytes()).hexdigest(),
                frames=extract_contacts(root,reaction))
    contacts.append(dict(characterId=ident,image=animation['image'],
        pngSha256=hashlib.sha256((root/animation['image']).read_bytes()).hexdigest(),frames=feet_frames,animations=reactions))

for ident, position_x, flipped in [('arianna',675,False),('oscare',1890,True)]:
    character = next(c for c in manifest['characters'] if c['id'] == ident)
    animation = next(a for a in character['animations'] if a['id'] == 'idle')
    fighters.append(dict(characterId=ident, animationId='idle', x=position_x,
        groundY=height-55,
        scale=animation['normalizedPreview']['scale'][0]*proportions['stageScale']*character['stageHeightMultiplier'],
        heightCm=character['heightCm'],heightMultiplier=character['stageHeightMultiplier'],
        anchorX=animation['preview']['anchor'][0],anchorY=animation['preview']['anchor'][1],flipX=flipped))

stage = dict(id='piazza-europa',name='Piazza Europa',width=width,height=height,
    viewportWidth=height*16//9,
    shadow=dict(color='#1d1625',shearX=.5,flattenY=.11,opacity=.72,contactOpacity=.28),
    layers=layers,fighters=fighters)
save(folder/'stage.json',stage)
save(root/'assets/manifest.json',manifest)
(root/'catalog.js').write_text('// Generato dai manifest locali Sanmauro.\nwindow.SANMAURO_CATALOG = '+json.dumps(manifest,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
foot_data = dict(method='Suola alpha >64; due contatti per frame, y al bordo inferiore del pixel.',items=contacts)
save(folder/'foot-contacts.json',foot_data)
(root/'stages-catalog.js').write_text('/* Generato da scripts/build-stages.py. */\n(function(root){const stages='+json.dumps([stage],ensure_ascii=False,indent=2)+';\nif(typeof module==="object"&&module.exports)module.exports=stages;else root.STAGES_CATALOG=stages;\n})(typeof globalThis!=="undefined"?globalThis:this);\n',encoding='utf-8')
(root/'stage-foot-contacts.js').write_text('/* Generato da scripts/build-stages.py. */\nwindow.STAGE_FOOT_CONTACTS = '+json.dumps(foot_data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
preset = json.loads((folder/'crt-preset.json').read_text(encoding='utf-8'))
if preset.get('schema')!='wedoo.crt-preset' or preset.get('version')!=1:
    raise ValueError('Preset CRT non valido')
(root/'crt-presets.js').write_text('/* Generato da scripts/build-stages.py. */\nwindow.STAGE_CRT_PRESETS = '+json.dumps({'piazza-europa':preset},ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print('Piazza Europa: layer, contatti di '+str(sum(len(c['frames']) for c in contacts))+' frame idle e preset CRT aggiornati.')
if '--skip-reports' not in sys.argv and (root/'assets/jump-timing.json').exists():
    subprocess.run([sys.executable,str(root/'scripts/build-jump-report.py')],check=True)
