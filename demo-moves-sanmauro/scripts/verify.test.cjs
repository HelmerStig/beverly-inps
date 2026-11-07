const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));

test('mosse normali aggiunte: pagine per mossa e per personaggio collegate ai report',()=>{
  const groups=require('../move-groups.js').group(manifest.characters).filter(g=>g.animations.some(a=>a.remainingImport));
  for(const group of groups){
    const f=fixture({page:'moves',search:'?move='+group.id});
    assert.equal(f.nodes.get('#move-report').hidden,false);
    assert.equal(f.nodes.get('#move-report-link').href,'reports/'+group.id+'-timing.html');
    assert.equal(f.galleries[0].data.animations.length,group.animations.length);
  }
  const f=fixture({page:'character',search:'?id=mangler&anim=jump-heavy-kick'});
  assert.equal(f.galleries[0].options.highlightId,'jump-heavy-kick');
  assert.doesNotMatch(f.nodes.get('#sidebar').innerHTML,/Combo|già accovacciato/);
});

test('pugno pesante: fonti esatte, sequenze Godot, estensione 500 ms e idle a 1000 ms',()=>{
  const {advanceAnimation}=require('../player-core.js');
  const peaks={arianna:23,bue:15,mangler:40,mileto:16,oscare:15,peirolo:10,torpe:15};
  for(const c of manifest.characters){
    const a=c.animations.find(a=>a.id==='heavy-punch');
    assert.equal(a.name,'Pugno pesante');assert.equal(a.impactFrame,peaks[c.id]);
    assert.equal(a.impactMs,500);assert.equal(a.durationMs,1000);assert.equal(a.returnToIdleMs,1000);
    assert.equal(a.frameDurations.at(-1),0);
    assert.ok(!a.sourcePath.includes('jump_')&&!a.sourcePath.includes('low'));
    if(c.id==='mangler'){
      assert.equal(a.sourcePath,'assets/sprites/characters/mangler/moves/00-heavy_punch_high.png');
      assert.equal(a.sourceAnimation,'heavy_punch');assert.deepEqual(a.sourceTransform.scale,[.85,.85]);
      const indices=[...Array.from({length:49},(_,i)=>i),...Array.from({length:21},(_,i)=>40-i)];
      assert.deepEqual(a.sourceFrameIndices,indices);
      assert.deepEqual(a.frames,[...indices,0].map(i=>[i%7*512,Math.floor(i/7)*512,512,512]));
      assert.equal(a.sourceFrameDurations.length,70);assert.equal(a.terminalIdleAdded,true);
    }else{
      assert.deepEqual(a.frames,a.sourceFrameIndices.map(i=>[i%7*512,Math.floor(i/7)*512,512,512]));
    }
    for(const speed of [.5,1,2]){
      const origin={frame:0,remainder:0};
      for(const cycle of [0,1,10]){
        assert.equal(advanceAnimation(origin,(cycle*1000+499.99)/speed,a,speed,true).frame,a.impactFrame-1);
        assert.equal(advanceAnimation(origin,(cycle*1000+500)/speed,a,speed,true).frame,a.impactFrame);
      }
      assert.equal(advanceAnimation(origin,999.99/speed,a,speed,false).frame,a.frames.length-2);
      const final=advanceAnimation(origin,1000/speed,a,speed,false);
      assert.equal(final.ended,true);assert.equal(final.frame,a.frames.length-1);
      assert.equal(advanceAnimation(origin,1000/speed,a,speed,true).frame,0);
    }
  }
});

test('pugno pesante: confronto per mossa, report e accesso dal personaggio',()=>{
  const f=fixture({page:'moves',search:'?move=heavy-punch'});
  assert.equal(f.nodes.get('#move-report').hidden,false);
  assert.equal(f.nodes.get('#move-report-link').href,'reports/heavy-punch-timing.html');
  assert.equal(f.galleries[0].data.animations.length,7);
  const detail=fixture({page:'character',search:'?id=mangler&anim=heavy-punch'});
  assert.equal(detail.galleries[0].options.highlightId,'heavy-punch');
  const html=fs.readFileSync(path.join(root,'reports/heavy-punch-timing.html'),'utf8');
  assert.match(html,/1000 ms \(1 s\)/);assert.match(html,/500 ms \(0,5 s\)/);
  assert.equal((html.match(/data-character=/g)||[]).length,7);
});

test('ritratti originali Godot locali accanto al nome di tutti i personaggi',()=>{
  const filenames={arianna:'arianna-portrait-v2.png',mangler:'mangler-portrait-v1.png',bue:'bue-portrait-v1.png',
    mileto:'mileto-portrait-v1.png',oscare:'oscare-portrait-slim-bust.png',peirolo:'peirolo-portrait-v1.png',torpe:'torpe-portrait-v1.png'};
  for(const c of manifest.characters){
    assert.equal(c.portrait,'assets/portraits/'+filenames[c.id]);
    const bytes=fs.readFileSync(path.join(root,c.portrait));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),c.portraitSource.sourceSha256);
    assert.equal(c.portraitSource.sourcePath,'assets/ui/portraits/'+filenames[c.id]);
    const f=fixture({page:'character',search:'?id='+c.id});
    assert.ok(f.nodes.get('#character-detail').innerHTML.includes('src="'+c.portrait+'"'));
    assert.ok(c.thumbnail.startsWith('assets/characters/'));
  }
});

test('pugno medio: estensione a 450 ms, idle terminale a 750 ms e fonti Godot corrette',()=>{
  const {advanceAnimation}=require('../player-core.js');
  const peaks={arianna:20,bue:22,mangler:16,mileto:13,oscare:20,peirolo:13,torpe:10};
  for(const c of manifest.characters){
    const a=c.animations.find(a=>a.id==='medium-punch');
    assert.equal(a.name,'Pugno medio');assert.equal(a.impactMs,450);
    assert.equal(a.impactFrame,peaks[c.id]);assert.equal(a.durationMs,750);assert.equal(a.returnToIdleMs,750);
    assert.equal(a.frameDurations.at(-1),0);
    assert.throws(()=>advanceAnimation({frame:0,remainder:0},100,{...a,returnToIdleMs:undefined},1,true),/Timing non valido/);
    assert.ok(a.frameDurations.slice(0,-1).every(d=>d>0));
    assert.equal(a.sourceFps,c.id==='torpe'?30:48);
    if(!['arianna','mangler'].includes(c.id)){
      const stem={bue:'Bue',mileto:'Mileto',oscare:'Oscare',peirolo:'Peiro',torpe:'Torpe'}[c.id];
      assert.equal(a.sourcePath,'assets/sprites/characters/'+c.id+'/'+stem+'-medium_punch.png');
    }
    if(c.id==='mangler'){
      assert.equal(a.sourceAnimation,'medium_open_hand_slap');assert.deepEqual(a.sourceTransform.scale,[.85,.85]);
      assert.deepEqual(a.sourceSheets.map(s=>s.frames.length),[10,16,16]);
      for(const part of a.sourceSheets){
        const bytes=fs.readFileSync(path.join(root,part.image));
        assert.equal(createHash('sha256').update(bytes).digest('hex'),part.sourceSha256);
        assert.ok(part.sourcePath.includes('/basic-moves/medium-punch/'));
      }
    }
    for(const speed of [.5,1,2]){
      const origin={frame:0,remainder:0};
      for(const cycle of [0,1,10]){
        assert.equal(advanceAnimation(origin,(cycle*750+449.99)/speed,a,speed,true).frame,a.impactFrame-1);
        assert.equal(advanceAnimation(origin,(cycle*750+450)/speed,a,speed,true).frame,a.impactFrame);
      }
      const before=advanceAnimation(origin,749.99/speed,a,speed,false);
      assert.equal(before.ended,false);assert.equal(before.frame,a.frames.length-2);
      const end=advanceAnimation(origin,750/speed,a,speed,false);
      assert.equal(end.ended,true);assert.equal(end.frame,a.frames.length-1);
      assert.equal(advanceAnimation(origin,750/speed,a,speed,true).frame,0);
    }
  }
});

test('pugno medio: gallerie, report e selezioni vincolate agli asset',()=>{
  const f=fixture({page:'moves',search:'?move=medium-punch'});
  assert.equal(f.nodes.get('#move-report').hidden,false);
  assert.equal(f.nodes.get('#move-report-link').href,'reports/medium-punch-timing.html');
  assert.equal(f.galleries[0].data.animations.length,7);
  const html=fs.readFileSync(path.join(root,'reports/medium-punch-timing.html'),'utf8');
  assert.match(html,/750 ms \(0,75 s\)/);assert.match(html,/450 ms \(0,45 s\)/);
  const config=JSON.parse(fs.readFileSync(path.join(root,'assets/medium-punch-timing.json'),'utf8'));
  for(const c of manifest.characters){
    const a=c.animations.find(a=>a.id==='medium-punch'),entry=config.items.find(e=>e.characterId===c.id);
    assert.equal(entry.sourceSha256,a.sourceSha256);
    assert.equal(entry.framesSha256,createHash('sha256').update(JSON.stringify(a.frames)).digest('hex'));
    assert.ok(html.includes('data-character="'+c.id+'"'));
  }
});

test('pugno leggero: sequenze Godot e durata completa di 500 ms anche con loop e velocità',()=>{
  const {advanceAnimation}=require('../player-core.js');
  for(const c of manifest.characters){
    const a=c.animations.find(a=>a.id==='light-punch');
    const custom=['arianna','mangler'].includes(c.id),columns=c.id==='arianna'?7:5;
    const indices=c.id==='arianna'?[0,1,2,3,4,5,6,7,8,7,6,5,4,3,2,1,0]:c.id==='mangler'?Array.from({length:18},(_,i)=>i):[0,1,2,3,4,5,6,5,4,3,2,1,0];
    assert.deepEqual(a.frames,indices.map(i=>[i%columns*512,Math.floor(i/columns)*512,512,512]));
    assert.equal(a.sourceFps,custom?48:24);assert.equal(a.loop,false);
    if(!custom){
      const filename=c.id==='oscare'?'Oscare-light_punch.png':'light_punch_spritesheet.png';
      assert.equal(a.sourcePath,'assets/sprites/characters/'+c.id+'/'+filename);
      assert.ok(!a.sourcePath.includes('jump_'));
    }
    assert.equal(a.attackDurationMs,500);assert.equal(a.durationMs,500);
    const impactFrames={arianna:8,bue:4,mangler:10,mileto:6,oscare:5,peirolo:4,torpe:6};
    assert.equal(a.impactFrame,impactFrames[c.id]);assert.equal(a.impactMs,300);
    assert.ok(Math.abs(a.frameDurations.slice(0,a.impactFrame).reduce((s,d)=>s+d,0)-300)<1e-8);
    assert.equal(a.sourceAnimation,c.id==='arianna'?'arianna_light_punch':c.id==='mangler'?'light_punch_single':'light_punch');
    assert.ok(Math.abs(a.sourceDurationMs-indices.length*1000/a.sourceFps)<1e-8);
    assert.equal(a.sourceFrameDurations.length,indices.length);
    for(const speed of [.5,1,2]){
      const origin={frame:0,remainder:0};
      for(const cycle of [0,1,10]){
        assert.equal(advanceAnimation(origin,(cycle*500+299.99)/speed,a,speed,true).frame,a.impactFrame-1);
        assert.equal(advanceAnimation(origin,(cycle*500+300)/speed,a,speed,true).frame,a.impactFrame);
      }
      assert.equal(advanceAnimation(origin,499.99/speed,a,speed,false).ended,false);
      const ended=advanceAnimation(origin,500/speed,a,speed,false);
      assert.equal(ended.ended,true);assert.equal(ended.frame,indices.length-1);
      if(c.id==='arianna'){
        assert.equal(a.playbackComposition,'forward-then-reverse-without-repeated-peak');
        assert.equal(a.sourceForwardFrameCount,9);
        assert.deepEqual(a.frames[a.frames.length-1],a.frames[0]);
        assert.deepEqual(a.frames[advanceAnimation(origin,(300+a.frameDurations[8])/speed,a,speed,false).frame],a.frames[7]);
        assert.equal(advanceAnimation(origin,(500-a.frameDurations[16])/speed,a,speed,false).frame,16);
      }
      for(const cycle of [1,2,10])assert.equal(advanceAnimation(origin,cycle*500/speed,a,speed,true).frame,0);
    }
  }
});

test('pugno leggero: navigazione, report e pose locali per tutti',()=>{
  const f=fixture({page:'moves',search:'?move=light-punch'});
  assert.equal(f.nodes.get('#move-report').hidden,false);
  assert.equal(f.nodes.get('#move-report-link').href,'reports/light-punch-timing.html');
  assert.equal(f.galleries[0].data.animations.length,7);
  const detail=fixture({page:'character',search:'?id=mangler&anim=light-punch'});
  assert.equal(detail.galleries[0].options.highlightId,'light-punch');
  const html=fs.readFileSync(path.join(root,'reports/light-punch-timing.html'),'utf8');
  assert.match(html,/500 ms \(0,5 s\)/);
  assert.match(html,/300 ms \(0,30 s\)/);
  assert.equal(fs.readFileSync(path.join(root,'reports/light-punch-timing.csv'),'utf8').trim().split(/\r?\n/).length,8);
  for(const c of manifest.characters){
    assert.ok(html.includes('data-character="'+c.id+'"'));
    assert.ok(fs.existsSync(path.join(root,'reports/light-punch-poses',c.id+'.png')));
  }
});

test('sette personaggi con idle, camminata e salto: copie integre e frame entro i limiti',()=>{
  assert.deepEqual(manifest.characters.map(c=>c.name),['Arianna','Bue','Mangler','Mileto','Oscare','Peirò','Torpe']);
  const idleCounts={arianna:24,bue:63,mangler:49,mileto:63,oscare:63,peirolo:63,torpe:61};
  const walkCounts={arianna:48,bue:49,mangler:48,mileto:49,oscare:49,peirolo:49,torpe:21};
  const walkPaths={arianna:'basic-moves/01-walk.png',mangler:'02-walk.png',torpe:'Torpe-walk-trimmed.png'};
  const jumpCounts={arianna:49,bue:37,mangler:25,mileto:39,oscare:38,peirolo:40,torpe:34};
  const victoryCounts={arianna:49,bue:49,mangler:45,mileto:49,oscare:49,peirolo:49,torpe:49};
  const koCounts={arianna:25,bue:49,mangler:25,mileto:49,oscare:49,peirolo:49,torpe:49};
  const guardCounts={arianna:[16,13,16],bue:[10,6,11],mangler:[14,8,11],mileto:[6,6,11],oscare:[10,6,11],peirolo:[6,6,11],torpe:[9,6,11]};
  const hurtCounts={arianna:[8,15,7,12],bue:[18,11,11,12],mangler:[16,16,10,12],mileto:[14,11,11,12],oscare:[8,11,11,12],peirolo:[9,11,11,12],torpe:[8,11,11,12]};
  const heavyCounts={arianna:49,bue:21,mangler:71,mileto:38,oscare:28,peirolo:25,torpe:31};
  const mediumCounts={arianna:49,bue:47,mangler:42,mileto:24,oscare:43,peirolo:29,torpe:27};
  const punchCounts={arianna:17,bue:13,mangler:18,mileto:13,oscare:13,peirolo:13,torpe:13};
  const crouchCounts={arianna:19,bue:7,mangler:25,mileto:13,oscare:9,peirolo:11,torpe:7};
  for(const c of manifest.characters){
    assert.deepEqual(c.animations.filter(a=>!a.remainingImport).map(a=>a.id),['idle','walk','jump','crouch','block-high','block-mid','block-low','hurt-high','hurt-medium','hurt-low','hurt-crouched','victory','ko','light-punch','medium-punch','heavy-punch']);
    for(const a of c.animations.filter(a=>!a.remainingImport)){
      const sheet=fs.readFileSync(path.join(root,a.image));
      assert.equal(createHash('sha256').update(sheet).digest('hex'),a.sourceSha256,c.name+' '+a.id);
      const width=sheet.readUInt32BE(16),height=sheet.readUInt32BE(20);
      const guard=['block-high','block-mid','block-low'].indexOf(a.id);
      const hurt=['hurt-high','hurt-medium','hurt-low','hurt-crouched'].indexOf(a.id);
      assert.equal(a.frames.length,guard>=0?guardCounts[c.id][guard]*2-1:hurt>=0?hurtCounts[c.id][hurt]:({idle:idleCounts,walk:walkCounts,jump:jumpCounts,crouch:crouchCounts,victory:victoryCounts,ko:koCounts,'light-punch':punchCounts,'medium-punch':mediumCounts,'heavy-punch':heavyCounts})[a.id][c.id]);
      const guardFps=c.id==='arianna'?48:c.id==='mangler'?(guard===0?48:24):(guard===2?48:24);
      const hurtFps=a.id==='hurt-crouched'?24:c.id==='arianna'?(hurt===1?48:24):c.id==='mangler'?24:48;
      assert.equal(a.playbackFps,a.id==='heavy-punch'?a.frames.length:a.id==='medium-punch'?a.frames.length*1000/750:a.id==='light-punch'?a.frames.length*1000/500:a.id==='jump'?a.frames.length:guard>=0?a.frames.length*2:a.id==='crouch'?a.frames.length*4:hurt>=0?a.frames.length*2:24);
      if(hurt>=0)assert.equal(a.sourceFps,hurtFps);
      if(guard>=0)assert.equal(a.sourceFps,guardFps);
      assert.equal(width,a.sheetWidth);assert.equal(height,a.sheetHeight);
      for(const [i,[x,y,w,h]] of a.frames.entries()){
        assert.equal(w,512);assert.equal(h,512);assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height,c.name);
        if(a.id==='walk'){assert.equal(x,(i%7)*512);assert.equal(y,Math.floor(i/7)*512);}
      }
      if(a.id==='walk'){
        assert.equal(a.sourceFps,24);
        assert.equal(a.sourcePath,'assets/sprites/characters/'+c.id+'/'+(walkPaths[c.id]??'walk-spritesheet.png'));
        assert.equal(a.trimmed,c.id==='torpe');assert.ok(a.sourceConfigPath);
      }
    }
    const portrait=fs.readFileSync(path.join(root,c.thumbnail));
    assert.equal(portrait.readUInt32BE(16),512);assert.equal(portrait.readUInt32BE(20),512);
    assert.deepEqual(fs.readdirSync(path.join(root,'assets/characters',c.id)).sort(),['block-high.png','block-low.png','block-mid.png','crouch.png','hurt-crouched.png','hurt-high.png','hurt-low.png','hurt-medium.png','idle.png','jump.png','ko.png','light-punch.png','portrait.png','victory.png','walk.png','medium-punch.png','heavy-punch.png',...(c.id==='mangler'?['medium-punch-preparation.png','medium-punch-hit.png','medium-punch-to-idle.png']:[]),...c.animations.filter(a=>a.remainingImport).map(a=>path.basename(a.image))].filter((v,i,a)=>a.indexOf(v)===i).sort());
  }
});

test('catalogo offline uguale al manifest, tutte le pagine hanno riferimenti autonomi',()=>{
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SANMAURO_CATALOG)),manifest);
  for(const page of ['index.html','personaggio.html','mosse.html','stages.html']){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
      if(match[1].startsWith('#'))continue;
      assert.ok(!match[1].includes('..')&&!match[1].includes(':'),match[1]);
      assert.ok(fs.existsSync(path.join(root,match[1].split('?')[0])),match[1]);
    }
  }
});

test('ingombri normalizzati, piedi e centro comuni, rapporto delle scale Godot conservato',()=>{
  for(const c of manifest.characters){
    const [idle,walk]=c.animations;
    const target=344*c.heightCm/165*manifest.previewScale;
    assert.ok(Math.abs(idle.medianContentHeight*idle.preview.scale[1]-target)<1e-8);
    assert.ok(Math.abs(walk.medianContentHeight*walk.preview.scale[1]-target)<10,c.name);
    for(const a of c.animations){
      const [x,y,w,h]=a.preview.drawRect,[sx,sy]=a.preview.scale,[ax,ay]=a.preview.anchor;
      assert.equal(a.preview.viewScale,manifest.previewScale);
      assert.equal(a.preview.heightMultiplier,c.heightCm/165);
      assert.ok(Math.abs(a.normalizedPreview.targetIdleHeight-344)<1e-8);
      assert.ok(Math.abs(sx-sy)<1e-8,'proporzioni conservate');
      assert.ok(Math.abs(x+ax*sx-256)<1e-8);assert.ok(Math.abs(y+ay*sy-430)<1e-8);
      assert.ok(Math.abs(w/a.frameWidth-sx)<1e-8&&Math.abs(h/a.frameHeight-sy)<1e-8);
      const [left,top,right,bottom]=a.contentBounds;
      assert.ok(x+left*sx>=0&&x+right*sx<=512&&y+top*sy>=0&&y+bottom*sy<=512,c.name+' '+a.id);
    }
    assert.ok(Math.abs(walk.preview.scale[0]/idle.preview.scale[0]-walk.sourceTransform.scale[0]/idle.sourceTransform.scale[0])<1e-8);
  }
  const mangler=manifest.characters.find(c=>c.id==='mangler');
  for(const a of mangler.animations.filter(a=>!a.remainingImport)){const legacy=a.id==='walk'||a.id==='ko'||(a.id.startsWith('hurt-')&&!a.remainingImport&&a.id!=='hurt-crouched');const scale=legacy?0.7:0.85;assert.deepEqual(a.sourceTransform.scale,[scale,scale]);}
  assert.ok(mangler.animations[1].preview.drawRect[2]<mangler.animations[0].preview.drawRect[2]);
});

test('proporzioni fisiche condivise da anteprime, hover, player e report senza cambiare scala dello stage',()=>{
  const arianna=manifest.characters.find(c=>c.id==='arianna'),oscare=manifest.characters.find(c=>c.id==='oscare');
  const visibleHeight=c=>c.animations[0].medianContentHeight*c.animations[0].preview.scale[1];
  assert.ok(Math.abs(visibleHeight(oscare)/visibleHeight(arianna)-183/165)<1e-8);
  for(const c of manifest.characters){
    for(const a of c.animations){
      const [x,y]=a.preview.drawRect,[sx,sy]=a.preview.scale,[l,t,r,b]=a.contentBounds;
      assert.ok(x+l*sx>=16-1e-8&&x+r*sx<=496+1e-8&&y+t*sy>=16-1e-8,c.name+' '+a.id);
    }
  }
});

test('salti rispettano selezioni Godot, preparazione compressa e durate originali di Mangler',()=>{
  const {advanceAnimation}=require('../player-core.js');
  const starts={arianna:0,bue:3,mangler:0,mileto:4,oscare:5,peirolo:4,torpe:4};
  const takeoffs={arianna:9,bue:9,mangler:5,mileto:11,oscare:8,peirolo:12,torpe:9};
  for(const c of manifest.characters){
    const a=c.animations.find(a=>a.id==='jump'),columns=c.id==='mangler'?5:7;
    for(const [i,frame] of a.frames.entries()){
      const source=starts[c.id]+i;
      assert.deepEqual(frame,[source%columns*512,Math.floor(source/columns)*512,512,512]);
    }
    assert.equal(a.takeoffFrame,takeoffs[c.id]);assert.equal(a.sourceLoop,false);
    assert.equal(a.frameDurations.length,a.frames.length);
    assert.ok(a.frameDurations.every(d=>Number.isFinite(d)&&d>0));
    assert.ok(Math.abs(a.frameDurations.reduce((s,d)=>s+d,0)-a.durationMs)<1e-8);
    for(const speed of [.5,1,2]){
      assert.equal(advanceAnimation({frame:0,remainder:0},a.takeoffMs/speed,a,speed,true).frame,a.takeoffFrame,c.name);
      assert.equal(advanceAnimation({frame:0,remainder:0},a.durationMs/speed,a,speed,true).frame,0);
    }
  }
  const mangler=manifest.characters.find(c=>c.id==='mangler').animations[2];
  assert.match(mangler.sourceConfigPath,/idle_frames.tres$/);assert.match(mangler.sourcePath,/04-jump.png$/);
  assert.ok(Math.abs(mangler.sourceFrameDurations[5]-1.942857*1000/24)<1e-8);
  assert.ok(Math.abs(mangler.sourceTakeoffMs-1000*4/60)<1e-8);
  assert.equal(mangler.preview.scale[0],manifest.characters.find(c=>c.id==='mangler').animations[0].preview.scale[0]);
});

test('apici a 500 ms e ciclo di 1000 ms per tutti, anche con velocità e cicli diversi',()=>{
  const {advanceAnimation}=require('../player-core.js');
  const timing=JSON.parse(fs.readFileSync(path.join(root,'assets/jump-timing.json'),'utf8'));
  for(const c of manifest.characters){
    const a=c.animations[2],entry=timing.items.find(i=>i.characterId===c.id);
    assert.equal(a.apexFrame,entry.apexFrame);assert.equal(a.apexMs,500);assert.equal(a.durationMs,1000);
    assert.equal(entry.sourceSha256,a.sourceSha256);
    assert.equal(entry.framesSha256,createHash('sha256').update(JSON.stringify(a.frames)).digest('hex'));
    for(const speed of [.5,1,2]){
      const origin={frame:0,remainder:0};
      for(const cycle of [0,1,10]){
        assert.ok(advanceAnimation(origin,(cycle*1000+499.99)/speed,a,speed,true).frame<a.apexFrame,c.name);
        assert.equal(advanceAnimation(origin,(cycle*1000+500)/speed,a,speed,true).frame,a.apexFrame,c.name);
        assert.equal(advanceAnimation(origin,((cycle+1)*1000)/speed,a,speed,true).frame,0);
      }
      assert.equal(advanceAnimation(origin,1000/speed,a,speed,false).ended,true);
    }
  }
});

test('vittoria e sconfitta usano le selezioni Godot, con esclusioni di Mangler e loop disattivato',()=>{
  for(const c of manifest.characters){
    for(const id of ['victory','ko']){
      const a=c.animations.find(a=>a.id===id);
      assert.equal(a.name,id==='victory'?'Vittoria':'Sconfitta');
      assert.equal(a.playbackFps,24);assert.equal(a.sourceFps,24);
      assert.equal(a.loop,false);assert.equal(a.sourceLoop,false);
      const columns=id==='ko'&&['arianna','mangler'].includes(c.id)?5:7;
      const indices=id==='victory'&&c.id==='mangler'?Array.from({length:49},(_,i)=>i).filter(i=>![8,9,10,11].includes(i)):Array.from({length:a.frames.length},(_,i)=>i);
      assert.deepEqual(a.frames,indices.map(i=>[i%columns*512,Math.floor(i/columns)*512,512,512]));
      const filename=id==='victory'?'victory.png':c.id==='arianna'||c.id==='mangler'?'ko.png':'death.png';
      assert.ok(a.sourcePath.endsWith('/'+filename));
    }
  }
  const mangler=manifest.characters.find(c=>c.id==='mangler');
  assert.deepEqual(mangler.animations.find(a=>a.id==='victory').sourceSkippedFrames,[8,9,10,11]);
  assert.match(mangler.animations.find(a=>a.id==='ko').sourceConfigPath,/idle_frames.tres$/);
});

test('report HTML/CSV con sette pose e link locali validi',()=>{
  const html=fs.readFileSync(path.join(root,'reports/jump-timing.html'),'utf8');
  const csv=fs.readFileSync(path.join(root,'reports/jump-timing.csv'),'utf8');
  assert.match(html,/0,5 s/);assert.match(html,/1000 ms/);
  assert.equal((html.match(/<tr data-character=/g)??[]).length,7);
  assert.equal(csv.trim().split(/\r?\n/).length,8);
  for(const c of manifest.characters){
    assert.ok(html.includes('data-character="'+c.id+'"'));
    const png=fs.readFileSync(path.join(root,'reports/jump-poses',c.id+'.png'));
    assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);
  }
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    assert.ok(fs.existsSync(path.resolve(root,'reports',match[1].split('?')[0])),match[1]);
  }
});

test('server autonomo e condiviso servono gallerie e asset, proteggendo i percorsi esterni',async t=>{
  for(const [modulePath,prefix] of [['./serve.mjs',''],['../../demo-moves/scripts/serve.mjs','/demo-moves-sanmauro']]){
    const {createDemoServer}=await import(modulePath),server=createDemoServer();
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>server.close(resolve)));
    const base='http://127.0.0.1:'+server.address().port;
    for(const asset of ['index.html','personaggio.html?id=torpe','mosse.html?move=walk','reports/jump-timing.html','reports/jump-timing.csv','assets/jump-timing.json','catalog.js','styles.css','roster.css','app.js','roster-preview.js','player-core.js','animation-gallery.js','move-groups.js',...manifest.characters.flatMap(c=>[c.thumbnail,'reports/jump-poses/'+c.id+'.png',...c.animations.map(a=>a.image)])]){
      assert.equal((await fetch(base+prefix+'/'+asset,{method:'HEAD'})).status,200,asset);
    }
    assert.equal((await fetch(base+prefix+'/.git/config')).status,403);
    assert.equal((await fetch(base+'/project.godot')).status,403);
    assert.equal((await fetch(base+prefix+'/absent.png')).status,404);
  }
});

function fixture({page='roster',search=''}={}){
  const nodes=new Map(),galleries=[],lifecycle={},classes=new Set();let stops=0,focused;
  function node(){return {hidden:false,value:'',textContent:'',innerHTML:'',dataset:{},listeners:{},attrs:{},
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},emit(type,event={}){for(const fn of this.listeners[type]??[])fn(event);},
    setAttribute(k,v){this.attrs[k]=v;},focus(){focused=this;},getClientRects(){return this.hidden?[]:[1];}};}
  for(const s of ['#main','#character-grid','#sidebar','.menu-toggle','.menu-overlay','#character-search','#nav-count','#visible-count','#empty-state','.nav-empty','.sidebar-close','#character-detail','#breadcrumb-name','#animation-gallery','#move-gallery','#move-name','#move-total-count','#move-visible-count','#move-empty','#move-report','#move-report-link'])nodes.set(s,node());
  const elements=manifest.characters.flatMap(c=>[Object.assign(node(),{dataset:{character:c.id}}),Object.assign(node(),{dataset:{character:c.id}})]);
  nodes.get('#sidebar').querySelectorAll=()=>[nodes.get('#character-search'),...elements];
  const body={dataset:{page},classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k),toggle(k,on){on?classes.add(k):classes.delete(k);}}};
  const document={...node(),body,querySelector:s=>nodes.get(s),querySelectorAll(s){if(s==='[data-character]')return elements;if(s==='[data-total]')return [node()];return [];}};
  const context={window:{SANMAURO_CATALOG:manifest,addEventListener(type,fn){lifecycle[type]=fn;}},document,URLSearchParams,location:{search},
    MovesGroups:require('../move-groups.js'),MovesGallery:{install(container,data,options){const record={container,data,options,destroyed:false};galleries.push(record);return {destroy(){record.destroyed=true;}};}},
    MovesRoster:{install:()=>({stop(){stops++;},refresh(){}})},matchMedia:()=>({matches:false,addEventListener(){}})};
  vm.runInNewContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
  return {nodes,elements,galleries,lifecycle,document,stops:()=>stops,focused:()=>focused};
}

test('roster e menu collegano le vere pagine; ricerca senza accenti con stato vuoto',()=>{
  const f=fixture(),search=f.nodes.get('#character-search');
  assert.match(f.nodes.get('#character-grid').innerHTML,/personaggio.html\?id=torpe/);
  assert.match(f.nodes.get('#character-grid').innerHTML,/39 animazioni disponibili/);
  assert.match(f.nodes.get('#sidebar').innerHTML,/mosse.html\?move=walk/);
  assert.match(f.nodes.get('#sidebar').innerHTML,/Per personaggio/);
  assert.match(f.nodes.get('#sidebar').innerHTML,/href="stages.html"/);
  search.value='peiro';search.emit('input');
  assert.deepEqual(f.elements.filter(el=>!el.hidden).map(el=>el.dataset.character),['peirolo','peirolo']);
  assert.equal(f.nodes.get('#visible-count').textContent,1);
  search.value='inesistente';search.emit('input');assert.equal(f.nodes.get('#empty-state').hidden,false);
  search.value='';search.emit('input');assert.equal(f.nodes.get('#visible-count').textContent,7);
  f.lifecycle.pagehide();assert.equal(f.stops(),1);
});

test('dettaglio personaggio mostra le tre mosse con navigazione e highlight',()=>{
  const f=fixture({page:'character',search:'?id=torpe&anim=walk'});
  assert.equal(f.document.title,'Torpe · Animazioni · Sanmauro Fighters');
  assert.deepEqual(f.galleries[0].data.animations.filter(a=>!a.remainingImport).map(a=>a.id),['idle','walk','jump','crouch','block-high','block-mid','block-low','hurt-high','hurt-medium','hurt-low','hurt-crouched','victory','ko','light-punch','medium-punch','heavy-punch']);
  assert.equal(f.galleries[0].data.animations[1].frames.length,21);
  assert.equal(f.galleries[0].options.highlightId,'walk');
  assert.match(f.nodes.get('#character-detail').innerHTML,/personaggio.html\?id=peirolo&anim=walk/);
  f.lifecycle.pagehide();assert.equal(f.galleries[0].destroyed,true);
});

test('Salto disponibile per mossa e per personaggio, con highlight e scala corretta',()=>{
  const f=fixture({page:'moves',search:'?move=jump'});
  assert.equal(f.nodes.get('#move-name').textContent,'Salto');
  assert.equal(f.nodes.get('#move-report').hidden,false);
  assert.equal(f.galleries[0].data.animations.length,7);
  const c=fixture({page:'character',search:'?id=mangler&anim=jump'});
  assert.equal(c.galleries[0].options.highlightId,'jump');
  assert.equal(c.galleries[0].data.animations[2].frames.length,25);
  assert.match(c.nodes.get('#sidebar').innerHTML,/mosse.html\?move=jump/);
});

test('menu Per mossa e gallerie mostrano Vittoria e Sconfitta per tutti i personaggi',()=>{
  for(const [id,label] of [['victory','Vittoria'],['ko','Sconfitta']]){
    const f=fixture({page:'moves',search:'?move='+id});
    assert.equal(f.nodes.get('#move-name').textContent,label);
    assert.equal(f.galleries[0].data.animations.length,7);
    assert.ok(f.galleries[0].data.animations.every(a=>a.id===id&&a.loop===false));
    const c=fixture({page:'character',search:'?id=mangler&anim='+id});
    assert.equal(c.galleries[0].options.highlightId,id);
    assert.match(c.nodes.get('#sidebar').innerHTML,new RegExp('mosse.html\\?move='+id));
  }
});

test('parate alta/media/bassa per sette personaggi: fonti, tagli, scala e navigazione Godot',()=>{
  for(const c of manifest.characters){
    for(const [i,id] of ['block-high','block-mid','block-low'].entries()){
      const a=c.animations.find(a=>a.id===id),columns=c.id==='arianna'?4:5;
      assert.equal(a.loop,false);assert.equal(a.sourceLoop,false);
      assert.equal(a.sourceAnimation,id.replace('-','_'));
      assert.equal(a.playbackFps,a.frames.length*2);
      assert.ok([24,48].includes(a.sourceFps));
      for(const [index,frame] of a.frames.entries()){
        const forward=a.sourceForwardFrameCount;
        const source=(index<forward?index:2*forward-2-index)+(c.id==='mangler'&&i===0?8:0);
        assert.deepEqual(frame,[source%columns*512,Math.floor(source/columns)*512,512,512]);
      }
      if(c.id==='arianna')assert.ok(a.sourcePath.endsWith('/guard_'+['high','middle','low'][i]+'.png'));
      else if(c.id==='mangler')assert.ok(a.sourcePath.endsWith('/'+['06-block-high','07-block-middle','08-block-low'][i]+'.png'));
      else if(i===1)assert.ok(a.sourcePath.endsWith('/block_medium_spritesheet.png'));
      else if(i===0)assert.ok(a.sourcePath.endsWith('/block-spritesheet.png'));
      else assert.ok(a.sourcePath.endsWith('-parata_bassa.png'));
    }
  }
  for(const [id,label] of [['block-high','Parata alta'],['block-mid','Parata media'],['block-low','Parata bassa']]){
    const f=fixture({page:'moves',search:'?move='+id});
    assert.equal(f.nodes.get('#move-name').textContent,label);
    assert.equal(f.nodes.get('#move-report').hidden,false);
    assert.equal(f.nodes.get('#move-report-link').href,'reports/'+id+'-timing.html');
    assert.equal(f.galleries[0].data.animations.length,7);
    const detail=fixture({page:'character',search:'?id=mangler&anim='+id});
    assert.equal(detail.galleries[0].options.highlightId,id);
  }
  const groups=require('../move-groups.js').group(manifest.characters).map(g=>g.id);assert.equal(groups[0],'idle');assert.ok(groups.indexOf('run')<groups.indexOf('light-punch'));assert.ok(groups.indexOf('get-up')<groups.indexOf('light-kick'));assert.ok(groups.indexOf('light-kick')<groups.indexOf('jump-light-kick'));
});

test('per mossa confronta sette camminate; ricerca distrugge e ricrea la galleria',()=>{
  const f=fixture({page:'moves',search:'?move=walk'}),search=f.nodes.get('#character-search');
  assert.equal(f.nodes.get('#move-name').textContent,'Camminata');
  assert.equal(f.nodes.get('#move-report').hidden,true);
  assert.equal(f.galleries[0].data.animations.length,7);
  assert.ok(f.galleries[0].data.animations.every(a=>a.id==='walk'&&a.characterId&&a.characterName));
  search.value='peiro';search.emit('input');
  assert.equal(f.galleries[0].destroyed,true);assert.equal(f.galleries.at(-1).data.animations.length,1);
  assert.equal(f.galleries.at(-1).data.animations[0].characterId,'peirolo');
  search.value='nessuno';search.emit('input');assert.equal(f.nodes.get('#move-empty').hidden,false);
  assert.equal(f.nodes.get('#move-gallery').hidden,true);
  search.value='';search.emit('input');assert.equal(f.galleries.at(-1).data.animations.length,7);
});

test('URL di personaggio e mossa inesistenti hanno un recupero, senza gallery errate',()=>{
  const c=fixture({page:'character',search:'?id=inesistente'});
  assert.match(c.nodes.get('#character-detail').innerHTML,/Personaggio non trovato/);assert.equal(c.galleries.length,0);
  const m=fixture({page:'moves',search:'?move=inesistente'});
  assert.match(m.nodes.get('#main').innerHTML,/Mossa non trovata/);assert.equal(m.galleries.length,0);
  m.nodes.get('#character-search').emit('input');
});

test('tutte le 21 parate durano 500 ms, includendo ultimo frame, velocità e loop',()=>{
  const {advanceAnimation}=require('../player-core.js');
  for(const c of manifest.characters){
    for(const a of c.animations.filter(a=>a.id.startsWith('block-'))){
      assert.equal(a.durationMs,500);assert.equal(a.guardDurationMs,500);
      assert.equal(a.frameDurations.length,a.frames.length);
      assert.ok(a.frameDurations.every(d=>Math.abs(d-500/a.frames.length)<1e-8));
      assert.ok(Math.abs(a.sourceDurationMs-a.sourceFrameDurations.reduce((n,d)=>n+d,0))<1e-8);
      for(const speed of [.5,1,2]){
        assert.deepEqual(a.frames.at(-1),a.frames[0]);
      assert.equal(a.frames.length,a.sourceFrames.length*2-1);
      const origin={frame:0,remainder:0};
        assert.equal(advanceAnimation(origin,499.99/speed,a,speed,false).ended,false);
        const final=advanceAnimation(origin,500/speed,a,speed,false);
        assert.equal(final.ended,true);assert.equal(final.frame,a.frames.length-1);
        for(const cycle of [1,2,10])assert.equal(advanceAnimation(origin,500*cycle/speed,a,speed,true).frame,0);
      }
    }
  }
});

test('hurt: sequenze Godot di Arianna e taglio basso di Mangler, senza alterare scale o durata',()=>{
  for(const c of manifest.characters){
    for(const [i,id] of ['hurt-high','hurt-medium','hurt-low'].entries()){
      const a=c.animations.find(a=>a.id===id),columns=c.id==='mangler'?4:5;
      let indices=Array.from({length:a.frames.length},(_,j)=>j+(c.id==='mangler'&&i===2?6:0));
      if(c.id==='arianna')indices=i===0?[0,1,2,3,4,5,6,0]:i===1?[0,1,2,3,4,5,6,7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,0];
      assert.deepEqual(a.frames,indices.map(j=>[j%columns*512,Math.floor(j/columns)*512,512,512]));
      assert.equal(a.sourceAnimation,i===1?'hurt_mid':id.replace('-','_'));
      assert.equal(a.loop,false);assert.equal(a.sourceLoop,false);
      assert.equal(a.playbackFps,a.frames.length*2);assert.equal(a.guardDurationMs,undefined);
      assert.equal(a.frameDurations.length,a.frames.length);
      assert.ok(Math.abs(a.frameDurations.reduce((n,d)=>n+d,0)-a.reactionDurationMs)<1e-8);
      if(c.id==='mangler')assert.deepEqual(a.sourceTransform.scale,[.7,.7]);
    }
  }
});

test('hurt nelle gallerie per mossa e per personaggio, con tre voci distinte',()=>{
  for(const [id,label] of [['hurt-high','Hurt alto'],['hurt-medium','Hurt medio'],['hurt-low','Hurt basso']]){
    const f=fixture({page:'moves',search:'?move='+id});
    assert.equal(f.nodes.get('#move-name').textContent,label);
    assert.equal(f.galleries[0].data.animations.length,7);
    assert.equal(f.nodes.get('#move-report').hidden,false);
    assert.equal(f.nodes.get('#move-report-link').href,'reports/'+id+'-timing.html');
    const detail=fixture({page:'character',search:'?id=mangler&anim='+id});
    assert.equal(detail.galleries[0].options.highlightId,id);
  }
});

test('report delle tre parate: HTML, CSV e 21 pose con link validi',()=>{
  for(const id of ['block-high','block-mid','block-low']){
    const html=fs.readFileSync(path.join(root,'reports',id+'-timing.html'),'utf8');
    const csv=fs.readFileSync(path.join(root,'reports',id+'-timing.csv'),'utf8');
    assert.match(html,/500 ms/);assert.equal((html.match(/<tr data-character=/g)??[]).length,7);
    assert.equal(csv.trim().split(/\r?\n/).length,8);
    for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g))assert.ok(fs.existsSync(path.resolve(root,'reports',match[1].split('?')[0])),match[1]);
  }
});

test('tutte le reazioni hurt durano 500 ms incluso ultimo frame, a ogni velocità e nei loop',()=>{
  const {advanceAnimation}=require('../player-core.js');
  for(const c of manifest.characters){
    for(const a of c.animations.filter(a=>a.id.startsWith('hurt-')&&!a.remainingImport)){
      assert.equal(a.durationMs,500);assert.equal(a.reactionDurationMs,500);
      assert.ok(a.frameDurations.every(d=>Math.abs(d-500/a.frames.length)<1e-8));
      assert.ok(Math.abs(a.sourceFrameDurations.reduce((n,d)=>n+d,0)-a.sourceDurationMs)<1e-8);
      for(const speed of [.5,1,2]){
        const origin={frame:0,remainder:0};
        assert.equal(advanceAnimation(origin,499.99/speed,a,speed,false).ended,false);
        const end=advanceAnimation(origin,500/speed,a,speed,false);
        assert.equal(end.ended,true);assert.equal(end.frame,a.frames.length-1);
        for(const cycle of [1,2,10])assert.equal(advanceAnimation(origin,500*cycle/speed,a,speed,true).frame,0);
      }
    }
  }
});

test('report hurt: quattro HTML/CSV e 28 confronti di pose, con sequenze e collegamenti validi',()=>{
  for(const id of ['hurt-high','hurt-medium','hurt-low','hurt-crouched']){
    const html=fs.readFileSync(path.join(root,'reports',id+'-timing.html'),'utf8');
    assert.match(html,/500 ms/);assert.equal((html.match(/<tr data-character=/g)??[]).length,7);
    const csv=fs.readFileSync(path.join(root,'reports',id+'-timing.csv'),'utf8');
    assert.equal(csv.trim().split(/\r?\n/).length,8);
    for(const c of manifest.characters){
      const png=fs.readFileSync(path.join(root,'reports',id+'-poses',c.id+'.png'));
      assert.equal(png.readUInt32BE(16),1536);assert.equal(png.readUInt32BE(20),512);
    }
    for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g))assert.ok(fs.existsSync(path.resolve(root,'reports',match[1].split('?')[0])),match[1]);
  }
});

test('Accovacciata: sorgenti Godot e durata completa di 250 ms per tutti i personaggi',()=>{
  const {advanceAnimation}=require('../player-core.js');
  for(const c of manifest.characters){
    const a=c.animations.find(a=>a.id==='crouch');
    assert.equal(a.sourceAnimation,'crouch');assert.equal(a.loop,false);
    assert.equal(a.sourceFps,['arianna','mangler'].includes(c.id)?48:24);
    assert.equal(a.durationMs,250);assert.equal(a.poseDurationMs,250);
    assert.deepEqual(a.frames,Array.from({length:a.frames.length},(_,i)=>[i%5*512,Math.floor(i/5)*512,512,512]));
    assert.ok(a.sourcePath.endsWith(c.id==='arianna'?'/basic-moves/crouched.png':c.id==='mangler'?'/04-crouching.png':'/crouch-spritesheet.png'));
    for(const speed of [.5,1,2]){
      const origin={frame:0,remainder:0};
      assert.equal(advanceAnimation(origin,249.99/speed,a,speed,false).ended,false);
      assert.equal(advanceAnimation(origin,250/speed,a,speed,false).ended,true);
      assert.equal(advanceAnimation(origin,2500/speed,a,speed,true).frame,0);
    }
  }
  const f=fixture({page:'moves',search:'?move=crouch'});
  assert.equal(f.nodes.get('#move-name').textContent,'Accovacciata');assert.equal(f.galleries[0].data.animations.length,7);
  assert.equal(f.nodes.get('#move-report-link').href,'reports/crouch-timing.html');
  const detail=fixture({page:'character',search:'?id=mangler&anim=crouch'});
  assert.equal(detail.galleries[0].options.highlightId,'crouch');
});

test('report Accovacciata con sette righe, CSV e confronti di pose disponibili',()=>{
  const html=fs.readFileSync(path.join(root,'reports/crouch-timing.html'),'utf8');
  assert.match(html,/250 ms/);assert.equal((html.match(/<tr data-character=/g)??[]).length,7);
  assert.equal(fs.readFileSync(path.join(root,'reports/crouch-timing.csv'),'utf8').trim().split(/\r?\n/).length,8);
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.ok(fs.existsSync(path.resolve(root,'reports',match[1].split('?')[0])));
});

test('hurt_crouched: dodici frame Godot, scala corretta di Mangler e 500 ms per tutti',()=>{
  const {advanceAnimation}=require('../player-core.js');
  for(const c of manifest.characters){
    const a=c.animations.find(a=>a.id==='hurt-crouched');
    assert.equal(a.name,'Hurt accovacciato');assert.equal(a.sourceAnimation,'hurt_crouched');
    assert.equal(a.sourceSetupPath,'scripts/Fighter.gd');assert.equal(a.sourceFps,24);
    assert.equal(a.playbackFps,24);assert.equal(a.durationMs,500);assert.equal(a.loop,false);
    assert.match(a.sourcePath,/hurt_crouched_spritesheet.png$/);
    assert.deepEqual(a.frames,Array.from({length:12},(_,i)=>[i%5*512,Math.floor(i/5)*512,512,512]));
    for(const speed of [.5,1,2]){
      const origin={frame:0,remainder:0};
      assert.equal(advanceAnimation(origin,499.99/speed,a,speed,false).ended,false);
      assert.equal(advanceAnimation(origin,500/speed,a,speed,false).ended,true);
    }
    if(c.id==='mangler')assert.deepEqual(a.sourceTransform.scale,[.85,.85]);
  }
});

test('hurt_crouched collegato a report e gallerie per mossa e per personaggio',()=>{
  const f=fixture({page:'moves',search:'?move=hurt-crouched'});
  assert.equal(f.nodes.get('#move-name').textContent,'Hurt accovacciato');
  assert.equal(f.galleries[0].data.animations.length,7);
  assert.equal(f.nodes.get('#move-report-link').href,'reports/hurt-crouched-timing.html');
  const detail=fixture({page:'character',search:'?id=mangler&anim=hurt-crouched'});
  assert.equal(detail.galleries[0].options.highlightId,'hurt-crouched');
});
