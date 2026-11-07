"""Importazione ripetibile delle mosse normali mancanti dai cataloghi revisionati."""
import hashlib
import json
from pathlib import Path
import shutil
import statistics
from PIL import Image
from character_proportions import apply_proportions,write_portraits
from jump_timing import frames_hash


def apply_remaining_timing(data, config):
    if config.get('schema')!='sanmauro.remaining-moves-timing' or config.get('version')!=1:
        raise ValueError('Timing mosse normali non valido')
    entries={(e['characterId'],e['id']):e for e in config['items']}
    for character in data['characters']:
        for a in character['animations']:
            if not a.get('remainingImport') or not a.get('attackStrength'):continue
            entry=entries[(character['id'],a['id'])]
            if entry['sourceSha256']!=a['sourceSha256'] or entry['framesSha256']!=frames_hash(a['frames']):
                raise ValueError('Rivedere estensione dopo cambio asset: '+character['id']+'/'+a['id'])
            strength=config['strengths'][a['attackStrength']]
            impact_ms,total_ms=strength['impactMs'],strength['durationMs']
            peak,count=entry['impactFrame'],len(a['frames'])
            if not isinstance(peak,int) or not 0<peak<count-1 or not 0<impact_ms<total_ms:
                raise ValueError('Timing o frame estensione non valido: '+a['id'])
            durations=[impact_ms/peak]*peak+[(total_ms-impact_ms)/(count-peak-1)]*(count-peak-1)+[0]
            a.update(frameDurations=durations,durationMs=total_ms,playbackFps=count*1000/total_ms,
                     impactFrame=peak,impactMs=impact_ms,attackDurationMs=total_ms,returnToIdleMs=total_ms,
                     terminalPose='air' if a['id'].startswith('jump-') else 'crouched' if a['id'].startswith('crouched-') else 'idle',
                     impactNote=entry.get('note',''))


def import_remaining(root, source, data):
    snapshot=json.loads((root/'assets/remaining-moves-source.json').read_text(encoding='utf-8'))
    config=json.loads((root/'assets/remaining-moves-timing.json').read_text(encoding='utf-8'))
    records=snapshot['records']
    hashes={}
    for record in records:
        for path_key,hash_key in [('sourcePath','sourceSha256'),('sourceConfigPath','sourceConfigSha256'),('sourceSetupPath','sourceSetupSha256')]:
            path=record[path_key]
            if path not in hashes:hashes[path]=hashlib.sha256((source/path).read_bytes()).hexdigest()
            if hashes[path]!=record[hash_key]:raise ValueError('Rigenerare audit Godot dopo modifica: '+path)
    for character in data['characters']:
        character['animations']=[a for a in character['animations'] if not a.get('remainingImport')]
        idle=character['animations'][0]
        factor=344/(idle['medianContentHeight']*idle['sourceTransform']['scale'][1])
        images={a['sourcePath']:a['image'] for a in character['animations'] if not a.get('derivedAtlas')}
        for record in [r for r in records if r['characterId']==character['id']]:
            r=dict(record);relative=r['sourcePath'];frames=r['frames'];durations=r['sourceFrameDurations']
            image_path=images.get(relative)
            if image_path is None:
                image_path=f'assets/characters/{character["id"]}/{r["id"]}.png'
                shutil.copy2(source/relative,root/image_path);images[relative]=image_path
            with Image.open(root/image_path) as image:
                width,height=image.size;bounds=[]
                for x,y,w,h in frames:
                    if min(x,y)<0 or x+w>width or y+h>height:raise ValueError('Frame fuori PNG: '+relative)
                    alpha=image.crop((x,y,x+w,y+h)).convert('RGBA').getchannel('A')
                    bounds.append(alpha.point(lambda v:255 if v>=32 else 0).getbbox())
                if any(b is None for b in bounds):raise ValueError('Frame vuoto: '+relative)
            union=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
            fw,fh=frames[0][2:];sx,sy=[s*factor for s in r['sourceTransform']['scale']]
            ax,ay=(union[0]+union[2])/2,union[3]
            preview=dict(drawRect=[256-ax*sx,430-ay*sy,fw*sx,fh*sy],anchor=[ax,ay],scale=[sx,sy],centerX=256,groundY=430,targetIdleHeight=344)
            strength=next((s for s in ['light','medium','heavy'] if s in r['id'].split('-')),None) if r['attack'] else None
            playback_frames=[list(f) for f in frames]
            if strength:playback_frames.append(list(frames[0]))
            a=dict(id=r['id'],name=r['name'],image=image_path,frameWidth=fw,frameHeight=fh,frames=playback_frames,
                   sourceFrames=frames,sourceFps=r['sourceFps'],sourceLoop=r['sourceLoop'],loop=False,
                   playbackFps=r['sourceFps'],sourcePath=relative,sourceSha256=r['sourceSha256'],
                   sourceConfigPath=r['sourceConfigPath'],sourceSetupPath=r['sourceSetupPath'],sourceAnimation=r['sourceAnimation'],
                   sourceTransform=r['sourceTransform'],sourceRecoveryAnimation=r.get('sourceRecoveryAnimation'),
                   sourceFrameDurations=durations,sourceDurationMs=sum(durations),frameDurations=list(durations),durationMs=sum(durations),
                   sheetWidth=width,sheetHeight=height,contentBounds=union,medianContentHeight=statistics.median(b[3]-b[1] for b in bounds),
                   preview=preview,normalizedPreview=preview,trimmed=True,remainingImport=True,attackStrength=strength)
            if r['id']=='stand-up':
                a.update(frameDurations=[250/len(frames)]*len(frames),durationMs=250,poseDurationMs=250,playbackFps=len(frames)*4)
            character['animations'].append(a)
    apply_remaining_timing(data,config)
    apply_proportions(data,json.loads((root/'assets/character-proportions.json').read_text(encoding='utf-8')))
    write_portraits(root,data)


if __name__=='__main__':
    import sys
    root=Path(__file__).resolve().parents[1]
    source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('F:/Personali/Godot')
    data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
    import_remaining(root,source,data)
    (root/'assets/manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (root/'catalog.js').write_text('// Generato dai manifest locali Sanmauro.\nwindow.SANMAURO_CATALOG = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
    print('Importate '+str(sum(a.get('remainingImport',False) for c in data['characters'] for a in c['animations']))+' mosse normali mancanti.')
