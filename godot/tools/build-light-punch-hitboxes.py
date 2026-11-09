"""Fit reviewed fist capsules to the impact and first recovery frame. Pillow only."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
attack=sys.argv[1] if len(sys.argv)>1 else 'light-punch'
if attack not in ['light-punch','medium-punch','heavy-punch','light-kick','medium-kick','heavy-kick','crouched-light-punch','crouched-medium-punch','crouched-heavy-punch']: raise ValueError('Unsupported attack')
roster=json.loads((ROOT/'data/debug-roster.json').read_text(encoding='utf-8'))
seeds=json.loads((ROOT/f'data/{attack}-hitbox-seeds.json').read_text(encoding='utf-8'))
out={'schema':f'sanmauro.{attack}-hitboxes','version':1,'characters':{}}
for c in roster['characters']:
    a=c['animations'][attack]; peak=a['impactFrame']; seed=seeds['characters'][c['id']]
    source=ROOT/a['image']; digest=hashlib.sha256(source.read_bytes()).hexdigest()
    if digest!=a['sourceSha256']: raise ValueError('Changed punch PNG: '+c['id'])
    sheet=Image.open(source).convert('RGBA')
    frames=[sheet.crop((x,y,x+w,y+h)) for x,y,w,h in a['frames']]
    ax,ay,bx,by,r=seed
    bounds=(min(ax,bx)-r-4,min(ay,by)-r-4,max(ax,bx)+r+5,max(ay,by)+r+5)
    ref=frames[peak].crop(bounds)
    result=[None]*len(frames)
    for index in [peak,peak+1]:
        if index>=len(frames): continue
        dx=dy=0
        if index!=peak:
            def score(x,y):
                sample=frames[index].crop((bounds[0]+x,bounds[1]+y,bounds[2]+x,bounds[3]+y))
                diff=ImageStat.Stat(ImageChops.difference(ref,sample)).mean
                return sum(diff[:3])/3+diff[3]*0.8+(x*x+y*y)*0.006
            _,dx,dy=min((score(x,y),x,y) for y in range(-48,49,4) for x in range(-64,65,4))
            _,dx,dy=min((score(x,y),x,y) for y in range(dy-2,dy+3) for x in range(dx-2,dx+3))
        extension=seeds.get("forwardExtensionPixels",0)
        forward=seeds.get("characterForwardOffsets",{}).get(c["id"],0)
        result[index]=[ax+dx+forward,ay+dy,bx+dx+extension+forward,by+dy,r+(2 if extension else 0)]
    start=sum(a['frameDurations'][:peak]); end=sum(a['frameDurations'][:peak+2])
    out['characters'][c['id']]={'sourceSha256':digest,'framesSha256':hashlib.sha256(json.dumps(a['frames'],separators=(',',':')).encode()).hexdigest(),
        'impactFrame':peak,'activeStartMs':start,'activeEndMs':end,'durationMs':a['durationMs'],'frames':result}
    preview=Image.new('RGB',(1024,540),(24,29,39))
    for col,index in enumerate([peak,peak+1]):
        frame=frames[index].copy(); d=ImageDraw.Draw(frame); x,y,u,v,r=result[index]
        d.line((x,y,u,v),fill=(255,65,80,220),width=round(r*2))
        for cx,cy in [(x,y),(u,v)]: d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=(255,65,80,255),width=2)
        preview.paste(frame,(col*512,24),frame)
        ImageDraw.Draw(preview).text((col*512+10,6),f'{c["id"]} frame {index}',fill='white')
    preview.save(ROOT/f'tests/artifacts/{attack}-hitbox-{c["id"]}.png')
    print(c['id'],f'{start:.2f}-{end:.2f} ms',flush=True)
(ROOT/f'data/{attack}-hitboxes.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
