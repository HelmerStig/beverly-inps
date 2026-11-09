"""Integrate the local idle-only Lele assets without importing or changing Godot."""
import copy, hashlib, json, statistics
from pathlib import Path
from PIL import Image
from character_proportions import apply_proportions, write_portraits
from feet_contacts import extract_contacts

def add_lele(root, data):
    folder=root/'assets/characters/lele'
    config=json.loads((folder/'character.json').read_text(encoding='utf-8'))
    path=folder/config['idleImage']; sheet=Image.open(path).convert('RGBA')
    cell=config['cellSize']; frames=[]; bounds=[]
    for y in range(0,sheet.height,cell):
        for x in range(0,sheet.width,cell):
            box=sheet.crop((x,y,x+cell,y+cell)).getchannel('A').point(lambda a:255 if a>=32 else 0).getbbox()
            if box:
                frames.append([x,y,cell,cell]);bounds.append(box)
    if len(frames)!=config['frameCount']:raise ValueError('Review Lele idle frame count')
    union=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
    median=statistics.median(b[3]-b[1] for b in bounds)
    scale=344/median; anchor=[(union[0]+union[2])/2,union[3]]
    preview=dict(drawRect=[256-anchor[0]*scale,430-anchor[1]*scale,cell*scale,cell*scale],
                 anchor=anchor,scale=[scale,scale],centerX=256,groundY=430,targetIdleHeight=344)
    animation=dict(id='idle',name='Idle',image=path.relative_to(root).as_posix(),frameWidth=cell,frameHeight=cell,
        frames=frames,playbackFps=config['fps'],sourceFps=config['fps'],sheetWidth=sheet.width,sheetHeight=sheet.height,
        sourcePath=path.relative_to(root).as_posix(),sourceConfigPath='assets/characters/lele/character.json',
        sourceTransform=dict(scale=[1,1],position=[0,0]),contentBounds=union,medianContentHeight=median,
        trimmed=False,loop=True,sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        preview=copy.deepcopy(preview),normalizedPreview=preview)
    portrait='assets/portraits/lele-portrait-v3.png'
    character=dict(id='lele',name='Lele',localIdleOnly=True,
        thumbnail='assets/characters/lele/portrait.png',portrait=portrait,
        portraitSource=dict(sourcePath=portrait,sourceConfigPath='assets/characters/lele/character.json',
            sourceSha256=hashlib.sha256((root/portrait).read_bytes()).hexdigest()),animations=[animation])
    data['characters']=[c for c in data['characters'] if c['id']!='lele']+[character]
    apply_proportions(data,json.loads((root/'assets/character-proportions.json').read_text(encoding='utf-8')))
    write_portraits(root,{'characters':[character]})
    contact=dict(characterId='lele',image=animation['image'],pngSha256=animation['sourceSha256'],
                 frames=extract_contacts(root,animation),animations={})
    contact_path=root/'assets/stages/Piazza Europa/foot-contacts.json'
    contacts=json.loads(contact_path.read_text(encoding='utf-8'))
    contacts['items']=[c for c in contacts['items'] if c['characterId']!='lele']+[contact]
    contact_path.write_text(json.dumps(contacts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (root/'stage-foot-contacts.js').write_text('/* Generato dai contatti locali. */\nwindow.STAGE_FOOT_CONTACTS = '+json.dumps(contacts,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    return character

if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    path=root/'assets/manifest.json';data=json.loads(path.read_text(encoding='utf-8'))
    before={c['id']:copy.deepcopy(c) for c in data['characters'] if c['id']!='lele'}
    character=add_lele(root,data)
    assert all(c==before[c['id']] for c in data['characters'] if c['id']!='lele'), 'Existing characters changed'
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (root/'catalog.js').write_text('// Generato dai manifest locali Sanmauro.\nwindow.SANMAURO_CATALOG = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    print(f'Lele integrated: {len(character["animations"][0]["frames"])} idle frames, portrait v3; existing seven preserved.')
