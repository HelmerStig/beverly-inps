"""Applica i timing hurt e crea report e confronti di ingresso/centro/fine."""
import csv
import html
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image
from hurt_timing import apply_hurt_timing

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
config=json.loads((root/'assets/hurt-timing.json').read_text(encoding='utf-8'))
apply_hurt_timing(data,config)
(root/'assets/manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'catalog.js').write_text('// Generato dai manifest locali Sanmauro.\nwindow.SANMAURO_CATALOG = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
report=root/'reports'
for ident in config['animationIds']:
    rows,records=[],[]
    poses=report/(ident+'-poses');poses.mkdir(parents=True,exist_ok=True)
    for c in data['characters']:
        a=next(a for a in c['animations'] if a['id']==ident)
        count=len(a['frames']);samples=[0,count//2,count-1]
        triptych=Image.new('RGBA',(1536,512))
        dx,dy,dw,dh=a['preview']['drawRect']
        with Image.open(root/a['image']) as sheet:
            for column,index in enumerate(samples):
                x,y,w,h=a['frames'][index]
                pose=sheet.crop((x,y,x+w,y+h)).convert('RGBA').resize((round(dw),round(dh)),Image.Resampling.NEAREST)
                cell=Image.new('RGBA',(512,512));cell.alpha_composite(pose,(round(dx),round(dy)))
                triptych.alpha_composite(cell,(column*512,0))
        triptych.save(poses/(c['id']+'.png'))
        source=[y//h*(a['sheetWidth']//w)+x//w+1 for x,y,w,h in a['frames']]
        sequence=', '.join(str(i) for i in source)
        name=html.escape(c['name'])
        note='Sequenza sorgente: '+sequence+'.'
        if c['id']=='arianna' and ident!='hurt-crouched':note+=' Ritorno incluso nella sequenza Godot.'
        if c['id']=='mangler':note+=f' Scala Godot {a["sourceTransform"]["scale"][0]:g}; altezza 183 cm conservata.'
        rows.append(f'<tr data-character="{c["id"]}"><th scope="row">{name}</th><td><img src="{ident}-poses/{c["id"]}.png" width="288" height="96" alt="Ingresso, centro e fine di {name}" loading="lazy"><small>Frame {samples[0]+1} / {samples[1]+1} / {samples[2]+1}</small></td><td>{count}</td><td><b>{a["durationMs"]} ms</b></td><td>{a["playbackFps"]:g}</td><td>{a["sourceFps"]:g}</td><td>{html.escape(note)}</td></tr>')
        records.append([c['name'],count,a['durationMs'],a['playbackFps'],a['sourceFps'],a['sourceDurationMs'],sequence,a['sourcePath'],a['sourceSha256'],note])
    title=next(a['name'] for a in data['characters'][0]['animations'] if a['id']==ident)
    with (report/(ident+'-timing.csv')).open('w',encoding='utf-8-sig',newline='') as output:
        writer=csv.writer(output);writer.writerow(['Personaggio','Frame','Durata demo ms','FPS demo','FPS Godot','Durata Godot ms','Sequenza sorgente da 1','Fonte','SHA256 PNG','Note']);writer.writerows(records)
    page=f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Timing {title} · Sanmauro Fighters</title><style>body{{margin:0;padding:32px;background:#141815;color:#eff3eb;font:15px/1.6 system-ui}}main{{max-width:1500px;margin:auto}}a,b{{color:#ceef80}}p{{max-width:1050px;color:#bbc7b9}}.table-wrap{{overflow:auto}}table{{width:100%;border-collapse:collapse;font-size:13px}}th,td{{text-align:left;padding:12px;border-bottom:1px solid #3b493c}}thead th{{background:#273329;white-space:nowrap}}img{{image-rendering:pixelated;background:#232923;object-fit:contain;border-radius:8px;max-width:none}}small{{display:block;color:#aab5a8}}td:last-child{{min-width:250px}}@media print{{body{{background:white;color:black;padding:0}}a,b{{color:black}}}}</style></head><body><main><a href="../mosse.html?move={ident}">← Apri {title}</a><h1>Timing {title}</h1>'''
    page+='<p>Tutti i sette personaggi eseguono questa reazione in <b>500 ms (0,5 s)</b> a velocità 1×. FPS demo = numero frame × 2; ogni frame dura 500 / numero frame millisecondi, compreso l’ultimo.</p>'
    page+='<p>Le tre pose mostrano ingresso, frame centrale e fine: il frame centrale non è un marcatore di impatto sincronizzato. Sono conservati solo i ritorni già inclusi nella sequenza nominale Godot; non sono aggiunti i recovery separati.</p>'
    page+='<p>Senza Loop si mantiene la posa finale; con Loop il ciclo dura 500 ms. “Riproduci tutte” riallinea anche i cicli successivi e i caricamenti progressivi. A 0,5× dura 1 s; a 2× dura 0,25 s. Le sequenze, i PNG, le altezze, le scale e gli ancoraggi restano invariati. Le durate Godot sono conservate come provenienza nel manifest.</p>'
    page+=f'<p><a href="{ident}-timing.csv" download>Scarica CSV</a> · <a href="../assets/hurt-timing.json">Configurazione timing</a></p><div class="table-wrap"><table><thead><tr><th>Personaggio</th><th>Ingresso / centro / fine</th><th>Frame</th><th>Durata</th><th>FPS demo</th><th>FPS Godot</th><th>Sequenza e note</th></tr></thead><tbody>'
    page+=''.join(rows)+'</tbody></table></div></main></body></html>'
    (report/(ident+'-timing.html')).write_text(page,encoding='utf-8')
print(f'Report hurt: {len(config["animationIds"])} HTML/CSV e {len(config["animationIds"])*len(data["characters"])} confronti di pose; durata comune {config["durationMs"]} ms.')
if (root/'assets/crouch-timing.json').exists():
    subprocess.run([sys.executable,str(root/'scripts/build-crouch-report.py')],check=True)
