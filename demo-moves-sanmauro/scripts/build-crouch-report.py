"""Rigenera timing e report dell'accovacciata usando soltanto gli asset locali."""
import csv
import html
import json
from pathlib import Path
from PIL import Image
from crouch_timing import apply_crouch_timing

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
config=json.loads((root/'assets/crouch-timing.json').read_text(encoding='utf-8'))
apply_crouch_timing(data,config)
(root/'assets/manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'catalog.js').write_text('// Generato dai manifest locali Sanmauro.\nwindow.SANMAURO_CATALOG = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
report=root/'reports';poses=report/'crouch-poses';poses.mkdir(parents=True,exist_ok=True)
rows,records=[],[]
for c in data['characters']:
    a=next(a for a in c['animations'] if a['id']=='crouch')
    count=len(a['frames']);samples=[0,count//2,count-1]
    triptych=Image.new('RGBA',(1536,512));dx,dy,dw,dh=a['preview']['drawRect']
    with Image.open(root/a['image']) as sheet:
        for column,index in enumerate(samples):
            x,y,w,h=a['frames'][index]
            pose=sheet.crop((x,y,x+w,y+h)).convert('RGBA').resize((round(dw),round(dh)),Image.Resampling.NEAREST)
            cell=Image.new('RGBA',(512,512));cell.alpha_composite(pose,(round(dx),round(dy)))
            triptych.alpha_composite(cell,(column*512,0))
    triptych.save(poses/(c['id']+'.png'))
    note='Mangler: scala reworked 0.85, senza recupero inverso.' if c['id']=='mangler' else 'Ingresso in accovacciata; recupero separato.'
    name=html.escape(c['name'])
    rows.append(f'<tr data-character="{c["id"]}"><th scope="row">{name}</th><td><img src="crouch-poses/{c["id"]}.png" width="288" height="96" alt="Ingresso, centro e posa accovacciata di {name}" loading="lazy"><small>Frame {samples[0]+1} / {samples[1]+1} / {samples[2]+1}</small></td><td>{count}</td><td><b>{a["durationMs"]} ms</b></td><td>{a["playbackFps"]:g}</td><td>{a["sourceFps"]:g}</td><td>{html.escape(note)}</td></tr>')
    records.append([c['name'],count,a['durationMs'],a['playbackFps'],a['sourceFps'],a['sourceDurationMs'],a['sourcePath'],a['sourceSha256'],note])
with (report/'crouch-timing.csv').open('w',encoding='utf-8-sig',newline='') as output:
    writer=csv.writer(output);writer.writerow(['Personaggio','Frame','Durata demo ms','FPS demo','FPS Godot','Durata Godot ms','Fonte','SHA256 PNG','Note']);writer.writerows(records)
page='''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Timing Accovacciata · Sanmauro Fighters</title><style>body{margin:0;padding:32px;background:#141815;color:#eff3eb;font:15px/1.6 system-ui}main{max-width:1250px;margin:auto}a,b{color:#ceef80}p{max-width:1050px;color:#bbc7b9}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:12px;border-bottom:1px solid #3b493c}thead th{background:#273329;white-space:nowrap}img{image-rendering:pixelated;background:#232923;max-width:none}small{display:block;color:#aab5a8}@media print{body{background:white;color:black;padding:0}a,b{color:black}}</style></head><body><main><a href="../mosse.html?move=crouch">← Apri Accovacciata</a><h1>Timing Accovacciata</h1>'''
page+='<p>Tutti i sette personaggi eseguono la sequenza in <b>250 ms (0,25 s)</b> a velocità 1×. FPS demo = numero frame × 4; ciascun frame dura 250 / numero frame ms, incluso l’ultimo.</p>'
page+='<p>Le pose mostrano ingresso, frame centrale e accovacciata finale. Senza Loop la posa finale resta visibile al termine; con Loop il ciclo dura 250 ms. La posa finale inizia un intervallo prima della fine; la durata indicata comprende l’intera sequenza. La rialzata inversa non è concatenata.</p>'
page+='<p>Frame, pixel, proporzioni in centimetri e correzioni Godot sono conservati. La postura bassa non viene ingrandita per compensarne l’altezza. “Riproduci tutte” riallinea anche i cicli successivi e i caricamenti progressivi; a 0,5× dura 0,5 s, a 2× dura 0,125 s. I timing Godot originali restano nel manifest.</p>'
page+='<p><a href="crouch-timing.csv" download>Scarica CSV</a> · <a href="../assets/crouch-timing.json">Configurazione timing</a></p><div class="table-wrap"><table><thead><tr><th>Personaggio</th><th>Ingresso / centro / fine</th><th>Frame</th><th>Durata</th><th>FPS demo</th><th>FPS Godot</th><th>Note</th></tr></thead><tbody>'
page+=''.join(rows)+'</tbody></table></div></main></body></html>'
(report/'crouch-timing.html').write_text(page,encoding='utf-8')
print('Report Accovacciata: HTML, CSV e 7 confronti di pose; durata comune 250 ms.')

import subprocess
import sys
subprocess.run([sys.executable,str(root/"scripts/build-light-punch-report.py")],check=True)
