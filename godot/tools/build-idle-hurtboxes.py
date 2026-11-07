"""Fit hand-reviewed anatomical capsules to each idle frame using local image registration.
Requires Pillow. Does not modify source PNGs. Run from any directory.
"""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat

ROOT = Path(__file__).resolve().parents[1]
seeds = json.loads((ROOT / 'data/idle-hurtbox-seeds.json').read_text(encoding='utf-8'))
roster = json.loads((ROOT / 'data/debug-roster.json').read_text(encoding='utf-8'))
output = {'schema': 'sanmauro.idle-hurtboxes', 'version': 1,
          'coordinates': 'Unscaled 512px sprite cell; independent capsules per frame',
          'method': 'Reviewed anatomical seeds + bounded per-part RGBA registration; no attack hitboxes',
          'characters': {}}

def capsule_mask(size, box, origin=(0, 0)):
    ax, ay, bx, by, r = box
    ax -= origin[0]; bx -= origin[0]; ay -= origin[1]; by -= origin[1]
    mask = Image.new('L', size)
    d = ImageDraw.Draw(mask)
    d.line((ax, ay, bx, by), fill=255, width=round(r * 2))
    for x, y in [(ax, ay), (bx, by)]:
        d.ellipse((x-r,y-r,x+r,y+r),fill=255)
    return mask

for character in roster['characters']:
    ident, idle = character['id'], character['idle']
    file = ROOT / idle['image']
    digest = hashlib.sha256(file.read_bytes()).hexdigest()
    if digest != idle['sourceSha256']:
        raise ValueError('Spritesheet changed; review anatomy: ' + ident)
    sheet = Image.open(file).convert('RGBA')
    frames = [sheet.crop((x,y,x+w,y+h)) for x,y,w,h in idle['frames']]
    # RGBA diff includes opaque body color and alpha; ignore hidden RGB values.
    samples = []
    for frame in frames:
        black = Image.new('RGBA',frame.size,(0,0,0,255))
        black.alpha_composite(frame)
        samples.append(Image.merge('LA',(black.convert('L'),frame.getchannel('A'))))
    fitted = []
    for frame_index, frame in enumerate(frames):
        parts = []
        for part, seed in zip(seeds['parts'], seeds['characters'][ident]):
            ax,ay,bx,by,r = seed
            bounds = (math.floor(min(ax,bx)-r-2),math.floor(min(ay,by)-r-2),
                      math.ceil(max(ax,bx)+r+2),math.ceil(max(ay,by)+r+2))
            reference = samples[0].crop(bounds)
            mask = capsule_mask(reference.size,seed,bounds[:2])
            def score(dx,dy):
                shifted = samples[frame_index].crop(tuple(v+(dx if i%2==0 else dy) for i,v in enumerate(bounds)))
                diff = ImageChops.difference(reference,shifted)
                stats = ImageStat.Stat(diff,mask)
                return stats.mean[0]+stats.mean[1]*0.45+(dx*dx+dy*dy)*0.025
            dx = dy = 0
            if frame_index:
                _,dx,dy = min((score(x,y),x,y) for y in range(-12,13,4) for x in range(-12,13,4))
                _,dx,dy = min((score(x,y),x,y) for y in range(max(-12,dy-3),min(12,dy+3)+1)
                             for x in range(max(-12,dx-3),min(12,dx+3)+1))
            box = [ax+dx,ay+dy,bx+dx,by+dy,r]
            if frame_index and any(word in part for word in ['arm','thigh','shin']):
                # Joints move independently: translation alone cannot follow a bent elbow.
                endpoints = []
                for px,py in [(ax,ay),(bx,by)]:
                    span = round(r+8)
                    roi = (px-span,py-span,px+span+1,py+span+1)
                    patch = samples[0].crop(roi)
                    def joint_score(x,y):
                        candidate = samples[frame_index].crop((roi[0]+x,roi[1]+y,roi[2]+x,roi[3]+y))
                        stats = ImageStat.Stat(ImageChops.difference(patch,candidate))
                        return stats.mean[0]+stats.mean[1]*0.6+(x*x+y*y)*0.008
                    _,jx,jy = min((joint_score(x,y),x,y) for y in range(-28,29,4) for x in range(-28,29,4))
                    _,jx,jy = min((joint_score(x,y),x,y) for y in range(jy-2,jy+3) for x in range(jx-2,jx+3))
                    endpoints.extend([px+jx,py+jy])
                box = endpoints+[r]
            parts.append({'id':part,'capsule':box})
        fitted.append(parts)
    output['characters'][ident] = {'animation':'idle','sourceSha256':digest,
        'framesSha256':hashlib.sha256(json.dumps(idle['frames'],separators=(',',':')).encode()).hexdigest(),
        'fps':idle['playbackFps'],'frames':fitted}
    # QA: first, middle and last frames with exact generated capsules.
    preview = Image.new('RGB',(1536,540),(24,29,39))
    for column,index in enumerate([0,len(frames)//2,len(frames)-1]):
        canvas = frames[index].copy()
        overlay = Image.new('RGBA',canvas.size)
        for item in fitted[index]:
            ax,ay,bx,by,r = item['capsule']
            color=(65,230,160,65) if item['id']!='head' else (255,210,70,80)
            mask = capsule_mask(canvas.size,item['capsule'])
            ink=Image.new('RGBA',canvas.size,color)
            overlay.alpha_composite(Image.composite(ink,Image.new('RGBA',canvas.size),mask))
        canvas.alpha_composite(overlay)
        preview.paste(canvas,(column*512,24),canvas)
        ImageDraw.Draw(preview).text((column*512+12,5),f'{ident} - frame {index}',fill='white')
    artifacts = ROOT/'tests/artifacts'
    artifacts.mkdir(parents=True,exist_ok=True)
    preview.save(artifacts/f'hurtboxes-{ident}.png')
    print(f'{ident}: {len(frames)} frames, {len(seeds["parts"])} capsules/frame')

(ROOT/'data/idle-hurtboxes.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
