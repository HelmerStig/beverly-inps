"""Copia le mosse di base, le tre parate, vittoria e KO dal vecchio progetto.
Uso: python demo-moves-sanmauro/scripts/import-roster.py F:/Personali/Godot
Richiede Pillow. Nessuna modifica al progetto sorgente.
"""
import hashlib
import json
from pathlib import Path
import re
import shutil
import statistics
import sys
import subprocess
import runpy
from PIL import Image
from jump_timing import apply_timing
from guard_timing import apply_guard_timing
from hurt_timing import apply_hurt_timing
from crouch_timing import apply_crouch_timing
from light_punch_timing import apply_light_punch_timing
from medium_punch_assets import load_medium_punch
from medium_punch_timing import apply_medium_punch_timing
from heavy_punch_assets import load_heavy_punch
from heavy_punch_timing import apply_heavy_punch_timing
from remaining_moves import import_remaining
from character_proportions import apply_proportions, write_portraits

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('F:/Personali/Godot')
roster = [
    ('arianna', 'Arianna', 'Arianna'), ('bue', 'Bue', 'Bue'),
    ('mangler', 'Mangler', 'Mangler'), ('mileto', 'Mileto', 'Mileto'),
    ('oscare', 'Oscare', 'Oscare'), ('peirolo', 'Peirò', 'Peirolo'),
    ('torpe', 'Torpe', 'Torpe'),
]
characters = []
shared = (source / 'scripts' / 'IdleRosterFighter.gd').read_text(encoding='utf-8-sig')


def number(code, key, fallback=None):
    match = re.search(r'\b' + re.escape(key) + r'\s*(?::=|=)\s*(\d+(?:\.\d+)?)', code)
    if match:
        return float(match[1])
    if fallback is not None:
        return number(fallback, key)
    raise ValueError(f'Parametro non trovato: {key}')


def vector(code, key, fallback=None):
    match = re.search(r'\b' + re.escape(key) + r'\s*(?::=|=)\s*Vector2\(([^)]+)\)', code)
    if match:
        return tuple(float(v.strip()) for v in match[1].split(','))
    if fallback is not None:
        return vector(fallback, key)
    raise ValueError(f'Dimensioni cella non trovate: {key}')


def cell_size(code, key, fallback=None):
    return tuple(int(v) for v in vector(code, key, fallback))


def source_transform(ident, move, code):
    if ident == 'mangler':
        # update_sprite_scale: walk/ko/hurt sono legacy, le altre mosse reworked.
        prefix = 'LEGACY_SPRITE' if move in ('walk','ko') or (move.startswith('hurt-') and move!='hurt-crouched') else 'REWORK_SPRITE'
        return dict(scale=vector(code, prefix + '_SCALE'), position=vector(code, prefix + '_POSITION'))
    if ident == 'arianna':
        return dict(scale=vector(code, 'ARIANNA_SPRITE_SCALE'), position=vector(code, 'ARIANNA_SPRITE_POSITION'))
    scale = vector(code, 'sprite_scale', shared)
    position = vector(code, 'sprite_position', shared)
    if not any(scale):
        scale = vector(code, 'idle_sprite_scale', shared)
    if not any(position):
        position = vector(code, 'idle_sprite_position', shared)
    return dict(scale=scale, position=position)


def mangler_resource_animation(move):
    """Legge le animazioni mantenute nella risorsa .tres della scena."""
    scene_path = 'scenes/Mangler.tscn'
    scene_code = (source / scene_path).read_text(encoding='utf-8-sig')
    resource_id = re.search(r'sprite_frames = ExtResource\("([^"]+)"\)', scene_code)[1]
    resource_path = re.search(r'path="res://([^"]+)" id="' + re.escape(resource_id) + '"', scene_code)[1]
    resource = (source / resource_path).read_text(encoding='utf-8-sig')
    records = re.finditer(r'"frames":\s*\[(.*?)\],\s*"loop":\s*(\w+),\s*"name":\s*&?"([^"]+)",\s*"speed":\s*([\d.]+)', resource, re.S)
    record = next(r for r in records if r[3] == move)
    frames, weights, sheets = [], [], set()
    for entry in re.finditer(r'"duration":\s*([\d.]+),\s*"texture":\s*SubResource\("([^"]+)"\)', record[1]):
        block = re.search(r'\[sub_resource type="AtlasTexture" id="' + re.escape(entry[2]) + r'"\](.*?)(?=\n\[|\Z)', resource, re.S)[1]
        rect = re.search(r'region = Rect2\(([^)]+)\)', block)[1]
        frames.append([int(float(v.strip())) for v in rect.split(',')])
        weights.append(float(entry[1]))
        texture_id = re.search(r'atlas = ExtResource\("([^"]+)"\)', block)[1]
        sheets.add(re.search(r'path="res://([^"]+)" id="' + re.escape(texture_id) + '"', resource)[1])
    if not frames or len(sheets) != 1:
        raise ValueError('Risorsa Mangler non supportata: '+move)
    return sheets.pop(), frames, weights, float(record[4]), resource_path


for ident, name, scene in roster:
    custom = ident in ('arianna', 'mangler')
    config_path = ('scripts/' + scene + '.gd') if custom else ('scenes/' + scene + '.tscn')
    code = (source / config_path).read_text(encoding='utf-8-sig')
    destination = root / 'assets' / 'characters' / ident
    destination.mkdir(parents=True, exist_ok=True)
    animations = []
    for move, label in [('idle', 'Idle'), ('walk', 'Camminata'), ('jump', 'Salto'), ('crouch','Accovacciata'),
            ('block-high','Parata alta'),('block-mid','Parata media'),('block-low','Parata bassa'),
            ('hurt-high','Hurt alto'),('hurt-medium','Hurt medio'),('hurt-low','Hurt basso'),
            ('hurt-crouched','Hurt accovacciato'),
            ('victory','Vittoria'), ('ko','Sconfitta'), ('light-punch','Pugno leggero'), ('medium-punch','Pugno medio'), ('heavy-punch','Pugno pesante')]:
        start, explicit_frames, weights, jump_timing, skipped = 0, None, None, {}, []
        sheet_override = None
        animation_config_path = config_path
        if move=='heavy-punch':
            relative,explicit_frames,original_fps,jump_timing = load_heavy_punch(
                source,ident,scene,code,shared,number,cell_size)
            count=len(explicit_frames)
            fw,fh=explicit_frames[0][2:]
        elif move=='medium-punch':
            relative,sheet_override,explicit_frames,original_fps,jump_timing = load_medium_punch(
                source,destination,ident,scene,code,shared,number,cell_size)
            count=len(explicit_frames)
            fw,fh=explicit_frames[0][2:]
        elif move=='light-punch':
            if custom:
                prefix=('ARIANNA_' if ident=='arianna' else '')+'LIGHT_PUNCH'
                relative=re.search(r'const '+prefix+r'_SHEET\s*:=\s*preload\(\s*"res://([^"]+)"',code)[1]
                count=int(number(code,prefix+('_LAST_PLAYED_FRAME' if ident=='arianna' else '_FRAME_COUNT')))
                columns=int(number(code,prefix+'_COLUMNS'))
                fw,fh=cell_size(code,prefix+'_CELL_SIZE')
                catalog=(source/'scripts'/(scene+'AnimationCatalog.gd')).read_text(encoding='utf-8-sig')
                setup=re.search(r'func configure_light_punch_frames\(\).*?(?=\nfunc |\Z)',catalog,re.S)[0]
                original_fps=float(re.search(r'set_animation_speed\([^,]+,\s*([\d.]+)',setup)[1])
                indices=list(range(count))
                if ident=='arianna':
                    # Eccezione richiesta: andata fino all'ultimo frame, poi ritorno
                    # inverso fino all'idle, senza duplicare il frame di estensione.
                    indices+=list(range(count-2,-1,-1))
                runtime_move='arianna_light_punch' if ident=='arianna' else 'light_punch_single'
            else:
                resource_id=re.search(r'^light_punch_sheet = ExtResource\("([^"]+)"\)',code,re.M)[1]
                relative=re.search(r'path="res://([^"]+)" id="'+re.escape(resource_id)+'"',code)[1]
                setup=re.search(r'_add_sheet_animation\(frames, &"light_punch", light_punch_sheet,\s*(\d+),\s*(\d+),\s*Vector2\(([^)]+)\),\s*([\d.]+)',shared)
                count,columns=int(setup[1]),int(setup[2])
                fw,fh=[int(float(v.strip())) for v in setup[3].split(',')]
                original_fps=float(setup[4])
                recovery=re.search(r'for source_index in range\((\d+),\s*-1,\s*-1\):',shared[setup.end():])[1]
                indices=list(range(count))+list(range(int(recovery),-1,-1))
                runtime_move='light_punch'
            explicit_frames=[[i%columns*fw,i//columns*fh,fw,fh] for i in indices]
            durations=[1000/original_fps]*len(indices)
            jump_timing=dict(loop=False,sourceLoop=False,sourceAnimation=runtime_move,
                sourceSetupPath='scripts/'+(scene+'AnimationCatalog.gd' if custom else 'IdleRosterFighter.gd'),
                frameDurations=durations,durationMs=sum(durations))
            if ident=='arianna':
                jump_timing.update(sourceForwardFrameCount=count,sourceRecoveryAnimation='arianna_light_punch_recovery',
                    playbackComposition='forward-then-reverse-without-repeated-peak')
        elif move=='hurt-crouched':
            animation_config_path='scenes/'+scene+'.tscn'
            scene_code=(source/animation_config_path).read_text(encoding='utf-8-sig')
            resource_id=re.search(r'hurt_crouched_sheet = ExtResource\("([^"]+)"\)',scene_code)[1]
            relative=re.search(r'path="res://([^"]+)" id="'+re.escape(resource_id)+'"',scene_code)[1]
            fighter_code=(source/'scripts/Fighter.gd').read_text(encoding='utf-8-sig')
            setup=re.search(r'func _configure_hurt_crouched_animation\(\).*?(?=\nfunc |\Z)',fighter_code,re.S)[0]
            count=int(re.search(r'for source in (\d+):',setup)[1])
            columns=int(re.search(r'source % (\d+)',setup)[1])
            rectangle=re.search(r'region = Rect2\(\(source % \d+\) \* (\d+), int\(source / \d+\) \* (\d+), (\d+), (\d+)\)',setup)
            fw,fh=int(rectangle[3]),int(rectangle[4])
            original_fps=float(re.search(r'set_animation_speed\(&"hurt_crouched",\s*([\d.]+)',setup)[1])
            durations=[1000/original_fps]*count
            jump_timing=dict(loop=False,sourceLoop=False,sourceAnimation='hurt_crouched',sourceSetupPath='scripts/Fighter.gd',
                frameDurations=durations,durationMs=sum(durations),reactionDurationMs=sum(durations))
        elif move.startswith('hurt-'):
            part = move.split('-')[1]
            runtime_move = 'hurt_mid' if part == 'medium' else move.replace('-','_')
            if ident == 'mangler':
                relative,explicit_frames,weights,original_fps,animation_config_path = mangler_resource_animation(runtime_move)
                count = len(explicit_frames)
                fw,fh = explicit_frames[0][2:]
            else:
                if ident == 'arianna':
                    prefix = 'ARIANNA_HURT_'+part.upper()
                    relative = re.search(r'const '+prefix+r'_SHEET\s*:=\s*preload\(\s*"res://([^"]+)"',code)[1]
                    count = int(number(code,prefix+('_SOURCE_FRAME_COUNT' if part=='medium' else '_FRAME_COUNT')))
                    columns = int(number(code,prefix+'_COLUMNS'))
                    fw,fh = cell_size(code,prefix+'_CELL_SIZE')
                    indices = list(range(count))+list(range(count-2,-1,-1)) if part=='medium' else list(range(count))+[0]
                    catalog=(source/'scripts/AriannaAnimationCatalog.gd').read_text(encoding='utf-8-sig')
                    function=re.search(r'func configure_hurt_'+part+r'_frames\(\).*?(?=\nfunc |\Z)',catalog,re.S)[0]
                    original_fps=float(re.search(r'set_animation_speed\(&"'+runtime_move+r'",\s*([\d.]+)',function)[1])
                else:
                    field='hurt_'+part
                    resource_id=re.search(field+r'_sheet = ExtResource\("([^"]+)"\)',code)[1]
                    relative=re.search(r'path="res://([^"]+)" id="'+re.escape(resource_id)+'"',code)[1]
                    if part=='low':
                        setup=re.search(r'_add_sheet_animation\(frames, &"hurt_low", hurt_low_sheet,\s*(\d+),\s*(\d+),',shared)
                        count,columns=int(setup[1]),int(setup[2]);fw,fh=512,512
                    else:
                        count=int(number(code,field+'_frame_count',shared))
                        columns=int(number(code,field+'_columns',shared))
                        fw,fh=cell_size(code,field+'_cell_size',shared)
                    original_fps=number(shared,'HURT_FPS')
                    indices=list(range(count))
                explicit_frames=[[i%columns*fw,i//columns*fh,fw,fh] for i in indices]
                count=len(explicit_frames)
            durations=[(weights[i] if weights else 1)*1000/original_fps for i in range(count)]
            jump_timing=dict(loop=False,sourceLoop=False,sourceAnimation=runtime_move,
                frameDurations=durations,durationMs=sum(durations),reactionDurationMs=sum(durations))
        elif move.startswith('block-'):
            part = move.split('-')[1]
            runtime_move = move.replace('-','_')
            if custom:
                suffix = 'MIDDLE' if ident == 'arianna' and part == 'mid' else part.upper()
                prefix = ('ARIANNA_GUARD_' if ident == 'arianna' else 'BLOCK_') + suffix
                relative = re.search(r'const ' + prefix + r'_SHEET\s*:=\s*preload\(\s*"res://([^"]+)"',code)[1]
                count = int(number(code,prefix+'_FRAME_COUNT'))
                columns = int(number(code,prefix+'_COLUMNS'))
                fw,fh = cell_size(code,prefix+'_CELL_SIZE')
                catalog = (source/'scripts'/(scene+'AnimationCatalog.gd')).read_text(encoding='utf-8-sig')
                function = re.search(r'func configure_'+runtime_move+r'_frames\(\).*?(?=\nfunc |\Z)',catalog,re.S)[0]
                original_fps = float(re.search(r'set_animation_speed\(animation_name,\s*([\d.]+)',function)[1])
                start_match = re.search(r'range\((\d+),\s*fighter\.',function)
                if start_match:
                    start = int(start_match[1])
                    count -= start
            else:
                field = {'high':'block','mid':'block_medium','low':'block_low'}[part]
                resource_id = re.search(field+r'_sheet = ExtResource\("([^"]+)"\)',code)[1]
                relative = re.search(r'path="res://([^"]+)" id="'+re.escape(resource_id)+'"',code)[1]
                if part == 'mid':
                    setup = re.search(r'_add_sheet_animation\(frames, &"block_mid", block_medium_sheet,\s*(\d+),\s*(\d+),\s*Vector2\(([^)]+)\),\s*([\d.]+)',shared)
                    count,columns = int(setup[1]),int(setup[2])
                    fw,fh = [int(float(v.strip())) for v in setup[3].split(',')]
                    original_fps = float(setup[4])
                else:
                    count = int(number(code,field+'_frame_count',shared))
                    columns = int(number(code,field+'_columns',shared))
                    fw,fh = cell_size(code,field+'_cell_size',shared)
                    original_fps = number(shared,'BLOCK_LOW_FPS' if part == 'low' else 'BLOCK_FPS')
            jump_timing = dict(loop=False,sourceLoop=False,sourceAnimation=runtime_move)
        elif ident == 'mangler' and move in ('jump','ko'):
            relative, explicit_frames, weights, original_fps, animation_config_path = mangler_resource_animation(move)
            count = len(explicit_frames)
            fw, fh = explicit_frames[0][2:]
            if move == 'jump':
                takeoff = int(number(code, 'JUMP_TAKEOFF_FRAME'))
        elif custom:
            prefix = ('ARIANNA_' if ident == 'arianna' else '') + move.upper()
            relative = re.search(r'const ' + prefix + r'_SHEET\s*:=\s*preload\(\s*"res://([^"]+)"', code)[1]
            count = int(number(code, prefix + '_FRAME_COUNT'))
            columns = int(number(code, prefix + '_COLUMNS'))
            fw, fh = cell_size(code, prefix + '_CELL_SIZE')
            catalog = (source / 'scripts' / (scene + 'AnimationCatalog.gd')).read_text(encoding='utf-8-sig')
            function = re.search(r'func configure_' + move + r'_frames\(\).*?(?=\nfunc |\Z)', catalog, re.S)[0]
            if move == 'jump':
                original_fps = number(code, prefix + '_FPS')
                takeoff = int(number(code, prefix + '_TAKEOFF_FRAME'))
            else:
                speed = re.search(r'set_animation_speed\(&"' + move + r'",\s*([\d.]+)', function)
                if not speed and move=='crouch':
                    speed=re.search(r'set_animation_speed\(animation_name,\s*([\d.]+)',function)
                if speed:
                    original_fps = float(speed[1])
                else:
                    helper = re.search(r'func configure_full_atlas_animation\(.*?(?=\nfunc |\Z)',catalog,re.S)[0]
                    original_fps = float(re.search(r'set_animation_speed\(animation_name,\s*([\d.]+)',helper)[1])
            if ident == 'mangler' and move == 'victory':
                exclusion = re.search(r'if source_index in \[([^\]]+)\]:\s*continue',function)
                if exclusion:
                    skipped = [int(v.strip()) for v in exclusion[1].split(',')]
        else:
            field = 'death' if move == 'ko' else move
            resource_id = re.search(field + r'_sheet = ExtResource\("([^"]+)"\)', code)[1]
            relative = re.search(r'path="res://([^"]+)" id="' + re.escape(resource_id) + '"', code)[1]
            if move == 'jump':
                start = int(number(code, 'jump_start_frame', shared)) - 1
                count = int(number(code, 'jump_idle_frame', shared)) - start - 1
                takeoff = int(number(code, 'jump_takeoff_frame', shared)) - start - 1
            elif move == 'ko':
                ko_setup = re.search(r'_add_sheet_animation\(frames, &"ko", death_sheet,\s*(\d+),\s*(\d+),',shared)
                count,columns = int(ko_setup[1]),int(ko_setup[2])
            else:
                count = int(number(code, move + '_frame_count', shared))
            if move != 'ko':
                columns = int(number(code, move + '_columns', shared))
            fw, fh = cell_size(code, move + '_cell_size', shared) if move not in ('victory','ko') else (512,512)
            original_fps = number(shared, move.upper() + '_FPS')
        sheet = sheet_override or source / relative
        frames = explicit_frames if explicit_frames is not None else [[i % columns * fw, i // columns * fh, fw, fh] for i in range(start, start+count) if i not in skipped]
        count = len(frames)
        if move=='crouch':
            jump_timing=dict(loop=False,sourceLoop=False,sourceAnimation='crouch')
        if move in ('victory','ko'):
            jump_timing = dict(loop=False,sourceLoop=False,sourceSkippedFrames=skipped)
            if weights and any(weight != 1 for weight in weights):
                durations = [weight*1000/original_fps for weight in weights]
                jump_timing.update(frameDurations=durations,durationMs=sum(durations))
        if move == 'jump':
            # Fighter.configure_jump_startup_timing comprime solo la preparazione.
            fighter_code = (source / 'scripts/Fighter.gd').read_text(encoding='utf-8-sig')
            startup = re.search(r'const JUMP_STARTUP_SECONDS\s*:=\s*([\d.]+)\s*/\s*([\d.]+)', fighter_code)
            startup_ms = float(startup[1]) / float(startup[2]) * 1000
            durations = [(weights[i] if weights else 1) * 1000/original_fps for i in range(count)]
            if takeoff <= 0 or takeoff >= count:
                raise ValueError(f'Stacco fuori sequenza: {ident}')
            durations[:takeoff] = [startup_ms/takeoff] * takeoff
            jump_timing = dict(frameDurations=durations, durationMs=sum(durations),
                takeoffFrame=takeoff, takeoffMs=startup_ms, sourceLoop=False)
        with Image.open(sheet) as image:
            width, height = image.size
            if any(x+w > width or y+h > height for x, y, w, h in frames):
                raise ValueError(f'Spritesheet incompatibile: {sheet}')
            bounds = []
            for x, y, w, h in frames:
                alpha = image.crop((x, y, x+w, y+h)).convert('RGBA').getchannel('A')
                bbox = alpha.point(lambda value: 255 if value >= 32 else 0).getbbox()
                if bbox is None:
                    raise ValueError(f'Frame vuoto: {sheet}, ({x}, {y})')
                bounds.append(bbox)
            union = [min(b[0] for b in bounds), min(b[1] for b in bounds), max(b[2] for b in bounds), max(b[3] for b in bounds)]
        if sheet.resolve() != (destination / (move + '.png')).resolve():
            shutil.copy2(sheet, destination / (move + '.png'))
        animations.append(dict(id=move, name=label, image=f'assets/characters/{ident}/{move}.png',
            frameWidth=fw, frameHeight=fh, frames=frames, playbackFps=original_fps if move in ('jump','crouch','light-punch') or move.startswith(('block-','hurt-')) else 24,
            sourceFps=original_fps, sheetWidth=width, sheetHeight=height,
            sourcePath=relative, sourceConfigPath=animation_config_path,
            sourceTransform=source_transform(ident, move, code),
            contentBounds=union, medianContentHeight=statistics.median(b[3]-b[1] for b in bounds),
            trimmed=bool(skipped) or start>0 or 'trimmed' in sheet.name.lower(),
            sourceSha256=hashlib.sha256(sheet.read_bytes()).hexdigest(), **jump_timing))
    # Un solo fattore per personaggio conserva le proporzioni Godot fra le mosse.
    # Ancoraggi fissi sull'intero ciclo: nessun auto-fit per singolo frame.
    target_height, center_x, ground_y = 344, 256, 430
    idle = animations[0]
    factor = target_height / (idle['medianContentHeight'] * idle['sourceTransform']['scale'][1])
    for animation in animations:
        sx, sy = [v * factor for v in animation['sourceTransform']['scale']]
        left, top, right, bottom = animation['contentBounds']
        anchor_x, anchor_y = (left + right) / 2, bottom
        rect = [center_x-anchor_x*sx, ground_y-anchor_y*sy,
                animation['frameWidth']*sx, animation['frameHeight']*sy]
        animation['preview'] = dict(drawRect=rect, anchor=[anchor_x, anchor_y],
            scale=[sx, sy], centerX=center_x, groundY=ground_y, targetIdleHeight=target_height)
    characters.append(dict(id=ident, name=name,
        thumbnail=f'assets/characters/{ident}/portrait.png',
        animations=animations))
data = dict(schema='sanmauro.roster', version=1, characters=characters)
apply_proportions(data, json.loads((root/'assets/character-proportions.json').read_text(encoding='utf-8')))
write_portraits(root, data)
runpy.run_path(str(root/'scripts/import-portraits.py'))['import_portraits'](root,source,data)
timing_path = root / 'assets/jump-timing.json'
if timing_path.exists():
    apply_timing(data, json.loads(timing_path.read_text(encoding='utf-8')))
apply_guard_timing(data,json.loads((root/'assets/guard-timing.json').read_text(encoding='utf-8')))
apply_hurt_timing(data,json.loads((root/'assets/hurt-timing.json').read_text(encoding='utf-8')))
apply_crouch_timing(data,json.loads((root/'assets/crouch-timing.json').read_text(encoding='utf-8')))
apply_light_punch_timing(data,json.loads((root/'assets/light-punch-timing.json').read_text(encoding='utf-8')))
apply_medium_punch_timing(data,json.loads((root/'assets/medium-punch-timing.json').read_text(encoding='utf-8')))
apply_heavy_punch_timing(data,json.loads((root/'assets/heavy-punch-timing.json').read_text(encoding='utf-8')))
if (root/'assets/remaining-moves-source.json').exists():
    import_remaining(root,source,data)
(root / 'assets' / 'manifest.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(root / 'catalog.js').write_text('// Generato da scripts/import-roster.py.\nwindow.SANMAURO_CATALOG = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
print(f'Copiate {sum(len(c["animations"]) for c in characters)} animazioni e {len(characters)} anteprime in {root / "assets"}')
if (root / 'scripts/build-stages.py').exists():
    subprocess.run([sys.executable, str(root / 'scripts/build-stages.py')], check=True)
elif timing_path.exists():
    subprocess.run([sys.executable, str(root / 'scripts/build-jump-report.py')], check=True)
if (root/'assets/specials/arianna/specials.json').exists():
    subprocess.run([sys.executable,str(root/'scripts/import-specials.py'),str(source)],check=True)
