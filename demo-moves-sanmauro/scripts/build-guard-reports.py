"""Rigenera timing e report delle tre parate dagli asset locali."""
import csv
import html
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image
from guard_timing import apply_guard_timing

root = Path(__file__).resolve().parents[1]
data = json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
config = json.loads((root/'assets/guard-timing.json').read_text(encoding='utf-8'))
apply_guard_timing(data,config)
(root/'assets/manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'catalog.js').write_text('// Generato dai manifest locali Sanmauro.\nwindow.SANMAURO_CATALOG = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
report = root/'reports'
for ident in config['animationIds']:
    rows,records = [],[]
    poses = report/(ident+'-poses')
    poses.mkdir(parents=True,exist_ok=True)
    for c in data['characters']:
        a = next(a for a in c['animations'] if a['id']==ident)
        pose_index = a.get('sourceForwardFrameCount',len(a['frames']))-1
        x,y,w,h = a['frames'][pose_index]
        dx,dy,dw,dh = a['preview']['drawRect']
        with Image.open(root/a['image']) as sheet:
            pose = sheet.crop((x,y,x+w,y+h)).convert('RGBA').resize((round(dw),round(dh)),Image.Resampling.NEAREST)
            canvas = Image.new('RGBA',(512,512));canvas.alpha_composite(pose,(round(dx),round(dy)))
            canvas.save(poses/(c['id']+'.png'))
        count = len(a['frames'])
        final_ms = sum(a['frameDurations'][:pose_index])
        source = [rect[1]//h*(a['sheetWidth']//w)+rect[0]//w+1 for rect in a['frames']]
        note = 'Andata '+str(source[0])+'-'+str(source[pose_index])+', poi ritorno inverso fino a '+str(source[-1])+', senza duplicare il picco.'
        if c['id']=='mangler':
            note += ' Scala Godot 0.85; correzione e altezza 183 cm conservate.'
        name = html.escape(c['name'])
        rows.append(f'<tr data-character="{c["id"]}"><th scope="row">{name}</th><td><img src="{ident}-poses/{c["id"]}.png" width="128" height="128" alt="{html.escape(a["name"])} di {name}" loading="lazy"></td><td>{count}</td><td><b>{a["durationMs"]} ms</b></td><td>{a["playbackFps"]:g}</td><td>{a["sourceFps"]:g}</td><td>{final_ms:.2f} ms</td><td>{html.escape(note)}</td></tr>')
        records.append([c['name'],count,a['durationMs'],a['playbackFps'],a['sourceFps'],a['sourceDurationMs'],final_ms,a['sourcePath'],a['sourceSha256'],note])
    title = next(a['name'] for a in data['characters'][0]['animations'] if a['id']==ident)
    with (report/(ident+'-timing.csv')).open('w',encoding='utf-8-sig',newline='') as output:
        writer=csv.writer(output);writer.writerow(['Personaggio','Frame','Durata demo ms','FPS demo','FPS Godot','Durata Godot ms','Inizio posa di parata ms','Fonte','SHA256 PNG','Note']);writer.writerows(records)
    page = f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Timing {title} · Sanmauro Fighters</title><style>body{{margin:0;padding:32px;background:#141815;color:#eff3eb;font:15px/1.6 system-ui}}main{{max-width:1500px;margin:auto}}a,b{{color:#ceef80}}p{{max-width:1050px;color:#bbc7b9}}.table-wrap{{overflow:auto}}table{{width:100%;border-collapse:collapse;font-size:13px}}th,td{{text-align:left;padding:12px;border-bottom:1px solid #3b493c}}thead th{{background:#273329;white-space:nowrap}}img{{image-rendering:pixelated;background:#232923;object-fit:contain;border-radius:8px}}td:last-child{{min-width:240px}}@media print{{body{{background:white;color:black;padding:0}}a,b{{color:black}}img{{width:80px;height:80px}}}}</style></head><body><main><a href="../mosse.html?move={ident}">← Apri {title}</a><h1>Timing {title}</h1>'''
    page += '<p>Tutti i sette personaggi eseguono la sequenza in <b>500 ms (0,5 s)</b> a velocità 1×. FPS = numero di frame × 2; ogni frame mantiene la propria posizione nello spritesheet e dura 500 / numero di frame millisecondi.</p>'
    page += '<p>La durata comprende anche l’ultimo frame. Senza Loop resta visibile la posa iniziale dopo il ritorno; con Loop il ciclo dura 500 ms. L’inizio della posa di parata dipende dal numero di frame ed è riportato a parte: non è un impatto sincronizzato a 100 ms. Tutte le parate eseguono andata e ritorno inverso, senza duplicare il frame di picco.</p>'
    page += '<p>“Riproduci tutte” riallinea i player anche nei cicli successivi e con caricamento progressivo. A 0,5× la sequenza dura 1000 ms; a 2× dura 250 ms. PNG, tagli, altezze in centimetri, scale e ancoraggi restano invariati; i timing Godot sono conservati come provenienza nel manifest.</p>'
    page += f'<p><a href="{ident}-timing.csv" download>Scarica CSV</a> · <a href="../assets/guard-timing.json">Configurazione timing</a></p><div class="table-wrap"><table><thead><tr><th>Personaggio</th><th>Posa di parata</th><th>Frame</th><th>Durata</th><th>FPS demo</th><th>FPS Godot</th><th>Posa di parata da</th><th>Note</th></tr></thead><tbody>'
    page += ''.join(rows)+'</tbody></table></div></main></body></html>'
    (report/(ident+'-timing.html')).write_text(page,encoding='utf-8')
print('Report parate: 3 HTML, 3 CSV, 21 pose; durata comune 500 ms.')
if (root/'assets/hurt-timing.json').exists():
    subprocess.run([sys.executable,str(root/'scripts/build-hurt-reports.py')],check=True)
