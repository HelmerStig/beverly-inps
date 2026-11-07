"""Report locali delle mosse normali importate, senza dipendenze da Godot."""
import csv
import html
import json
from pathlib import Path
from PIL import Image
from remaining_moves import apply_remaining_timing

root=Path(__file__).resolve().parents[1]
data=json.loads((root/'assets/manifest.json').read_text(encoding='utf-8'))
apply_remaining_timing(data,json.loads((root/'assets/remaining-moves-timing.json').read_text(encoding='utf-8')))
(root/'assets/manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'catalog.js').write_text('// Generato dai manifest locali Sanmauro.\nwindow.SANMAURO_CATALOG = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
groups={}
for c in data['characters']:
    for a in c['animations']:
        if a.get('remainingImport'):groups.setdefault(a['id'],[]).append((c,a))
report=root/'reports'
index=[]
for ident,items in groups.items():
    poses=report/(ident+'-poses');poses.mkdir(parents=True,exist_ok=True)
    rows,records=[],[]
    for c,a in items:
        samples=[0,a.get('impactFrame',len(a['frames'])//2),len(a['frames'])-1]
        canvas=Image.new('RGBA',(1536,512));dx,dy,dw,dh=a['preview']['drawRect']
        with Image.open(root/a['image']) as sheet:
            for col,k in enumerate(samples):
                x,y,w,h=a['frames'][k]
                cell=sheet.crop((x,y,x+w,y+h)).convert('RGBA').resize((round(dw),round(dh)),Image.Resampling.NEAREST)
                tile=Image.new('RGBA',(512,512));tile.alpha_composite(cell,(round(dx),round(dy)))
                canvas.alpha_composite(tile,(col*512,0))
        canvas.save(poses/(c['id']+'.png'))
        impact=str(a['impactMs'])+' ms · frame '+str(a['impactFrame']+1) if a.get('attackStrength') else 'Timing sorgente' if ident!='stand-up' else '250 ms'
        note=a.get('impactNote','Sequenza Godot, senza imporre un punto di estensione.')
        if c['id']=='mangler':note+=' Scala Godot '+str(a['sourceTransform']['scale'])+'.'
        rows.append(f'<tr data-character="{c["id"]}"><th>{html.escape(c["name"])}</th><td><img src="{ident}-poses/{c["id"]}.png" width="288" height="96" alt="Ingresso, estensione o centro e fine di {html.escape(c["name"])}" loading="lazy"></td><td>{len(a["frames"])}</td><td>{a["durationMs"]:g} ms</td><td>{impact}</td><td>{a["sourceFps"]:g}</td><td>{html.escape(note)}</td></tr>')
        records.append([c['name'],len(a['frames']),a['durationMs'],a.get('impactMs',''),a.get('impactFrame',''),a['sourceFps'],a['sourceDurationMs'],a['sourceAnimation'],a['sourcePath'],a['sourceSha256'],note])
    with (report/(ident+'-timing.csv')).open('w',encoding='utf-8-sig',newline='') as output:
        writer=csv.writer(output);writer.writerow(['Personaggio','Frame demo','Durata demo ms','Estensione ms','Frame estensione indice 0','FPS Godot','Durata Godot ms','Animazione Godot','PNG sorgente','SHA256','Note']);writer.writerows(records)
    title=html.escape(items[0][1]['name'])
    page=f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · Timing Sanmauro</title><style>body{{background:#141815;color:#eff3eb;margin:0;padding:28px;font:15px/1.6 system-ui}}main{{max-width:1400px;margin:auto}}a{{color:#ceef80}}.table-wrap{{overflow:auto}}table{{border-collapse:collapse;width:100%}}td,th{{text-align:left;padding:12px;border-bottom:1px solid #3b493c}}img{{image-rendering:pixelated;max-width:none;background:#232923}}td:last-child{{min-width:260px}}</style></head><body><main><a href="../mosse.html?move={ident}">← Apri la mossa</a><h1>{title}</h1><p>Disponibile per {len(items)} personaggi, in base alle animazioni realmente definite in Godot. Nessuna variante mancante viene inventata.</p><p>Attacchi light: estensione 300 ms, durata 500 ms; medium: 450 / 750 ms; heavy: 500 / 1000 ms. La sequenza originale e i recuperi separati definiti in Godot sono conservati. Una posa terminale uguale alla prima chiude il ciclo senza aggiungere durata: in piedi, accovacciata o in aria secondo la mossa. Non simula il movimento fisico del salto.</p><p>Le mosse senza categoria mantengono durate e pesi Godot; la rialzata da accovacciata dura 250 ms come l’accovacciata. Loop attivo di default, disattivabile. Le proporzioni in centimetri e le correzioni Godot restano condivise con gli altri player.</p><p><a href="{ident}-timing.csv" download>Scarica CSV</a> · <a href="../assets/remaining-moves-timing.json">Configurazione timing</a> · <a href="remaining-moves.html">Inventario</a></p><div class="table-wrap"><table><thead><tr><th>Personaggio</th><th>Ingresso / estensione o centro / fine</th><th>Frame</th><th>Durata</th><th>Estensione</th><th>FPS Godot</th><th>Note</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div></main></body></html>'''
    (report/(ident+'-timing.html')).write_text(page,encoding='utf-8')
    index.append(f'<li><a href="{ident}-timing.html">{title}</a> ({len(items)} personaggi)</li>')
(report/'remaining-moves.html').write_text('<!doctype html><html lang="it"><meta charset="utf-8"><title>Inventario mosse normali</title><body><h1>Mosse normali aggiunte</h1><p>Esclusi special, super, prese, combo e varianti già accovacciate di Mangler. Sequenze revisionate con Godot 4.7 in un progetto temporaneo isolato, senza modificare il sorgente.</p><ul>'+''.join(index)+'</ul></body></html>',encoding='utf-8')
print(f'Report aggiuntivi: {len(groups)} HTML/CSV, {sum(len(v) for v in groups.values())} confronti di pose.')
