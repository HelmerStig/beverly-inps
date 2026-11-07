"""Altezze fisiche Sanmauro separate dalla normalizzazione degli spritesheet."""
import copy
import math


def positive(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def apply_proportions(data, config):
    if config.get('schema') != 'sanmauro.character-proportions' or config.get('version') != 1:
        raise ValueError('Schema proporzioni non valido')
    heights = config.get('heightsCm', {})
    if set(heights) != {c['id'] for c in data['characters']}:
        raise ValueError('Altezze roster incomplete')
    if not positive(config.get('referenceHeightCm')) or not positive(config.get('stageScale')):
        raise ValueError('Riferimento proporzioni non valido')
    if heights.get(config.get('referenceCharacterId')) != config['referenceHeightCm']:
        raise ValueError('Altezza del personaggio di riferimento incoerente')
    if not all(positive(height) for height in heights.values()):
        raise ValueError('Altezze non valide')
    for character in data['characters']:
        character['heightCm'] = heights[character['id']]
        character['stageHeightMultiplier'] = character['heightCm'] / config['referenceHeightCm']
        for animation in character['animations']:
            if 'normalizedPreview' not in animation:
                animation['normalizedPreview'] = copy.deepcopy(animation['preview'])
    # Un unico zoom per l'intero roster mantiene i rapporti in cm e contiene
    # tutti i frame, inclusi i salti, nel canvas comune senza tagli.
    view_scale = 1.0
    for character in data['characters']:
        for animation in character['animations']:
            base = animation['normalizedPreview']
            sx, sy = [v*character['stageHeightMultiplier'] for v in base['scale']]
            ax, ay = base['anchor']
            left, top, right, bottom = animation['contentBounds']
            for available, extent in [(base['centerX']-16,(ax-left)*sx),
                    (512-base['centerX']-16,(right-ax)*sx),
                    (base['groundY']-16,(ay-top)*sy)]:
                if extent > 0:
                    view_scale = min(view_scale,available/extent)
    for character in data['characters']:
        for animation in character['animations']:
            base = animation['normalizedPreview']
            sx, sy = [v*character['stageHeightMultiplier']*view_scale for v in base['scale']]
            ax, ay = base['anchor']
            preview = copy.deepcopy(base)
            preview.update(scale=[sx,sy],drawRect=[base['centerX']-ax*sx,
                base['groundY']-ay*sy,animation['frameWidth']*sx,animation['frameHeight']*sy],
                targetIdleHeight=base['targetIdleHeight']*character['stageHeightMultiplier']*view_scale,
                heightMultiplier=character['stageHeightMultiplier'],viewScale=view_scale)
            animation['preview'] = preview
    data['previewScale'] = view_scale
    data['characterProportions'] = copy.deepcopy(config)


def write_portraits(root, data):
    from PIL import Image
    for character in data['characters']:
        idle = next(a for a in character['animations'] if a['id']=='idle')
        x,y,w,h = idle['frames'][0]
        dx,dy,dw,dh = idle['preview']['drawRect']
        with Image.open(root/idle['image']) as sheet:
            pose = sheet.crop((x,y,x+w,y+h)).convert('RGBA')
            pose = pose.resize((round(dw),round(dh)),Image.Resampling.NEAREST)
        portrait = Image.new('RGBA',(512,512))
        portrait.alpha_composite(pose,(round(dx),round(dy)))
        portrait.save(root/character['thumbnail'])
