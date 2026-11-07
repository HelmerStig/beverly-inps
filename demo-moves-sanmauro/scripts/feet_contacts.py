"""Punti di appoggio dalla sagoma alpha, senza modificare i pixel sorgenti."""
from PIL import Image


def extract_contacts(root, animation):
    split=round(animation.get('normalizedPreview',animation['preview'])['anchor'][0])
    result=[]
    with Image.open(root/animation['image']) as sheet:
        sheet=sheet.convert('RGBA')
        for x,y,w,h in animation['frames']:
            alpha=sheet.crop((x,y,x+w,y+h)).getchannel('A').point(lambda a:255 if a>64 else 0)
            bbox=alpha.getbbox()
            if not bbox:
                result.append(result[-1] if result else [])
                continue
            low=int(bbox[1]+(bbox[3]-bbox[1])*.7)
            feet=[]
            for left,right in [(0,split),(split,w)]:
                box=alpha.crop((left,low,right,h)).getbbox()
                if not box:continue
                bottom=low+box[3]-1
                sole=alpha.crop((left,max(0,bottom-2),right,bottom+1)).getbbox()
                shoe=alpha.crop((left,max(0,bottom-7),right,bottom+1)).getbbox()
                feet.append(dict(x=round(left+(sole[0]+sole[2])/2,2),y=bottom+1,width=shoe[2]-shoe[0]))
            result.append(feet)
    return result
