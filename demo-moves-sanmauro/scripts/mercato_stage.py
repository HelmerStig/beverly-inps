"""Build Mercatò using native layer dimensions; shared by the full stage builder."""
import json
from pathlib import Path
from PIL import Image

def build_mercato(root, template):
    folder = root / 'assets/stages/Mercatò'
    with Image.open(folder/'mercato.png') as image:
        width, height = image.size
    layers = []
    for ident, filename, z, speed in [
        ('sky','cielo.png',0,0),
        ('foreground','mercato.png',4,0),
    ]:
        with Image.open(folder/filename) as image:
            if image.height != height:
                raise ValueError('Layer height differs from Mercatò: '+filename)
            layer = dict(id=ident,image=(folder/filename).relative_to(root).as_posix(),
                         zIndex=z,width=image.width,height=image.height)
        if speed:
            layer['speed'] = speed
        layers.append(layer)
    stage = dict(id='mercato',name='Mercatò',width=width,height=height,viewportWidth=width,
                 shadow=template['shadow'],layers=layers,fighters=template['fighters'],shootingStars=True,rain=True,webglClouds=True,lightning=True)
    (folder/'stage.json').write_text(json.dumps(stage,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return stage

def write_catalog(root, stages):
    (root/'stages-catalog.js').write_text('/* Generato da scripts/build-stages.py. */\n(function(root){const stages='+json.dumps(stages,ensure_ascii=False,indent=2)+';\nif(typeof module==="object"&&module.exports)module.exports=stages;else root.STAGES_CATALOG=stages;\n})(typeof globalThis!=="undefined"?globalThis:this);\n',encoding='utf-8')

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    piazza = json.loads((root/'assets/stages/Piazza Europa/stage.json').read_text(encoding='utf-8'))
    write_catalog(root,[piazza,build_mercato(root,piazza)])
    print('Mercatò added after Piazza Europa; native 2550x1080 full-stage viewport.')
