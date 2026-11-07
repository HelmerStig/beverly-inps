"""Applica il timing demo e genera report HTML/CSV e pose, senza accesso a Godot."""
import csv
import html
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image
from jump_timing import apply_timing
from character_proportions import apply_proportions, write_portraits

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'assets/manifest.json').read_text(encoding='utf-8'))
timing = json.loads((root / 'assets/jump-timing.json').read_text(encoding='utf-8'))
apply_proportions(data,json.loads((root/'assets/character-proportions.json').read_text(encoding='utf-8')))
write_portraits(root,data)
apply_timing(data, timing)
(root / 'assets/manifest.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
(root / 'catalog.js').write_text('// Generato da scripts/import-roster.py.\nwindow.SANMAURO_CATALOG = '+json.dumps(data, ensure_ascii=False, indent=2)+';\n', encoding='utf-8')
report = root / 'reports'
poses = report / 'jump-poses'
poses.mkdir(parents=True, exist_ok=True)
rows, records = [], []
for c in data['characters']:
    a = next(a for a in c['animations'] if a['id'] == 'jump')
    apex, count = a['apexFrame'], len(a['frames'])
    x, y, w, h = a['frames'][apex]
    dx, dy, dw, dh = a['preview']['drawRect']
    with Image.open(root / a['image']) as sheet:
        pose = sheet.crop((x, y, x+w, y+h)).convert('RGBA').resize((round(dw), round(dh)), Image.Resampling.NEAREST)
        canvas = Image.new('RGBA', (512, 512))
        canvas.alpha_composite(pose, (round(dx), round(dy)))
        canvas.save(poses / (c['id']+'.png'))
    source_index = y // h * (a['sheetWidth'] // w) + x // w + 1
    up_fps = apex*1000/a['apexMs']
    down_fps = (count-apex)*1000/(a['durationMs']-a['apexMs'])
    note = a['apexNote']
    records.append([c['name'], count, apex+1, source_index, a['apexMs'], up_fps, down_fps,
        a['durationMs'], a['takeoffMs'], a['sourceTransform']['scale'][0], a['sourcePath'], note, a['sourceSha256']])
    name = html.escape(c['name'])
    rows.append(f'<tr data-character="{c["id"]}"><th scope="row">{name}</th>'
        f'<td><img src="jump-poses/{c["id"]}.png" width="128" height="128" alt="Apice scelto di {name}" loading="lazy"></td>'
        f'<td>{apex+1} / {count}<small>Sorgente: {source_index}</small></td>'
        f'<td><b>{a["apexMs"]} ms</b></td><td>{up_fps:g} / {down_fps:g}</td>'
        f'<td>{a["durationMs"]} ms</td><td>{a["sourceTransform"]["scale"][0]:g}</td><td>{html.escape(note)}</td></tr>')
with (report / 'jump-timing.csv').open('w', encoding='utf-8-sig', newline='') as output:
    writer = csv.writer(output)
    writer.writerow(['Personaggio','Frame totali','Frame apice (da 1)','Frame sorgente (da 1)',
        'Apice ms','FPS prima apice','FPS seconda fase','Ciclo ms','Stacco demo ms',
        'Scala Godot','Spritesheet sorgente','Note','SHA256 PNG'])
    writer.writerows(records)
page = '''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Timing Salto · Sanmauro Fighters</title><style>
body{margin:0;padding:32px;background:#141815;color:#eff3eb;font:15px/1.6 system-ui}main{max-width:1500px;margin:auto}a,b{color:#ceef80}h1{font-size:30px}p{max-width:1050px;color:#bbc7b9}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:12px;border-bottom:1px solid #3b493c}thead th{background:#273329;white-space:nowrap}td:last-child{min-width:280px}img{image-rendering:pixelated;background:#232923;object-fit:contain;border-radius:8px}small{display:block;color:#aab5a8;white-space:nowrap}@media print{body{background:white;color:black;padding:0}a,b{color:black}th,td{padding:5px;font-size:10px}img{width:80px;height:80px}}
</style></head><body><main><a href="../mosse.html?move=jump">← Apri Salto nella demo</a><h1>Timing Salto</h1>'''
page += f'<p>Aggiornamento: {timing["updatedAt"]}. Controllati i sette spritesheet. La posa selezionata di apice inizia a <b>{timing["apexMs"]} ms (0,5 s)</b> per tutti, con ciclo comune di <b>{timing["durationMs"]} ms</b> a velocità 1×.</p>'
page += '<p>Salita e seconda fase usano durate per frame adattate: FPS prima dell’apice = indice apice (da 0) × 1000 / 500; FPS seconda fase = frame rimanenti × 1000 / 500. Il frame apice appartiene alla seconda fase. Nessun frame è aggiunto, eliminato o invertito; scale, ancoraggi e PNG restano invariati.</p>'
page += '<p>Il riferimento è la massima elevazione del corpo visibile, confrontata nelle sequenze originali: non il punto più alto di una mano o del cappello. Plateau, raccolta delle gambe e tagli del foglio rendono alcuni apici una stima artistica; i casi sono annotati sotto. Questa galleria non simula la traiettoria fisica di Godot.</p>'
page += '<p>“Riproduci tutte” riallinea la partenza e mantiene il sincronismo nei loop e con caricamento progressivo. Velocità 0,5×: apice a 1 s; 2×: apice a 0,25 s. I timing Godot precedenti, inclusi preparazione e durate variabili di Mangler, restano nel manifest come sourceFrameDurations, sourceDurationMs e sourceTakeoffMs. Il nuovo timing demo modifica anche l’istante di stacco.</p>'
page += '<p>Le selezioni sono vincolate agli hash dei PNG e dei rettangoli: dopo una sostituzione o un cambio taglio occorre rivederle. Le pose mostrate usano la stessa normalizzazione della demo; la scala in tabella è quella Godot, prima del fattore comune per personaggio.</p>'
page += '<p><a href="jump-timing.csv" download>Scarica CSV</a> · <a href="../assets/jump-timing.json">Selezioni degli apici</a></p><div class="table-wrap"><table><thead><tr><th>Personaggio</th><th>Apice scelto</th><th>Frame (da 1)</th><th>Apice a</th><th>FPS salita / seconda fase</th><th>Ciclo</th><th>Scala Godot</th><th>Note</th></tr></thead><tbody>'
page += ''.join(rows) + '</tbody></table></div></main></body></html>'
(report / 'jump-timing.html').write_text(page, encoding='utf-8')
print('Report Salto Sanmauro: 7 apici, HTML e CSV aggiornati.')
if (root/'assets/guard-timing.json').exists():
    subprocess.run([sys.executable,str(root/'scripts/build-guard-reports.py')],check=True)
