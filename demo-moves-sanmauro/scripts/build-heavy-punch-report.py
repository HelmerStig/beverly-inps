"""Rigenera timing e report del pugno leggero dagli asset locali."""
import csv
import html
import json
from pathlib import Path
from PIL import Image
from heavy_punch_timing import apply_heavy_punch_timing

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
config=json.loads((root/'assets/heavy-punch-timing.json').read_text(encoding='utf-8'))
apply_heavy_punch_timing(data,config)
(root/'assets/manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'catalog.js').write_text('// Generato dai manifest locali Sanmauro.\nwindow.SANMAURO_CATALOG = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
report=root/'reports';poses=report/'heavy-punch-poses';poses.mkdir(parents=True,exist_ok=True)
rows,records=[],[]
for c in data['characters']:
    a=next(a for a in c['animations'] if a['id']=='heavy-punch')
    count=len(a['frames']);samples=[0,a["impactFrame"],count-1]
    triptych=Image.new('RGBA',(1536,512));dx,dy,dw,dh=a['preview']['drawRect']
    with Image.open(root/a['image']) as sheet:
        for column,index in enumerate(samples):
            x,y,w,h=a['frames'][index]
            pose=sheet.crop((x,y,x+w,y+h)).convert('RGBA').resize((round(dw),round(dh)),Image.Resampling.NEAREST)
            cell=Image.new('RGBA',(512,512));cell.alpha_composite(pose,(round(dx),round(dy)))
            triptych.alpha_composite(cell,(column*512,0))
    triptych.save(poses/(c['id']+'.png'))
    note=('Mangler: 49 frame + recupero Godot 40-20 (70 frame), poi posa idle terminale. Scala 0.85.' if c['id']=='mangler' else
          'Sequenza completa Godot, con ritorno già presente nello spritesheet.')
    name=html.escape(c['name'])
    rows.append(f'<tr data-character="{c["id"]}"><th scope="row">{name}</th><td><img src="heavy-punch-poses/{c["id"]}.png" width="288" height="96" alt="Ingresso, massima estensione e fine del pugno di {name}" loading="lazy"><small>Frame {samples[0]+1} / {samples[1]+1} / {samples[2]+1}</small></td><td>{count}</td><td><b>{a["durationMs"]} ms</b></td><td><b>{a["impactMs"]} ms</b><small>Frame {a["impactFrame"]+1} (indice {a["impactFrame"]})</small></td><td>{a["playbackFps"]:g}</td><td>{a["sourceFps"]:g}</td><td>{html.escape(note)}</td></tr>')
    records.append([c['name'],count,a['durationMs'],a['impactMs'],a['impactFrame'],a['playbackFps'],a['sourceFps'],a['sourceDurationMs'],a['sourcePath'],a['sourceSha256'],note])
with (report/'heavy-punch-timing.csv').open('w',encoding='utf-8-sig',newline='') as output:
    writer=csv.writer(output);writer.writerow(['Personaggio','Frame','Durata demo ms','Estensione ms','Frame estensione indice 0','FPS medi demo','FPS Godot','Durata Godot ms','Fonte','SHA256 PNG','Note']);writer.writerows(records)
page='''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Timing Pugno pesante · Sanmauro Fighters</title><style>body{margin:0;padding:32px;background:#141815;color:#eff3eb;font:15px/1.6 system-ui}main{max-width:1250px;margin:auto}a,b{color:#ceef80}p{max-width:1050px;color:#bbc7b9}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:12px;border-bottom:1px solid #3b493c}thead th{background:#273329;white-space:nowrap}img{image-rendering:pixelated;background:#232923;max-width:none}small{display:block;color:#aab5a8}@media print{body{background:white;color:black;padding:0}a,b{color:black}}</style></head><body><main><a href="../mosse.html?move=heavy-punch">← Apri Pugno pesante</a><h1>Timing Pugno pesante</h1>'''
page+='<p>Tutti i sette personaggi eseguono la sequenza in <b>1000 ms (1 s)</b> a velocità 1×. La massima estensione inizia a <b>500 ms (0,5 s)</b>. I frame prima dell’estensione dividono 500 ms; quelli successivi dividono i restanti 500 ms. L’idle finale è una posa terminale a 1000 ms e non aggiunge durata. Gli FPS indicati sono la media del ciclo.</p>'
page+='<p>Le pose mostrano ingresso, massima estensione e idle finale. Il frame di estensione inizia a 500 ms; la posa finale viene raggiunta esattamente a 1000 ms, senza aggiungere una pausa al ciclo. Con Loop si riparte dal primo frame; disattivandolo resta visibile la posa finale. Mangler usa heavy_punch da moves/00-heavy_punch_high.png: 49 frame e recupero parziale inverso 40-20. La transizione allo stato idle di Godot viene rappresentata con la posa iniziale al termine, senza durata aggiuntiva. Il pugno arriva al bordo destro del PNG originale: nessun ulteriore ritaglio viene applicato dalla demo.</p>'
page+='<p>Frame, pixel, proporzioni in centimetri e correzioni Godot sono conservati. “Riproduci tutte” riallinea anche i cicli successivi e i caricamenti progressivi; a 0,5× dura 2 s, a 2× dura 0,5 s. I timing Godot originali restano nel manifest.</p>'
page+='<p>Per Bue, Mileto, Oscare, Peirò e Torpe viene letto esattamente il campo strong_punch_sheet delle scene Godot, distinto da jump_strong_punch_sheet. Le pose sono quelle del pugno pesante a terra.</p>'
page+='<p><a href="heavy-punch-timing.csv" download>Scarica CSV</a> · <a href="../assets/heavy-punch-timing.json">Configurazione timing</a></p><div class="table-wrap"><table><thead><tr><th>Personaggio</th><th>Ingresso / estensione / fine</th><th>Frame</th><th>Durata</th><th>Massima estensione</th><th>FPS medi demo</th><th>FPS Godot</th><th>Note</th></tr></thead><tbody>'
page+=''.join(rows)+'</tbody></table></div></main></body></html>'
(report/'heavy-punch-timing.html').write_text(page,encoding='utf-8')
print('Report Pugno pesante: HTML, CSV e 7 confronti di pose; estensione a 500 ms e durata comune 1000 ms.')
import subprocess
import sys
if (root/'assets/remaining-moves-source.json').exists():
    subprocess.run([sys.executable,str(root/'scripts/build-remaining-reports.py')],check=True)
