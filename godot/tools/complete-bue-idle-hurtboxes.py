"""Complete Bue idle from the ten manually reviewed frames; preserve all other overrides."""
import json, math, hashlib
from pathlib import Path
from PIL import Image, ImageChops, ImageStat, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'data/manual-hurtboxes.json'
manual=json.loads(path.read_text(encoding='utf-8-sig'))
before=json.loads(json.dumps(manual))
character=next(c for c in json.loads((ROOT/'data/debug-roster.json').read_text())['characters'] if c['id']=='bue')
a=character['idle']
assert hashlib.sha256((ROOT/a['image']).read_bytes()).hexdigest()==a['sourceSha256']
sheet=Image.open(ROOT/a['image']).convert('RGBA')
frames=[sheet.crop((x,y,x+w,y+h)) for x,y,w,h in a['frames']]
base=json.loads((ROOT/'data/idle-hurtboxes.json').read_text())['characters']['bue']['frames']
refs=[manual[f'bue/idle/{i}'] for i in range(10)]
samples=[]
for f in frames:
    bg=Image.new('RGBA',f.size,(0,0,0,255)); bg.alpha_composite(f)
    samples.append(Image.merge('LA',(bg.convert('L'),f.getchannel('A'))))
small=[s.resize((128,128)) for s in samples]

def fit_joint(ref,target,p,prior,r):
    span=round(r+7)
    roi=(round(p[0])-span,round(p[1])-span,round(p[0])+span+1,round(p[1])+span+1)
    patch=samples[ref].crop(roi)
    def score(dx,dy):
        candidate=samples[target].crop((roi[0]+dx,roi[1]+dy,roi[2]+dx,roi[3]+dy))
        stat=ImageStat.Stat(ImageChops.difference(patch,candidate))
        return stat.mean[0]+stat.mean[1]*0.65+0.012*((dx-prior[0])**2+(dy-prior[1])**2)
    cx,cy=map(round,prior)
    _,dx,dy=min((score(x,y),x,y) for y in range(cy-24,cy+25,4) for x in range(cx-24,cx+25,4))
    _,dx,dy=min((score(x,y),x,y) for y in range(dy-3,dy+4) for x in range(dx-3,dx+4))
    return [p[0]+dx,p[1]+dy]

added=[]
for index in range(10,len(frames)):
    key=f'bue/idle/{index}'
    if key in manual: continue
    ref=min(range(10),key=lambda j:sum(ImageStat.Stat(ImageChops.difference(small[j],small[index])).mean))
    parts=[]
    for n,part in enumerate(refs[ref]):
        cap=part['capsule']; original=base[ref][n]['capsule']; dest=base[index][n]['capsule']
        points=[]
        for end in range(2):
            p=cap[end*2:end*2+2]
            prior=[dest[end*2+k]-original[end*2+k] for k in range(2)]
            points.append(fit_joint(ref,index,p,prior,cap[4]))
        # Head and trunk retain the reviewed shape; only their center tracks the pose.
        if part['id'] in ['head','torso']:
            dx=sum(points[k][0]-cap[2*k] for k in range(2))/2
            dy=sum(points[k][1]-cap[2*k+1] for k in range(2))/2
            points=[[cap[0]+dx,cap[1]+dy],[cap[2]+dx,cap[3]+dy]]
        parts.append({'id':part['id'],'capsule':[round(v,3) for p in points for v in p]+[cap[4]]})
    manual[key]=parts; added.append(index)
    print(f'Frame {index+1}: reference {ref+1}',flush=True)
assert all(manual[k]==v for k,v in before.items())
assert len(added) in (0,53), 'Expected exactly fifty-three unfinished idle frames; refusing partial/repeated generation'
path.write_text(json.dumps(manual,ensure_ascii=False,indent='\t')+'\n',encoding='utf-8')
# All frames for visual review, grouped into ten-frame contact sheets.
out=ROOT/'tests/artifacts'; out.mkdir(exist_ok=True)
for start in range(0,len(frames),10):
    preview=Image.new('RGB',(5*300,2*325),(24,29,39))
    for offset,index in enumerate(range(start,min(start+10,len(frames)))):
        canvas=frames[index].copy(); overlay=Image.new('RGBA',canvas.size); d=ImageDraw.Draw(overlay)
        for part in manual[f'bue/idle/{index}']:
            ax,ay,bx,by,r=part['capsule']; color=(255,210,70,125) if part['id']=='head' else (65,230,160,100)
            d.line((ax,ay,bx,by),fill=color,width=max(1,round(r*2)))
            for x,y in [(ax,ay),(bx,by)]: d.ellipse((x-r,y-r,x+r,y+r),fill=color)
            angle=math.atan2(by-ay,bx-ax)
            outline=[(bx+math.cos(angle-math.pi/2+k*math.pi/12)*r,by+math.sin(angle-math.pi/2+k*math.pi/12)*r) for k in range(13)]+[(ax+math.cos(angle+math.pi/2+k*math.pi/12)*r,ay+math.sin(angle+math.pi/2+k*math.pi/12)*r) for k in range(13)]
            d.line(outline+[outline[0]],fill=color[:3]+(240,),width=2)
        canvas.alpha_composite(overlay); canvas=canvas.resize((300,300))
        x=(offset%5)*300; y=(offset//5)*325
        preview.paste(canvas,(x,y+25),canvas)
        ImageDraw.Draw(preview).text((x+10,y+7),f'Bue idle {index+1}'+(' manual' if index<10 else ' fitted'),fill='white')
    preview.save(out/f'bue-idle-uniform-{start+1:02}.png')
print(f'Preserved every existing override; completed {len(added)} Bue idle frames.')



