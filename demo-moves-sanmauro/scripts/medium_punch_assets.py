"""Legge il pugno medio effettivamente assegnato in Godot, incluse le tre fasi Mangler."""
import hashlib
import re
import shutil
from PIL import Image


def load_medium_punch(source, destination, ident, scene, code, shared, number, cell_size):
    custom = ident in ('arianna', 'mangler')
    meta = dict(loop=False, sourceLoop=False,
                sourceSetupPath='scripts/' + (scene+'AnimationCatalog.gd' if custom else 'IdleRosterFighter.gd'))
    if ident == 'mangler':
        catalog = (source/meta['sourceSetupPath']).read_text(encoding='utf-8-sig')
        setup = re.search(r'func configure_medium_punch_frames\(\).*?(?=\nfunc |\Z)', catalog, re.S)[0]
        parts = re.findall(r'atlas_frame.atlas = fighter\.(MEDIUM_PUNCH_\w+)_SHEET', setup)
        if parts != ['MEDIUM_PUNCH_PREPARATION', 'MEDIUM_PUNCH_HIT', 'MEDIUM_PUNCH_TO_IDLE']:
            raise ValueError('Rivedere le fasi Godot del pugno medio Mangler')
        columns = int(number(code, 'MEDIUM_PUNCH_COLUMNS'))
        fw, fh = cell_size(code, 'MEDIUM_PUNCH_CELL_SIZE')
        fps = float(re.search(r'set_animation_speed\(&"medium_open_hand_slap",\s*([\d.]+)', setup)[1])
        cells, sources = [], []
        for prefix in parts:
            path = re.search(r'const '+prefix+r'_SHEET\s*:=\s*preload\(\s*"res://([^"]+)"', code)[1]
            count = int(number(code, prefix+'_FRAME_COUNT'))
            local = 'medium-punch-'+prefix.removeprefix('MEDIUM_PUNCH_').lower().replace('_','-')+'.png'
            shutil.copy2(source/path, destination/local)
            rects = [[i%columns*fw, i//columns*fh, fw, fh] for i in range(count)]
            with Image.open(source/path) as sheet:
                for x,y,w,h in rects:
                    if x+w>sheet.width or y+h>sheet.height:
                        raise ValueError('Frame Mangler fuori spritesheet: '+path)
                    cells.append(sheet.crop((x,y,x+w,y+h)).convert('RGBA'))
            sources.append(dict(sourcePath=path, image=str((destination/local).relative_to(destination.parents[2])).replace('\\','/'),
                                sourceSha256=hashlib.sha256((source/path).read_bytes()).hexdigest(), frames=rects))
        atlas = Image.new('RGBA', (columns*fw, ((len(cells)+columns-1)//columns)*fh))
        for i,cell in enumerate(cells):
            atlas.paste(cell, (i%columns*fw, i//columns*fh))
        atlas_path = destination/'medium-punch.png'
        atlas.save(atlas_path)
        meta.update(sourceAnimation='medium_open_hand_slap', sourceSheets=sources,
                    derivedAtlas=True, playbackComposition='preparation-hit-to-idle')
        frames = [[i%columns*fw,i//columns*fh,fw,fh] for i in range(len(cells))]
        return sources[0]['sourcePath'], atlas_path, frames, fps, meta
    if custom:
        prefix = 'ARIANNA_MEDIUM_PUNCH'
        relative = re.search(r'const '+prefix+r'_SHEET\s*:=\s*preload\(\s*"res://([^"]+)"', code)[1]
        count, columns = int(number(code,prefix+'_FRAME_COUNT')), int(number(code,prefix+'_COLUMNS'))
        fw, fh = cell_size(code,prefix+'_CELL_SIZE')
        catalog = (source/meta['sourceSetupPath']).read_text(encoding='utf-8-sig')
        setup = re.search(r'func configure_medium_punch_frames\(\).*?(?=\nfunc |\Z)', catalog,re.S)[0]
        fps = float(re.search(r'set_animation_speed\(animation_name,\s*([\d.]+)',setup)[1])
        reverse_fps = fps
        meta['sourceAnimation'] = 'arianna_medium_punch'
    else:
        resource = re.search(r'^medium_punch_sheet = ExtResource\("([^"]+)"\)', code,re.M)[1]
        relative = re.search(r'path="res://([^"]+)" id="'+re.escape(resource)+'"',code)[1]
        count, columns = int(number(code,'medium_punch_frame_count',shared)), int(number(code,'medium_punch_columns',shared))
        fw, fh = 512,512
        fps, reverse_fps = number(code,'medium_punch_fps',shared), number(code,'medium_punch_reverse_fps',shared)
        meta['sourceAnimation'] = 'medium_punch'
    indices = list(range(count))
    durations = [1000/fps]*count
    if reverse_fps > 0:
        indices += list(range(count-2,-1,-1))
        durations += [1000/reverse_fps]*(count-1)
        meta.update(sourceRecoveryAnimation=meta['sourceAnimation']+'_recovery',
                    sourceForwardFrameCount=count, playbackComposition='forward-then-reverse-without-repeated-peak')
    meta.update(frameDurations=durations, durationMs=sum(durations), sourceReverseFps=reverse_fps)
    return relative, source/relative, [[i%columns*fw,i//columns*fh,fw,fh] for i in indices], fps, meta
