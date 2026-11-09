"""Generate pose-specific silhouette capsules for locomotion, without editing PNGs.
Idle retains the reviewed anatomical model. Locomotion uses adaptive horizontal
capsule bands so extended limbs and airborne poses cannot inherit idle geometry.
Requires Pillow. Coordinates are the original 512px cells.
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageStat

ROOT=Path(__file__).resolve().parents[1]
roster=json.loads((ROOT/'data/debug-roster.json').read_text(encoding='utf-8'))
out={'schema':'sanmauro.movement-hurtboxes','version':1,'method':'Alpha silhouette, adaptive capsule bands; idle anatomical model kept separately','characters':{}}
names=sys.argv[1:] or ['walk','backwalk','run','back-jump','jump','light-punch','hurt-high','block-high']
if sys.argv[1:] and (ROOT/'data/movement-hurtboxes.json').exists():
    out=json.loads((ROOT/'data/movement-hurtboxes.json').read_text(encoding='utf-8'))
artifacts=ROOT/'tests/artifacts'
artifacts.mkdir(parents=True,exist_ok=True)
cache={}

def runs(mask,y0,y1):
    # Opaque projection; opening suppresses 1px fringes without merging limbs.
    band=mask.crop((0,y0,512,y1))
    occupied=[band.crop((x,0,x+1,y1-y0)).getbbox() is not None for x in range(512)]
    result=[]; begin=None
    for x,on in enumerate(occupied+[False]):
        if on and begin is None: begin=x
        if not on and begin is not None:
            if x-begin>=5: result.append((begin,x))
            begin=None
    return result

def capsule_coverage(mask,box):
    ax,ay,bx,by,r=box
    x0=max(0,int(ax-r)); x1=min(512,int(bx+r)+1)
    y0=max(0,int(ay-r)); y1=min(512,int(ay+r)+1)
    shape=Image.new('L',(x1-x0,y1-y0)); d=ImageDraw.Draw(shape)
    d.line((ax-x0,ay-y0,bx-x0,by-y0),fill=255,width=max(1,round(r*2)))
    for x,y in [(ax,ay),(bx,by)]: d.ellipse((x-x0-r,y-y0-r,x-x0+r,y-y0+r),fill=255)
    return ImageStat.Stat(mask.crop((x0,y0,x1,y1)),shape).mean[0]/255.0

def build(frame):
    mask=frame.getchannel('A').point(lambda a:255 if a>=96 else 0)
    mask=mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    bbox=mask.getbbox()
    if not bbox: raise ValueError('Empty animation frame')
    boxes=[]
    def band(top,bottom,depth=0):
        for left,right in runs(mask,top,bottom):
            radius=min((bottom-top)/2.0,(right-left)/2.0)
            cy=(top+bottom)/2.0
            box=[left+radius,cy,right-radius,cy,radius]
            if capsule_coverage(mask,box)<0.8 and depth==0 and bottom-top>=12:
                mid=(top+bottom)//2
                # Recompute this whole band once, preserving separate leg gaps.
                band(top,mid,1); band(mid,bottom,1)
                return
        for left,right in runs(mask,top,bottom):
            radius=min((bottom-top)/2.0,(right-left)/2.0)
            if radius<2: continue
            cy=(top+bottom)/2.0
            zone='head' if cy<bbox[1]+(bbox[3]-bbox[1])*0.19 else 'body'
            boxes.append({'id':f'{zone}_band_{len(boxes):02d}','capsule':[left+radius,cy,right-radius,cy,radius]})
    for top in range(bbox[1],bbox[3],20): band(top,min(top+20,bbox[3]))
    return boxes

for c in roster['characters']:
    out['characters'].setdefault(c['id'],{})
    for name in names:
        a=c['animations'][name]; source=ROOT/a['image']
        digest=hashlib.sha256(source.read_bytes()).hexdigest()
        if digest!=a['sourceSha256']: raise ValueError('Stale asset: '+c['id']+'/'+name)
        sheet=Image.open(source).convert('RGBA'); frames=[]
        for rect in a['frames']:
            key=(digest,tuple(rect))
            if key not in cache:
                x,y,w,h=rect; cache[key]=build(sheet.crop((x,y,x+w,y+h)))
            frames.append(cache[key])
        out['characters'][c['id']][name]={'sourceSha256':digest,'framesSha256':hashlib.sha256(json.dumps(a['frames'],separators=(',',':')).encode()).hexdigest(),'frames':frames}
        preview=Image.new('RGB',(1536,540),(24,29,39))
        for col,index in enumerate([0,len(frames)//2,len(frames)-1]):
            x,y,w,h=a['frames'][index]; frame=sheet.crop((x,y,x+w,y+h))
            overlay=Image.new('RGBA',frame.size); d=ImageDraw.Draw(overlay)
            for part in frames[index]:
                ax,ay,bx,by,r=part['capsule']; color=(255,210,70,110) if part['id'].startswith('head') else (65,230,160,100)
                d.line((ax,ay,bx,by),fill=color,width=max(1,round(r*2)))
                for px,py in [(ax,ay),(bx,by)]: d.ellipse((px-r,py-r,px+r,py+r),fill=color)
            frame.alpha_composite(overlay); preview.paste(frame,(col*512,24),frame)
            ImageDraw.Draw(preview).text((col*512+12,5),f'{c["id"]} {name} frame {index}',fill='white')
        preview.save(artifacts/f'hurtboxes-{c["id"]}-{name}.png')
        print(c['id'],name,len(frames),'frames; max',max(map(len,frames)),'capsules',flush=True)
(ROOT/'data/movement-hurtboxes.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
