"""Importa le Special effettive Godot; Macchia corrisponde a Torpe.

Eseguire dopo import-arianna-specials.py. Nessuna modifica al progetto Godot.
"""
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
import sys
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('F:/Personali/Godot')
data = json.loads((root/'assets/specials/arianna/specials.json').read_text(encoding='utf-8'))
roster = json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
scripts = {}

def read(name):
    path = source/'scripts'/name
    scripts[name] = dict(path='scripts/'+name, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    return path.read_text(encoding='utf-8-sig')

def constant(file, key):
    return re.search(r'const '+key+r'\s*:=\s*preload\(\s*"res://([^"]+)"', read(file))[1]

def add(cid, ident, title, relative, count, columns, fps, cell=512, indices=None, rects=None, weights=None, scale=None, position=None, fixes=None):
    folder=root/'assets/specials'/cid;folder.mkdir(parents=True,exist_ok=True)
    original=folder/(ident+'-source.png' if fixes else ident+'.png')
    shutil.copy2(source/relative,original)
    indices=list(range(count)) if indices is None else indices
    frames=rects or [[i%columns*cell,i//columns*cell,cell,cell] for i in indices]
    image=Image.open(original).convert('RGBA')
    source_frames=[list(f) for f in frames]
    if fixes:
        atlas=Image.new('RGBA',(columns*cell,((len(frames)+columns-1)//columns)*cell))
        for n,(x,y,w,h) in enumerate(frames):
            tile=image.crop((x,y,x+w,y+h))
            if n in fixes:tile.paste((0,0,0,0),(0,0,cell,40))
            atlas.paste(tile,(n%columns*cell,n//columns*cell))
        image=atlas;frames=[[n%columns*cell,n//columns*cell,cell,cell] for n in range(len(frames))]
        destination=folder/(ident+'.png');image.save(destination)
    else:destination=original
    bounds=[];feet=[];empty=[]
    for n,(x,y,w,h) in enumerate(frames):
        if x+w>image.width or y+h>image.height:raise ValueError(ident+' frame fuori PNG')
        alpha=image.crop((x,y,x+w,y+h)).getchannel('A')
        box=alpha.point(lambda v:255 if v>=32 else 0).getbbox()
        if box is None:
            empty.append(n);box=bounds[-1] if bounds else (0,0,w,h)
            if n:frames[n]=list(frames[n-1])
        bounds.append(box);contacts=[]
        for left,right in [(0,w//2),(w//2,w)]:
            low=int(box[1]+(box[3]-box[1])*.7)
            b=alpha.crop((left,low,right,h)).point(lambda v:255 if v>64 else 0).getbbox()
            if b:
                yy=low+b[3]-1;xs=[xx for xx in range(left,right) if alpha.getpixel((xx,yy))>64]
                if xs:contacts.append(dict(x=(min(xs)+max(xs)+1)/2,y=yy+1,width=max(xs)-min(xs)+1))
        feet.append(contacts)
    union=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
    sx=380/max(1,union[2]-union[0],union[3]-union[1]);ax=(union[0]+union[2])/2;ay=union[3]
    durations=[1000/fps*w for w in (weights or [1]*len(frames))]
    a=dict(id=ident,characterId=cid,name=title,image=destination.relative_to(root).as_posix(),frames=frames,
        frameWidth=frames[0][2],frameHeight=frames[0][3],sourcePath=relative,sourceImage=original.relative_to(root).as_posix(),
        sourceSha256=hashlib.sha256(original.read_bytes()).hexdigest(),imageSha256=hashlib.sha256(destination.read_bytes()).hexdigest(),
        sourceFrames=source_frames,sourceIndices=indices,sourceFps=fps,playbackFps=fps,durationMs=sum(durations),frameDurations=durations,
        sheetWidth=image.width,sheetHeight=image.height,loop=False,contentBounds=union,footContacts=feet,emptySourceFrames=empty,
        sourceScale=scale or [1,1],sourcePosition=position or [0,0],
        preview=dict(drawRect=[256-ax*sx,450-ay*sx,frames[0][2]*sx,frames[0][3]*sx]),
        frameFallbackNote='Celle trasparenti: mantiene il frame precedente.' if empty else '')
    if fixes:a['frameFallbackNote']='Come Godot: rimossi i 40 px superiori dai frame runtime 37 e 38, conservando la cella 512 e il PNG originale.'
    data['animations'].append(a)
    return a

def sheet(cid, ident, title, file, key, count, columns, fps, **kwargs):
    return add(cid,ident,title,constant(file,key),count,columns,fps,**kwargs)

def fighter(cid,ident,title,file,key,count,cols,fps,**kwargs):
    idle=next(a for c in roster['characters'] if c['id']==cid for a in c['animations'] if a['id']=='idle')
    a=sheet(cid,ident,title,file,key,count,cols,fps,scale=idle['sourceTransform']['scale'],position=idle['sourceTransform']['position'],**kwargs)
    # Preserve actor scale and placement across all phases; never fit each pose independently.
    a['normalizedPreview']=dict(anchor=idle['normalizedPreview']['anchor'])
    return a

def move(ident,title,projectiles=(),phases=None,kind='Special',**params):
    data['parameters'][ident]=params
    return dict(id=ident,name=title,kind=kind,projectiles=list(projectiles),phases=phases or [ident])

cid='mangler'
fighter(cid,'cymbals','Lancio dei piatti','Mangler.gd','SPECIAL_SONIC_BOOM_SHEET',49,7,48)
fighter(cid,'spin','Rotazione coi pugni','Mangler.gd','SPECIAL_720_PUNCH_SHEET',49,7,48)
for ident,key,count in [('drums','SUPER_START_SHEET',25),('drums-rotate','SUPER_ROTATE_RUN_SHEET',25),('drums-run','SUPER_RUN_ONLY_SHEET',24),('drums-roll','SUPER_DRUM_ROLL_SHEET',24)]:
    fighter(cid,ident,{'drums':'Super · Preparazione','drums-rotate':'Super · Bacchette','drums-run':'Super · Corsa','drums-roll':'Super · Rullata'}[ident],'Mangler.gd',key,count,5,48)
sheet(cid,'cymbal-projectile','Piatti della batteria','ManglerSonicProjectile.gd','SHEET',25,5,48,cell=256,scale=[.82,.82])
read('ManglerAnimationCatalog.gd');read('ManglerVisualConfig.gd')
data['characters'].append(dict(id=cid,name='Mangler',moves=[
    move('cymbals','Lancio dei piatti della batteria',['cymbal-projectile'],spawnFrame=22,speeds=[520,676,832],offset=[113,-156.5],lifetime=3),
    move('spin','Rotazione coi pugni',speed=75),
    move('drums','Corsa con le bacchette e rullata',phases=['drums','drums-rotate','drums-run','drums-roll'],kind='Super',auraFrame=18,moveFrame=19,speed=480,stopDistance=130,loops=2,hitFrames=[4,10,16,22])]))

cid='oscare'
fighter(cid,'cigarette-light','Accensione sigaretta','Oscare.gd','LIGHT_CIGARETTE_SHEET',20,7,60)
fighter(cid,'cigarette','Lancio sigaretta','Oscare.gd','FLICK_SHEET',29,7,60,indices=[19 if i==18 else i for i in range(29)])
fighter(cid,'smoke','Fumata bianca','Oscare.gd','SMOKE_SHEET',49,7,60)
sheet(cid,'cigarette-projectile','Sigaretta','OscareCigaretteProjectile.gd','SHEET',25,5,60,scale=[.24,.24])
sheet(cid,'smoke-projectile','Fumo bianco','OscareSmokeBreathProjectile.gd','SHEET',26,7,60,scale=[.7,.7])
data['characters'].append(dict(id=cid,name='Oscare',moves=[
    move('cigarette','Lancio sigaretta',['cigarette-projectile'],['cigarette-light','cigarette'],spawnFrame=18,speeds=[520,720,920],hand=[390,142],lifetime=3),
    move('smoke','Fumata bianca',['smoke-projectile'],['cigarette-light','smoke'],spawnFrame=20,outlet=[23,256],mouthFrames=[0,16,18,20,24,28,32,36,40,43,45,48],mouthPositions=[[284,120],[285,118],[289,123],[307,146],[333,161],[341,164],[342,164],[342,164],[336,159],[305,146],[293,130],[283,119]])]))

cid='torpe'
for ident,key,title,fps in [('bottle','BEER_FRAMES','Lancio della bottiglia',64),('welding','WELDING_FRAMES','Saldatura',60)]:
    relative=constant('Torpe.gd',key);text=(source/relative).read_text(encoding='utf-8-sig')
    folder=root/'assets/specials'/cid;folder.mkdir(parents=True,exist_ok=True);shutil.copy2(source/relative,folder/Path(relative).name)
    texture=re.search(r'path="res://([^"]+\.png)"',text)[1]
    regions={i:[int(float(x)) for x in values.split(',')] for i,values in re.findall(r'\[sub_resource type="AtlasTexture" id="([^"]+)"\].*?region = Rect2\(([^)]+)\)',text,re.S)}
    sequence=re.findall(r'"duration": ([\d.]+), "texture": SubResource\("([^"]+)"\)',text)
    idle=next(a for c in roster['characters'] if c['id']==cid for a in c['animations'] if a['id']=='idle')
    a=add(cid,ident,title,texture,len(sequence),8,fps,rects=[regions[i] for _,i in sequence],weights=[float(w) for w,_ in sequence],
        scale=idle['sourceTransform']['scale'],position=idle['sourceTransform']['position'],fixes=[37,38] if ident=='bottle' else None)
    a['sourceConfigPath']=relative;a['sourceConfigSha256']=hashlib.sha256((source/relative).read_bytes()).hexdigest();a['normalizedPreview']=dict(anchor=idle['normalizedPreview']['anchor'])
    a['sourceIndices']=[regions[i][1]//512*8+regions[i][0]//512 for _,i in sequence]
add(cid,'bottle-projectile','Bottiglia',constant('TorpeBeerBottleProjectile.gd','TEXTURE'),1,1,1,rects=[[320,51,389,1400]],scale=[1,1])
read('TorpeBeerShatter.gd');read('TorpeWeldingSparks.gd')
data['characters'].append(dict(id=cid,name='Torpe',alias='Macchia',moves=[
    move('bottle','Lancio della bottiglia',['bottle-projectile'],spawnFrame=37,speeds=[520,720,920],spins=[1.8,2.2,2.6],gravity=600,velocityY=-150,hand=[390,62],visibleLength=81.6,lifetime=3),
    move('welding','Saldatura',spawnFrame=42,endFrame=63,rates=[600,1000,1400],amounts=[60,100,140],reach=300,speed=1040,gravity=850,
         torchFrames=[42,45,48,51,55,58,62,63],torchPositions=[[348,141],[347,136],[350,132],[352,134],[346,135],[350,133],[350,133],[347,139]])]))

cid='mileto'
fighter(cid,'shoulder','Spallata','Mileto.gd','SHOULDER_SHEET',40,8,48)
fighter(cid,'guitar-windup','Materializzazione chitarra','Mileto.gd','GUITAR_WINDUP_SHEET',45,8,100)
fighter(cid,'guitar','Lancio chitarra','Mileto.gd','GUITAR_THROW_SHEET',23,8,60)
sheet(cid,'guitar-projectile','Chitarra elettrica','MiletoGuitarProjectile.gd','SHEET',25,5,100,cell=256,scale=[2,2],position=[12,16])
read('MiletoShoulderAura.gd');read('MiletoGuitarExplosion.gd')
data['characters'].append(dict(id=cid,name='Mileto',moves=[
    move('shoulder','Spallata',spawnFrame=12,holdFrame=30,speeds=[800,1100,1400],stopDistance=95),
    move('guitar','Lancio chitarra',['guitar-projectile'],['guitar-windup','guitar'],spawnFrame=20,speeds=[600,800,1000],offset=[118,-170],lifetime=3)]))

cid='bue'
fighter(cid,'summon','Evocazione elettrica','Bue.gd','SUMMON_SHEET',30,7,60)
for singer,file,prefix,count,y,hits in [('tom','BueSingerProjectile.gd','',30,-158,[15,28,41]),('baglioni','BueBaglioniProjectile.gd','BAGLIONI_',28,-150,[23,35,40])]:
    ids=[]
    for phase,n,fps,key in [('materialize',count,60,'MATERIALIZE'),('run',49,48,'RUN'),('slaps',49,60,'SLAPS')]:
        ident=singer+'-'+phase;ids.append(ident)
        sheet(cid,ident,('Tom Waits' if singer=='tom' else 'Claudio Baglioni')+' · '+phase,file,prefix+key,n,7,fps,scale=[.85,.85],position=[0,y])
    data['parameters'][singer]=dict(spawnFrame=9,speed=480,offset=[170,26],previewOffsetY=-20,hitFrames=hits,exitOnLastStrike=singer=='tom',contact=130)
data['characters'].append(dict(id=cid,name='Bue',moves=[dict(id=s,name=n,kind='Special',phases=['summon'],projectiles=[s+'-'+p for p in ['materialize','run','slaps']]) for s,n in [('baglioni','Claudio Baglioni'),('tom','Tom Waits')]]))

data['sourceScripts'] += list(scripts.values())
(root/'assets/specials/manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'specials-catalog.js').write_text('// Generato dagli importatori Special Godot.\n(function(root){const data='+json.dumps(data,ensure_ascii=False,indent=2)+';if(typeof module==="object"&&module.exports)module.exports=data;else root.SPECIALS_CATALOG=data;})(typeof globalThis!=="undefined"?globalThis:this);\n',encoding='utf-8')
for character in data['characters'][1:]:
    rows=[]
    for a in data['animations']:
        if a.get('characterId')!=character['id']:continue
        rows.append(f'<tr><th>{html.escape(a["name"])}</th><td>{len(a["frames"])}</td><td>{a["playbackFps"]:g}</td><td>{a["durationMs"]:.2f} ms</td><td><a href="../{a["image"]}">PNG</a></td><td>{html.escape(a["frameFallbackNote"])}</td></tr>')
    params={m['id']:data['parameters'][m['id']] for m in character['moves']}
    report='<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+character['name']+' · Special e Super</title><style>body{background:#141815;color:#eff3eb;font:15px/1.6 system-ui;padding:28px}main{max-width:1200px;margin:auto}a{color:#ceef80}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:12px;border-bottom:1px solid #3b493c}.scroll{overflow:auto}pre{white-space:pre-wrap}</style><main><a href="../specials.html?character='+character['id']+'">← Prova nello stage</a><h1>'+character['name']+' · Special e Super</h1><p>Macchia è Torpe. Sequenze e FPS del codice Godot, incluse le fasi preparatorie. Scala e centratura derivano dall’idle e dalle altezze del roster. Proiettili rialzati di 30 px nell’anteprima, con ulteriori 20 px per Baglioni e Tom Waits (50 px totali).</p><p>Simulazione visiva con bersaglio fermo: particelle, contatti e reazioni sono adattati al canvas; audio, danni e collisioni fisiche Godot non vengono eseguiti. Le mosse ravvicinate mostrano il loro raggio reale senza avvicinare artificialmente il bersaglio. Peirò escluso.</p><div class="scroll"><table><tr><th>Sequenza</th><th>Frame</th><th>FPS</th><th>Durata</th><th>Asset</th><th>Note</th></tr>'+''.join(rows)+'</table></div><h2>Parametri sorgente</h2><pre>'+html.escape(json.dumps(params,ensure_ascii=False,indent=2))+'</pre><a href="../assets/specials/manifest.json">Manifest con provenienza e hash sorgenti</a></main></html>'
    (root/'reports'/(character['id']+'-specials.html')).write_text(report,encoding='utf-8')
print('Special e Super: 6 personaggi, 14 mosse,',len(data['animations']),'sequenze. Macchia = Torpe.')
