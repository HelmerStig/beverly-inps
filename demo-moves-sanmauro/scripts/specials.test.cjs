const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const data=require('../specials-catalog.js');
const scene=require('../specials-scene.js');
const stage=require('../stages-catalog.js')[0];
const root=path.resolve(__dirname,'..');

test('proiettili rialzati di 30 px, senza spostare personaggi o cambiare timing e scale',()=>{
  for(const move of ['baseball','dog','cats']){
    const raised=scene.plan(data,stage,move,'light',7),original=scene.plan({...data,preview:{projectileOffsetY:0}},stage,move,'light',7);
    assert.equal(raised.end,original.end);
    const time=raised.projectiles[0].start+100;
    const a=scene.sample(raised,time),b=scene.sample(original,time);
    for(const actor of a.actors){
      const before=b.actors.find(v=>v.id===actor.id);
      assert.equal(actor.y,before.y-(actor.projectile?30:0));
      assert.equal(actor.x,before.x);assert.equal(actor.scale,before.scale);
    }
  }
});

test('Arianna: due special e una super autonome; nessun asset di Peirò inventato',()=>{
  const arianna=JSON.parse(fs.readFileSync(path.join(root,'assets/specials/arianna/specials.json'),'utf8'));
  assert.deepEqual(data.animations.filter(a=>!a.characterId),arianna.animations);
  assert.ok(!data.characters.some(c=>c.id==='peirolo'));
  assert.deepEqual(data.characters[0].moves.map(m=>[m.id,m.kind]),[['baseball','Special'],['dog','Special'],['cats','Super']]);
  assert.equal(arianna.animations.length,16);
  for(const a of arianna.animations){
    const bytes=fs.readFileSync(path.join(root,a.image));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sourceSha256);
    assert.equal(bytes.readUInt32BE(16),a.sheetWidth);assert.equal(bytes.readUInt32BE(20),a.sheetHeight);
    assert.equal(a.footContacts.length,a.frames.length);
    for(const [x,y,w,h] of a.frames)assert.ok(x>=0&&y>=0&&x+w<=a.sheetWidth&&y+h<=a.sheetHeight);
  }
  const a=id=>data.animations.find(a=>a.id===id);
  assert.equal(a('baseball').frames.length,49);assert.equal(a('baseball').playbackFps,48);
  assert.deepEqual(a('dog').sourceIndices,[...Array.from({length:25},(_,i)=>i),...Array.from({length:24},(_,i)=>23-i)]);
  assert.deepEqual(a('cats').sourceIndices,Array.from({length:34},(_,i)=>i+9));
  assert.deepEqual(a('bateau-run').emptySourceFrames,[48]);assert.deepEqual(a('bateau-run').frames[48],a('bateau-run').frames[47]);
  assert.equal(a('tullio-run').frames.length,42);assert.equal(a('tilda-run').frames.length,42);assert.equal(a('telma-run').frames.length,49);
});

test('mazza: spawn al frame Godot, tre velocità, crescita e collisione visiva sul bersaglio',()=>{
  let previous=Infinity;
  for(const strength of ['light','medium','heavy']){
    const plan=scene.plan(data,stage,'baseball',strength,5),q=plan.projectiles[0];
    assert.ok(Math.abs(plan.spawnMs-23/48*1000)<1e-8);
    assert.equal(scene.sample(plan,plan.spawnMs-.01).actors.filter(a=>a.projectile).length,0);
    const first=scene.sample(plan,plan.spawnMs).actors.find(a=>a.projectile);
    assert.equal(first.animation,'tornado');assert.ok(Math.abs(first.scale-.08*plan.unit)<1e-8);
    assert.ok(plan.events[0].time<previous);previous=plan.events[0].time;
    assert.equal(scene.sample(plan,plan.events[0].time).hits.length,1);
    assert.ok(q.end-plan.spawnMs<=4000);
    assert.equal(scene.sample(plan,plan.cast.durationMs).actors[0].animation,'arianna-idle');
  }
});

test('Bateau: corre, attacca al frame 17, recupera e torna a correre prima di uscire',()=>{
  const plan=scene.plan(data,stage,'dog'),q=plan.projectiles[0];
  assert.equal(plan.spawnMs,500);
  const actor=t=>scene.sample(plan,t).actors.find(a=>a.projectile);
  assert.equal(actor(q.start).animation,'bateau-run');
  assert.equal(actor(q.attackStart).animation,'bateau-attack');
  assert.equal(scene.frame(plan.animations['bateau-attack'],actor(q.hitMs).time,false),17);
  assert.equal(actor(q.recoveryStart).animation,'bateau-back-to-run');
  if(q.runStart<q.end)assert.equal(actor(q.runStart).animation,'bateau-run');
  else assert.equal(actor(q.runStart),undefined,'esce subito se il recupero lo ha già portato oltre il bordo');
  assert.equal(scene.sample(plan,q.end).actors.filter(a=>a.projectile).length,0);
  assert.equal(scene.sample(plan,q.hitMs).actors.find(a=>a.id==='oscare').animation,'oscare-hurt');
});

test('super: 12 gatti, quattro per profilo, onde ripetibili e tre attacchi o salto al volto',()=>{
  const plan=scene.plan(data,stage,'cats','light',7),same=scene.plan(data,stage,'cats','light',7),other=scene.plan(data,stage,'cats','light',11);
  assert.equal(plan.projectiles.length,12);assert.ok(Math.abs(plan.spawnMs-10/24*1000)<1e-8);
  for(const id of ['tullio','tilda','telma'])assert.equal(plan.projectiles.filter(q=>q.cat===id).length,4);
  assert.deepEqual(plan.projectiles,same.projectiles);assert.notDeepEqual(plan.projectiles,other.projectiles);
  assert.ok(plan.projectiles.some(q=>q.face));assert.ok(plan.projectiles.some(q=>!q.face));
  const expected=plan.projectiles.reduce((n,q)=>n+(q.face?1:3),0);assert.equal(plan.events.length,expected);
  for(const q of plan.projectiles){
    assert.ok(q.start>=plan.spawnMs);assert.ok(q.end>q.exitStart);
    const actor=scene.sample(plan,q.attackStart).actors.find(a=>a.id===q.id);
    assert.equal(actor.animation,q.cat+(q.face?'-jump':'-attack'));
  }
  assert.equal(scene.sample(plan,plan.end).actors.filter(a=>a.projectile).length,0);
});

test('tutte le sequenze di scena mantengono coordinate e frame validi per riproduzione e scrub',()=>{
  for(const move of ['baseball','dog','cats']){
    const plan=scene.plan(data,stage,move,'heavy',7);
    for(let t=0;t<plan.end+100;t+=31){
      for(const actor of scene.sample(plan,t).actors){
        assert.ok([actor.x,actor.y,actor.scale,actor.anchorX,actor.anchorY,actor.time].every(Number.isFinite),move);
        assert.ok(actor.scale>0);
        if(actor.projectile){const a=plan.animations[actor.animation],index=scene.frame(a,actor.time);assert.ok(index>=0&&index<a.frames.length);}
      }
    }
  }
});

test('sezione locale con stage, CRT, fullscreen, controlli e report collegati',()=>{
  const html=fs.readFileSync(path.join(root,'specials.html'),'utf8');
  assert.match(html,/<h1>Special e Super<\/h1>/);
  for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g))if(!m[1].startsWith('#'))assert.ok(fs.existsSync(path.join(root,m[1])));
  const app=fs.readFileSync(path.join(root,'specials-app.js'),'utf8');
  for(const text of ['StageFullscreen.install','StageCrt.install','StageEffects.install','MovesGallery.install','setSceneRenderer','prefers-reduced-motion'])assert.ok(app.includes(text));
  const report=fs.readFileSync(path.join(root,'reports/arianna-specials.html'),'utf8');
  assert.match(report,/12 gatti/);assert.match(report,/cella finale trasparente/);
});
