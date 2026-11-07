"""Congela le sequenze runtime mancanti, escludendo special, super e prese."""
import hashlib
import json
from pathlib import Path
import re
import sys
from PIL import Image,ImageDraw

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('F:/Personali/Godot')
audit=root.parent/'tmp/godot-animation-audit'
base=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
existing={'idle','walk','jump','crouch','block_high','block_mid','block_low','block_low_crouched',
          'hurt_high','hurt_mid','hurt_low','hurt_crouched','victory','ko','light_punch','medium_punch','strong_punch',
          'light_punch_single','medium_open_hand_slap','heavy_punch'}
labels={'backwalk':'Camminata indietro','run':'Corsa','back-jump':'Salto indietro','hurt-air':'Colpo subito in aria',
        'knockdown':'Atterramento da spazzata','get-up':'Rialzata da terra','stand-up':'Rialzata da accovacciata','air-guard':'Posa in aria'}


def canonical(runtime):
    name=runtime.removeprefix('arianna_')
    if name in ('back_jump','dodge'): return 'back-jump'
    if name=='hurted_in_jump': return 'hurt-air'
    if name=='sweep_knockdown': return 'knockdown'
    if name=='knockdown_recovery': return 'get-up'
    if name=='jump_pose': return 'air-guard'
    if name=='crouched_punch': return 'crouched-light-punch'
    if name=='crouched_punch_crouched': return 'crouched-light-punch-charged'
    if name=='crouched_medium_punch_crouched': return 'crouched-medium-punch-charged'
    if name=='crouched_power_punch': return 'crouched-heavy-punch'
    if name.startswith('combo_'):
        return {'combo_lp':'combo-light-punch','combo_mp':'combo-medium-punch','combo_mk':'combo-medium-kick'}[name]
    return name.replace('low_','crouched_').replace('strong','heavy').replace('_','-')


def label(ident):
    if ident in labels:return labels[ident]
    words=ident.split('-');strength=next(s for s in ['light','medium','heavy'] if s in words)
    name=('Pugno ' if 'punch' in words else 'Calcio ')+{'light':'leggero','medium':'medio','heavy':'pesante'}[strength]
    if 'crouched' in words:name+=' accovacciato'
    if 'jump' in words:name+=' in salto'
    if 'combo' in words:name+=' · combo'
    if 'charged' in words:name+=' · già accovacciato'
    return name


def resource_animations():
    path='assets/sprites/characters/mangler/idle_frames.tres'
    code=(source/path).read_text(encoding='utf-8-sig');items=[]
    for record in re.finditer(r'"frames":\s*\[(.*?)\],\s*"loop":\s*(\w+),\s*"name":\s*&?"([^"]+)",\s*"speed":\s*([\d.]+)',code,re.S):
        if record[3] not in ('dodge','knockdown_recovery'):continue
        cells=[]
        for entry in re.finditer(r'"duration":\s*([\d.]+),\s*"texture":\s*SubResource\("([^"]+)"\)',record[1]):
            block=re.search(r'\[sub_resource type="AtlasTexture" id="'+re.escape(entry[2])+r'"\](.*?)(?=\n\[|\Z)',code,re.S)[1]
            rect=[int(float(v)) for v in re.search(r'region = Rect2\(([^)]+)\)',block)[1].split(',')]
            rid=re.search(r'atlas = ExtResource\("([^"]+)"\)',block)[1]
            relative=re.search(r'path="res://([^"]+)" id="'+re.escape(rid)+'"',code)[1]
            cells.append(dict(rect=rect,sourcePath=relative,weight=float(entry[1])))
        items.append(dict(function=path,animations=[dict(animation=record[3],fps=float(record[4]),loop=record[2]=='true',cells=cells)]))
    return items


records=[]
for character in base['characters']:
    ident=character['id'];who={'peirolo':'Peirolo'}.get(ident,ident.title())
    raw=json.loads((audit/(who+'-runtime.json')).read_text(encoding='utf-8'))
    if ident=='mangler':raw+=resource_animations()
    scene_path='scripts/'+who+'.gd' if ident in ('arianna','mangler') else 'scenes/'+who+'.tscn'
    scene_code=(source/scene_path).read_text(encoding='utf-8-sig')
    reworked=[]
    if ident=='mangler':
        body=re.search(r'var uses_reworked_art := animated_sprite.animation in \[(.*?)\]',scene_code,re.S)[1]
        reworked=re.findall(r'&"([^"]+)"',body)
    character_records=[]
    for group in raw:
        animations={a['animation']:a for a in group['animations']}
        for runtime,a in animations.items():
            name=runtime.removeprefix('arianna_')
            if name in existing or name in ('crouched_punch_crouched','crouched_medium_punch_crouched') or (name.endswith(('_recovery','_reverse')) and name!='knockdown_recovery') or any(s in name for s in ['grab','super','special','combo']):continue
            move=canonical(runtime)
            cells=[dict(c,rect=[int(v) for v in c['rect']]) for c in a['cells']]
            durations=[c.get('weight',1)*1000/a['fps'] for c in cells]
            recovery=animations.get(runtime+'_recovery')
            if recovery:
                cells += [dict(c,rect=[int(v) for v in c['rect']]) for c in recovery['cells']]
                durations += [c.get('weight',1)*1000/recovery['fps'] for c in recovery['cells']]
            setup='scripts/'+who+'AnimationCatalog.gd' if ident in ('arianna','mangler') else 'scripts/IdleRosterFighter.gd'
            if group['function'].endswith('.tres'):setup=group['function']
            transform=character['animations'][0]['sourceTransform']
            if ident=='mangler':
                constants=json.loads((audit/'Mangler.json').read_text())['values']
                prefix='REWORK_SPRITE' if runtime in reworked else 'LEGACY_SPRITE'
                scale=constants[prefix+'_SCALE']['vector']
                if runtime in ['jump_light_kick','jump_medium_kick','jump_heavy_kick']:scale=constants['JUMP_LIGHT_KICK_SPRITE_SCALE']['vector']
                transform=dict(scale=scale,position=constants[prefix+'_POSITION']['vector'])
            paths=set(c['sourcePath'] for c in cells)
            if len(paths)!=1:raise ValueError('Più PNG inattesi: '+runtime)
            relative=paths.pop();rects=[c['rect'] for c in cells]
            with Image.open(source/relative) as sheet:
                reaches=[]
                for x,y,w,h in rects:
                    alpha=sheet.crop((x,y,x+w,y+h)).convert('RGBA').getchannel('A')
                    bounds=alpha.point(lambda v:255 if v>=128 else 0).getbbox()
                    reaches.append(bounds[2] if bounds else -1)
            attack=any(s in move.split('-') for s in ['light','medium','heavy'])
            peak=reaches.index(max(reaches)) if attack else None
            # Il picco non può essere il frame iniziale: nei casi di sagoma
            # più larga in guardia si usa la fase attiva dichiarata da Godot.
            if attack and peak==0:
                candidate=max(range(1,len(reaches)),key=lambda i:reaches[i]);peak=candidate
            record=dict(characterId=ident,id=move,name=label(move),sourceAnimation=runtime,sourcePath=relative,
                        sourceSha256=hashlib.sha256((source/relative).read_bytes()).hexdigest(),
                        sourceConfigPath=scene_path,sourceConfigSha256=hashlib.sha256((source/scene_path).read_bytes()).hexdigest(),
                        sourceSetupPath=setup,sourceSetupSha256=hashlib.sha256((source/setup).read_bytes()).hexdigest(),
                        frames=rects,sourceFrameDurations=durations,sourceFps=a['fps'],sourceLoop=a['loop'],
                        sourceTransform=transform,attack=attack,impactFrame=peak,
                        sourceRecoveryAnimation=recovery['animation'] if recovery else None)
            character_records.append(record)
    # Rialzata: recovery nominale se presente, altrimenti play_backwards di crouch.
    flattened={a['animation']:a for g in raw for a in g['animations']}
    crouch=flattened.get('arianna_crouch_recovery')
    base_crouch=flattened.get('crouch')
    if base_crouch:
        a=crouch or base_crouch;cells=a['cells'] if crouch else a['cells'][::-1]
        relative=cells[0]['sourcePath'];setup='scripts/'+who+'AnimationCatalog.gd' if ident in ('arianna','mangler') else 'scripts/IdleRosterFighter.gd'
        character_records.append(dict(characterId=ident,id='stand-up',name=labels['stand-up'],sourceAnimation=a['animation'],
            sourcePath=relative,sourceSha256=hashlib.sha256((source/relative).read_bytes()).hexdigest(),
            sourceConfigPath=scene_path,sourceConfigSha256=hashlib.sha256((source/scene_path).read_bytes()).hexdigest(),
            sourceSetupPath=setup,sourceSetupSha256=hashlib.sha256((source/setup).read_bytes()).hexdigest(),
            frames=[[int(v) for v in c['rect']] for c in cells],sourceFrameDurations=[c['weight']*1000/a['fps'] for c in cells],
            sourceFps=a['fps'],sourceLoop=False,sourceTransform=character['animations'][0]['sourceTransform'],attack=False,impactFrame=None))
    records+=character_records
    print(ident,len(character_records),'mosse mancanti')

result=dict(schema='sanmauro.remaining-moves-source',version=1,exclusions=['special','super','grab','combo','charged-variants'],records=records)
(root/'assets/remaining-moves-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Snapshot: '+str(len(records))+' animazioni senza prese/special/super.')
