"""Seleziona soltanto il pugno pesante a terra realmente usato in Godot."""
import re


def load_heavy_punch(source, ident, scene, code, shared, number, cell_size):
    custom = ident in ('arianna','mangler')
    meta = dict(loop=False,sourceLoop=False)
    if custom:
        prefix = 'ARIANNA_STRONG_PUNCH' if ident=='arianna' else 'HEAVY_PUNCH_HIGH'
        relative = re.search(r'const '+prefix+r'_SHEET\s*:=\s*preload\(\s*"res://([^"]+)"',code)[1]
        count = int(number(code,prefix+'_FRAME_COUNT'))
        columns = int(number(code,prefix+'_COLUMNS'))
        fw,fh = cell_size(code,prefix+'_CELL_SIZE')
        config = 'scripts/'+scene+'AnimationCatalog.gd'
        catalog = (source/config).read_text(encoding='utf-8-sig')
        function = 'strong_punch' if ident=='arianna' else 'heavy_punch_high'
        setup = re.search(r'func configure_'+function+r'_frames\(\).*?(?=\nfunc |\Z)',catalog,re.S)[0]
        runtime = 'arianna_strong_punch' if ident=='arianna' else 'heavy_punch'
        fps = float(re.search(r'set_animation_speed\(&"'+runtime+r'",\s*([\d.]+)',setup)[1])
        indices = list(range(count))
        if ident=='mangler':
            reverse = re.search(r'for source_index in range\((\d+),\s*(\d+),\s*-1\):',setup)
            indices += list(range(int(reverse[1]),int(reverse[2]),-1))
            meta['playbackComposition'] = 'godot-forward-with-partial-reverse'
    else:
        resource = re.search(r'^strong_punch_sheet = ExtResource\("([^"]+)"\)',code,re.M)[1]
        relative = re.search(r'path="res://([^"]+)" id="'+re.escape(resource)+'"',code)[1]
        count = int(number(code,'strong_punch_frame_count',shared))
        columns = int(number(code,'strong_punch_columns',shared))
        fw,fh = 512,512
        fps = number(code,'strong_punch_fps',shared)
        indices = list(range(count))
        runtime,config = 'strong_punch','scripts/IdleRosterFighter.gd'
    meta.update(sourceAnimation=runtime,sourceSetupPath=config,sourceFrameIndices=indices,
                frameDurations=[1000/fps]*len(indices),durationMs=len(indices)*1000/fps)
    frames = [[i%columns*fw,i//columns*fh,fw,fh] for i in indices]
    if ident=='mangler':
        # Godot passa allo stato idle dopo il recupero parziale. La demo rende
        # esplicita quella transizione con una posa terminale senza durata.
        frames.append(list(frames[0]))
        meta.update(sourceAnimationFrameCount=len(indices),terminalIdleAdded=True)
    return relative,frames,fps,meta
