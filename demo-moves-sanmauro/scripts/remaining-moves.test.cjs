const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
const source=JSON.parse(fs.readFileSync(path.join(root,'assets/remaining-moves-source.json'),'utf8'));
const timing=JSON.parse(fs.readFileSync(path.join(root,'assets/remaining-moves-timing.json'),'utf8'));
const {advanceAnimation}=require('../player-core.js');

test('tutte le normali mancanti importate, senza prese special super o combo',()=>{
  assert.equal(source.records.length,159);
  assert.deepEqual(source.exclusions,['special','super','grab','combo','charged-variants']);
  const counts={arianna:38,bue:39,mangler:38,mileto:39,oscare:39,peirolo:39,torpe:39};
  for(const c of data.characters){
    assert.equal(c.animations.length,counts[c.id]);
    assert.equal(new Set(c.animations.map(a=>a.id)).size,c.animations.length);
    for(const strength of ['light','medium','heavy']){
      for(const move of [`${strength}-kick`,`crouched-${strength}-punch`,`crouched-${strength}-kick`,`jump-${strength}-punch`,`jump-${strength}-kick`]){
        assert.ok(c.animations.some(a=>a.id===move),c.id+'/'+move);
      }
    }
    for(const a of c.animations){
      assert.doesNotMatch(a.id,/grab|special|super|combo|charged/);
      if(!a.remainingImport)continue;
      const record=source.records.find(r=>r.characterId===c.id&&r.id===a.id);
      assert.ok(record);assert.equal(a.sourceAnimation,record.sourceAnimation);
      assert.deepEqual(a.sourceFrames,record.frames);
      assert.deepEqual(a.sourceFrameDurations,record.sourceFrameDurations);
      const bytes=fs.readFileSync(path.join(root,a.image));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sourceSha256);
      for(const [x,y,w,h] of a.frames){
        assert.ok(x>=0&&y>=0&&x+w<=a.sheetWidth&&y+h<=a.sheetHeight);
      }
    }
  }
});

test('light medium heavy: estensione e ciclo identici ai pugni in tutti i loop e velocità',()=>{
  for(const c of data.characters)for(const a of c.animations.filter(a=>a.remainingImport&&a.attackStrength)){
    const spec=timing.strengths[a.attackStrength];
    assert.equal(a.durationMs,spec.durationMs);assert.equal(a.impactMs,spec.impactMs);
    assert.equal(a.returnToIdleMs,a.durationMs);assert.deepEqual(a.frames.at(-1),a.frames[0]);
    assert.equal(a.frameDurations.at(-1),0);assert.ok(a.frameDurations.slice(0,-1).every(d=>d>0));
    const entry=timing.items.find(i=>i.characterId===c.id&&i.id===a.id);
    assert.equal(entry.framesSha256,createHash('sha256').update(JSON.stringify(a.frames)).digest('hex'));
    for(const speed of [.5,1,2]){
      for(const cycle of [0,1,10]){
        const before=advanceAnimation({frame:0,remainder:0},(cycle*a.durationMs+a.impactMs-.01)/speed,a,speed,true);
        const peak=advanceAnimation({frame:0,remainder:0},(cycle*a.durationMs+a.impactMs)/speed,a,speed,true);
        assert.equal(before.frame,a.impactFrame-1,c.id+'/'+a.id);assert.equal(peak.frame,a.impactFrame);
      }
      const end=advanceAnimation({frame:0,remainder:0},a.durationMs/speed,a,speed,false);
      assert.equal(end.ended,true);assert.equal(end.frame,a.frames.length-1);
      assert.equal(advanceAnimation({frame:0,remainder:0},a.durationMs/speed,a,speed,true).frame,0);
    }
  }
});

test('Mangler conserva scale effettive: legacy, reworked e calci aerei',()=>{
  const c=data.characters.find(c=>c.id==='mangler');
  const get=id=>c.animations.find(a=>a.id===id);
  for(const id of ['run','backwalk','back-jump','knockdown','get-up'])assert.deepEqual(get(id).sourceTransform.scale,[.7,.7]);
  for(const id of ['light-kick','medium-kick','heavy-kick','crouched-light-punch'])assert.deepEqual(get(id).sourceTransform.scale,[.85,.85]);
  for(const id of ['jump-light-kick','jump-medium-kick','jump-heavy-kick'])assert.deepEqual(get(id).sourceTransform.scale,[.8,.8]);
  assert.deepEqual(get('jump-heavy-punch').sourceTransform.scale,[.7,.7]);
});

test('report locali e pose per tutte le mosse aggiunte, senza Combo',()=>{
  const groups=new Map();
  for(const c of data.characters)for(const a of c.animations.filter(a=>a.remainingImport)){
    const list=groups.get(a.id)||[];list.push(c);groups.set(a.id,list);
  }
  assert.equal(groups.size,23);
  for(const [id,characters] of groups){
    const html=fs.readFileSync(path.join(root,'reports',id+'-timing.html'),'utf8');
    assert.equal((html.match(/data-character=/g)||[]).length,characters.length);
    assert.equal(fs.readFileSync(path.join(root,'reports',id+'-timing.csv'),'utf8').trim().split(/\r?\n/).length,characters.length+1);
    for(const c of characters)assert.ok(fs.existsSync(path.join(root,'reports',id+'-poses',c.id+'.png')));
  }
  const groupsModule=require('../move-groups.js').group(data.characters);
  assert.ok(groupsModule.every(g=>!g.id.includes('combo')));
  assert.ok(groupsModule.every(g=>!g.id.endsWith('-charged')));
});
