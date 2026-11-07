"""Importa il fondale realmente usato dalla TitleScreen Godot, con preset Piazza Europa."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
from PIL import Image

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('F:/Personali/Godot')
script=source/'scripts/TitleScreen.gd'
code=script.read_text(encoding='utf-8-sig')
block=re.search(r'const BACKGROUND_LAYERS\s*:=\s*\[(.*?)\]',code,re.S)[1]
paths=re.findall(r'"res://([^"]+)"',block)
if len(paths)!=10:raise ValueError('Rivedere i layer TitleScreen: configurazione sorgente cambiata')
stage=json.loads((root/'assets/stages/Piazza Europa/stage.json').read_text(encoding='utf-8'))
speeds=[layer['speed'] for layer in stage['layers'] if layer.get('speed')]
if len(speeds)!=3:raise ValueError('Piazza Europa deve avere tre piani in movimento')
folder=root/'assets/ui/title-screen';folder.mkdir(parents=True,exist_ok=True)
title_root='assets/backgrounds/default_stage/main-image/'
names=['Cielo e paesaggio lontano','Nuvole lontane','Nuvole intermedie','Nuvole vicine','Paesaggio','Acqua','Riflesso nuvole lontane','Riflesso nuvole intermedie','Riflesso nuvole vicine','Primo piano']
moving={1:0,2:1,3:2,6:0,7:1,8:2}
layers=[]
for index,relative in enumerate(paths):
    if not relative.startswith(title_root):raise ValueError('Percorso layer inatteso: '+relative)
    target=folder/relative[len(title_root):];target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source/relative,target)
    with Image.open(target) as image:width,height=image.size
    layer=dict(id='title-layer-'+str(index),name=names[index],image=target.relative_to(root).as_posix(),
        zIndex=index,width=width,height=height,renderWidth=width*stage['height']/height,renderHeight=stage['height'],
        sourcePath=relative,sourceSha256=hashlib.sha256(target.read_bytes()).hexdigest())
    if index in moving:layer['speed']=speeds[moving[index]]
    if index in [1,2]:layer['haze']=[1,.35][index-1]
    layers.append(layer)
preset=json.loads((root/'assets/stages/Piazza Europa/crt-preset.json').read_text(encoding='utf-8'))
(folder/'crt-preset.json').write_text(json.dumps(preset,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
screen=dict(id='ui-title-screen',name='Schermata iniziale',width=layers[0]['renderWidth'],height=stage['height'],viewportWidth=stage['viewportWidth'],
    layers=layers,fighters=[],crtPreset=preset,
    sourceFiles=[dict(path=relative,sha256=hashlib.sha256((source/relative).read_bytes()).hexdigest()) for relative in ['scripts/TitleScreen.gd','scenes/TitleScreen.tscn']],
    scope='Solo fondale; nessun logo, testo, menu, personaggio o transizione. Acqua statica; riflessi delle nuvole in movimento.',
    referenceStageId=stage['id'])
data=dict(schema='sanmauro.ui',version=1,screens=[screen])
(folder/'screen.json').write_text(json.dumps(screen,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'ui-catalog.js').write_text('// Generato da scripts/build-ui.py.\n(function(root){const data='+json.dumps(data,ensure_ascii=False,indent=2)+';if(typeof module==="object"&&module.exports)module.exports=data;else root.UI_CATALOG=data;})(typeof globalThis!=="undefined"?globalThis:this);\n',encoding='utf-8')
print('UI: fondale iniziale, 10 PNG originali, nuvole e riflessi a '+str(speeds)+' px/s; preset Piazza Europa.')
