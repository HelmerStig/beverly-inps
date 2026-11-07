"""Importa solo special/super Arianna e relativi proiettili realmente usati in Godot."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
from PIL import Image

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('F:/Personali/Godot')
folder=root/'assets/specials/arianna';folder.mkdir(parents=True,exist_ok=True)
scripts={name:(source/'scripts'/name).read_text(encoding='utf-8-sig') for name in ['Arianna.gd','AriannaAnimationCatalog.gd','AriannaTornadoProjectile.gd','AriannaBateauProjectile.gd','AriannaTullioProjectile.gd']}


def number(code,key):
    return float(re.search(r'^const '+re.escape(key)+r'\s*:=\s*([\d.]+)',code,re.M)[1])


def vector(code,key):
    return [float(v) for v in re.search(r'^const '+re.escape(key)+r'\s*:=\s*Vector2\(([^)]+)\)',code,re.M)[1].split(',')]


animations=[]
def animation(ident,name,script,prefix,count,columns,fps,indices=None,position=None,scale=None):
    code=scripts[script]
    relative=re.search(r'^const '+prefix+r'\s*:=\s*preload\(\s*"res://([^"]+)"',code,re.M)[1]
    destination=folder/(ident+'.png');shutil.copy2(source/relative,destination)
    indices=list(range(count)) if indices is None else indices
    frames=[[i%columns*512,i//columns*512,512,512] for i in indices]
    with Image.open(destination) as im:
        bounds=[];empty=[];feet=[]
        for index,(x,y,w,h) in enumerate(frames):
            if x+w>im.width or y+h>im.height:raise ValueError('Frame fuori PNG: '+ident)
            bbox=im.crop((x,y,x+w,y+h)).convert('RGBA').getchannel('A').point(lambda v:255 if v>=32 else 0).getbbox()
            if bbox is None:
                if not bounds:raise ValueError('Frame iniziale vuoto: '+ident)
                empty.append(index);frames[index]=list(frames[index-1]);bbox=bounds[-1]
            bounds.append(bbox)
            if index in empty:
                feet.append(feet[-1]);continue
            alpha=im.crop((x,y,x+w,y+h)).convert('RGBA').getchannel('A')
            contacts=[]
            for left,right in [(0,256),(256,512)]:
                half=alpha.crop((left,int(bbox[1]+(bbox[3]-bbox[1])*.7),right,512))
                b=half.point(lambda v:255 if v>64 else 0).getbbox()
                if not b:continue
                yy=int(bbox[1]+(bbox[3]-bbox[1])*.7)+b[3]-1
                xs=[xx for xx in range(left,right) if alpha.getpixel((xx,yy))>64]
                if xs:contacts.append(dict(x=(min(xs)+max(xs)+1)/2,y=yy+1,width=max(xs)-min(xs)+1))
            feet.append(contacts)
        width,height=im.size
    union=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
    a=dict(id=ident,name=name,image=destination.relative_to(root).as_posix(),frames=frames,frameWidth=512,frameHeight=512,
           sourcePath=relative,sourceConfigPath='scripts/'+script,sourceSha256=hashlib.sha256(destination.read_bytes()).hexdigest(),
           sheetWidth=width,sheetHeight=height,playbackFps=fps,sourceFps=fps,sourceIndices=indices,
           durationMs=len(frames)*1000/fps,frameDurations=[1000/fps]*len(frames),loop=False,trimmed=indices!=list(range(count)),
           contentBounds=union,sourceScale=scale,sourcePosition=position,footContacts=feet,emptySourceFrames=empty,
           frameFallbackNote='Le celle vuote mantengono il frame precedente senza cambiare durata; PNG originale integro.' if empty else '')
    sx=380/max(union[2]-union[0],union[3]-union[1]);ax=(union[0]+union[2])/2;ay=union[3]
    a['preview']=dict(drawRect=[256-ax*sx,450-ay*sx,512*sx,512*sx])
    animations.append(a)
    return a


fighter=scripts['Arianna.gd'];catalog=scripts['AriannaAnimationCatalog.gd']
for ident,title,prefix,function in [('baseball','Mazza da baseball','ARIANNA_BASEBALL_SPECIAL','baseball_special'),('dog','Fischio · Bateau','ARIANNA_WHISTLE_SPECIAL','whistle_special'),('cats','Super · Gatti','ARIANNA_POINTS_FORWARD_SUPER','points_forward_super')]:
    setup=re.search(r'func configure_'+function+r'_frames\(\).*?(?=\nfunc |\Z)',catalog,re.S)[0]
    fps=float(re.search(r'set_animation_speed\([^,]+,\s*([\d.]+)',setup)[1])
    count=int(number(fighter,prefix+('_SOURCE_FRAME_COUNT' if ident=='dog' else '_FRAME_COUNT')))
    indices=list(range(count))
    if ident=='dog':indices+=list(range(count-2,-1,-1))
    if ident=='cats':indices=list(range(int(number(fighter,prefix+'_SOURCE_START')),int(number(fighter,prefix+'_SOURCE_END'))+1))
    animation(ident,title,'Arianna.gd',prefix+'_SHEET',count,int(number(fighter,prefix+'_COLUMNS')),fps,indices,
              position=vector(fighter,'ARIANNA_SPRITE_POSITION'),scale=vector(fighter,'ARIANNA_SPRITE_SCALE'))

tornado=scripts['AriannaTornadoProjectile.gd'];dog=scripts['AriannaBateauProjectile.gd'];cats=scripts['AriannaTullioProjectile.gd']
animation('tornado','Tornado','AriannaTornadoProjectile.gd','TORNADO_SHEET',int(number(tornado,'FRAME_COUNT')),int(number(tornado,'COLUMNS')),number(tornado,'ANIMATION_FPS'),scale=vector(tornado,'SPRITE_SCALE'),position=[0,0])
for phase,label in [('RUN','Corsa'),('ATTACK','Attacco'),('BACK_TO_RUN','Ritorno alla corsa')]:
    animation('bateau-'+phase.lower().replace('_','-'),'Bateau · '+label,'AriannaBateauProjectile.gd',phase+'_SHEET',int(number(dog,phase+'_FRAME_COUNT')),int(number(dog,phase+'_COLUMNS')),number(dog,'ANIMATION_FPS'),scale=vector(dog,'SPRITE_SCALE'),position=vector(dog,'SPRITE_POSITION'))
profiles={}
for ident,prefix,speed in [('tullio','',680),('tilda','TILDA_',755),('telma','TELMA_',625)]:
    profile=re.search(r'&"'+ident+r'":\s*\{(.*?)\}',cats,re.S)[1]
    run_count=int(re.search(r'"run_frames":\s*(\d+)',profile)[1]);speed=float(re.search(r'"speed":\s*([\d.]+)',profile)[1])
    profiles[ident]=dict(speed=speed,runFrames=run_count)
    for phase in ['RUN','JUMP','ATTACK']:
        count=run_count if phase=='RUN' else int(number(cats,phase+'_FRAME_COUNT'))
        animation(ident+'-'+phase.lower(),ident.title()+' · '+phase.lower(),'AriannaTullioProjectile.gd',prefix+phase+'_SHEET',count,int(number(cats,phase+'_COLUMNS')),number(cats,'ANIMATION_FPS'),scale=vector(cats,'SPRITE_SCALE'),position=vector(cats,'SPRITE_POSITION'))

parameters=dict(
    baseball=dict(spawnFrame=int(number(fighter,'ARIANNA_BASEBALL_TORNADO_SPAWN_FRAME')),spawnOffset=vector(fighter,'ARIANNA_BASEBALL_TORNADO_SPAWN_OFFSET'),
                  speeds={s:number(tornado,k) for s,k in [('light','MOVE_SPEED'),('medium','MEDIUM_MOVE_SPEED'),('heavy','HEAVY_MOVE_SPEED')]},
                  lifetime=number(tornado,'MAX_LIFETIME'),growthSeconds=number(tornado,'GROWTH_DURATION'),startScale=vector(tornado,'START_SCALE')[0]),
    dog=dict(spawnFrame=int(number(fighter,'ARIANNA_WHISTLE_BATEAU_SPAWN_FRAME')),speed=number(dog,'MOVE_SPEED'),trigger=number(dog,'ATTACK_TRIGGER_DISTANCE'),
             contact=number(dog,'ATTACK_CONTACT_DISTANCE'),hitFrame=int(number(dog,'ATTACK_HIT_FRAME')),margin=number(dog,'OFFSCREEN_MARGIN')),
    cats=dict(spawnFrame=int(number(fighter,'ARIANNA_POINTS_FORWARD_CAT_WAVE_START_FRAME')),count=12,perProfile=4,profiles=profiles,
              attackLoops=int(number(cats,'ATTACK_LOOPS')),trigger=number(cats,'ATTACK_TRIGGER_DISTANCE'),contact=number(cats,'ATTACK_CONTACT_DISTANCE'),
              hitFrame=int(number(cats,'ATTACK_HIT_FRAME')),faceChance=number(cats,'FACE_JUMP_CHANCE'),faceTrigger=number(cats,'FACE_JUMP_TRIGGER_DISTANCE'),
              faceHitFrame=int(number(cats,'FACE_JUMP_HIT_FRAME')),margin=number(cats,'OFFSCREEN_MARGIN'),delayRange=[.07,.17],speedRange=[.82,1.22]))
data=dict(schema='sanmauro.specials',version=1,characters=[dict(id='arianna',name='Arianna',moves=[dict(id='baseball',name='Mazza da baseball',kind='Special',projectiles=['tornado']),dict(id='dog',name='Fischio · Bateau',kind='Special',projectiles=['bateau-run','bateau-attack','bateau-back-to-run']),dict(id='cats',name='Super · Gatti',kind='Super',projectiles=[a['id'] for a in animations if a['id'].startswith(('tullio-','tilda-','telma-'))])])],
          animations=animations,parameters=parameters,preview=dict(projectileOffsetY=-30,referenceHeight=1080),sourceScripts=[dict(path='scripts/'+name,sha256=hashlib.sha256((source/'scripts'/name).read_bytes()).hexdigest()) for name in scripts])
(folder/'specials.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'specials-catalog.js').write_text('// Generato da scripts/import-arianna-specials.py.\n(function(root){const data='+json.dumps(data,ensure_ascii=False,indent=2)+';if(typeof module==="object"&&module.exports)module.exports=data;else root.SPECIALS_CATALOG=data;})(typeof globalThis!=="undefined"?globalThis:this);\n',encoding='utf-8')
print('Arianna: 3 mosse e 13 animazioni dei proiettili importate, PNG integri e parametri Godot conservati.')
import html
rows=[]
for a in animations:
    note=a['frameFallbackNote'] or 'Sequenza sorgente conservata.'
    rows.append(f'<tr><th>{html.escape(a["name"])}</th><td>{len(a["frames"])}</td><td>{a["playbackFps"]:g}</td><td>{a["durationMs"]:.2f} ms</td><td><a href="../{a["image"]}">PNG</a></td><td>{html.escape(note)}</td></tr>')
report='''<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arianna · Special e Super</title><style>body{background:#141815;color:#eff3eb;font:15px/1.6 system-ui;padding:28px}main{max-width:1200px;margin:auto}a{color:#ceef80}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:12px;border-bottom:1px solid #3b493c}.table-wrap{overflow:auto}</style><main><a href="../specials.html">← Apri Special e Super</a><h1>Arianna · Special e Super</h1><p>Mazza da baseball: 49 frame a 48 fps, tornado al frame 23 (indice da zero), 479,17 ms. Fischio: 0–24,23–0 a 24 fps, Bateau al frame 12, 500 ms. Super: sorgenti 9–42 inclusi a 24 fps, ondata al frame 10 della sequenza riprodotta, 416,67 ms.</p><p>La super crea 12 gatti, quattro per profilo, con ordine mescolato; ritardi 70–170 ms e moltiplicatore di velocità 0,82–1,22. Tullio corre a 680, Tilda a 755 e Telma a 625 unità Godot/s. Tre attacchi normali per gatto oppure salto al volto con probabilità 30%. Nella demo un seme ripete la stessa ondata; “Nuova ondata” cambia la sequenza.</p><p>Anteprima visiva: traiettorie e tempi sono ricostruiti dai parametri Godot, con bersaglio fermo. Particelle e lampi sono adattati al canvas; collisioni fisiche, danni, input di combattimento e audio non sono simulati. Peirò non è incluso: le sue mosse sono ancora da creare.</p><p>Il PNG Bateau-run contiene una cella finale trasparente (indice 48) tra i 49 frame richiesti dal codice Godot. La demo mantiene il frame precedente per quel solo intervallo, preservando PNG e durata originali.</p><p><a href="../assets/specials/arianna/specials.json">Manifest completo con hash e parametri</a></p><div class="table-wrap"><table><thead><tr><th>Animazione</th><th>Frame</th><th>FPS</th><th>Durata sequenza</th><th>Asset</th><th>Note</th></tr></thead><tbody>'''+''.join(rows)+'</tbody></table></div></main></html>'
(root/'reports/arianna-specials.html').write_text(report,encoding='utf-8')
