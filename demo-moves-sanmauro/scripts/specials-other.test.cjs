const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const data=require('../specials-catalog.js'),scene=require('../specials-other-scene.js'),base=require('../stages-catalog.js')[0],roster=require('../assets/manifest.json');
const root=path.resolve(__dirname,'..'),assets=Object.fromEntries(data.animations.map(a=>[a.id,a]));
function stage(cid){const make=(id,x)=>{const c=roster.characters.find(c=>c.id===id),a=c.animations.find(a=>a.id==='idle');return {characterId:id,x,groundY:1025,scale:a.normalizedPreview.scale[0]*4/3*c.stageHeightMultiplier,anchorX:a.normalizedPreview.anchor[0],anchorY:a.normalizedPreview.anchor[1]};};return {...base,fighters:[make(cid,675),make(cid==='oscare'?'arianna':'oscare',1890)]};}
test('Macchia = Torpe; 14 mosse e Super nuove solo di Mangler, Peirò escluso',()=>{
  assert.equal(data.characters.find(c=>c.id==='torpe').alias,'Macchia');
  assert.equal(data.characters.flatMap(c=>c.moves).length,14);
  assert.deepEqual(data.characters.filter(c=>c.moves.some(m=>m.kind==='Super')).map(c=>c.id),['arianna','mangler']);
  assert.ok(!data.characters.some(c=>c.id==='peirolo'));
});
test('asset locali originali con hash, frame entro PNG e rapporti umani conservati',()=>{
  for(const c of data.characters.slice(1)){
    assert.ok(fs.existsSync(path.join(root,'reports',c.id+'-specials.html')));
    const idle=roster.characters.find(r=>r.id===c.id).animations.find(a=>a.id==='idle');
    for(const m of c.moves)for(const id of [...m.phases,...m.projectiles])assert.ok(assets[id],id);
    for(const a of data.animations.filter(a=>a.characterId===c.id)){
      const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
      assert.equal(hash(a.sourceImage),a.sourceSha256,a.id);
      assert.equal(hash(a.image),a.imageSha256,a.id);
      assert.equal(a.frames.length,a.frameDurations.length);assert.equal(a.frames.length,a.footContacts.length);
      assert.ok(Math.abs(a.frameDurations.reduce((s,t)=>s+t,0)-a.durationMs)<1e-6);
      for(const [x,y,w,h]of a.frames)assert.ok(x>=0&&y>=0&&x+w<=a.sheetWidth&&y+h<=a.sheetHeight,a.id);
      if(a.normalizedPreview){assert.deepEqual(a.normalizedPreview.anchor,idle.normalizedPreview.anchor);assert.deepEqual(a.sourceScale,idle.sourceTransform.scale);}
    }
  }
});
test('accensione Oscare, sostituzione frame di lancio e timeline TRES Torpe',()=>{
  assert.equal(assets.cigarette.sourceIndices[18],19);assert.equal(assets.cigarette.frames.length,29);
  const p=scene.plan(data,stage('oscare'),'cigarette');assert.ok(Math.abs(p.spawnMs-(20+18)/60*1000)<1e-6);
  assert.equal(scene.sample(p,100).actors[0].animation,'cigarette-light');
  assert.equal(scene.sample(p,400).actors[0].animation,'cigarette');
  assert.equal(assets.bottle.frames.length,64);assert.equal(assets.welding.frames.length,64);
  assert.notEqual(assets.bottle.image,assets.bottle.sourceImage);
  assert.ok(Math.abs(scene.plan(data,stage('torpe'),'bottle').spawnMs-37/64*1000)<1e-6);
});
test('Super Mangler: corsa, distanza di arresto, due rullate con otto impatti',()=>{
  const p=scene.plan(data,stage('mangler'),'drums');assert.equal(p.events.length,8);
  assert.equal(scene.sample(p,p.rush+50).actors[0].animation,'drums-rotate');
  assert.equal(scene.sample(p,p.contact+100).actors[0].animation,'drums-roll');
  assert.equal(scene.sample(p,p.contact+100).actors[0].x,p.target.x-130*p.unit);
  assert.equal(scene.sample(p,p.rollEnd+100).actors[1].animation,'target-ko');
  assert.equal(scene.sample(p,p.rollEnd+p.knockdownMs+100).actors[1].animation,'target-recovery');
  assert.ok(Math.abs(p.rollEnd-p.contact-1000)<1e-6);
});
test('cantanti: materializzazione, corsa, tre colpi, uscita dopo la sequenza corretta',()=>{
  for(const move of ['tom','baglioni']){
    const p=scene.plan(data,stage('bue'),move),q=p.projectiles[0];assert.equal(p.events.length,3);assert.equal(p.spawnMs,150);
    assert.equal(scene.sample(p,q.start+10).actors.at(-1).animation,move+'-materialize');
    assert.equal(scene.sample(p,q.attack+10).actors.at(-1).animation,move+'-slaps');
    assert.equal(scene.sample(p,q.exit+10).actors.at(-1).animation,move+'-run');
  }
});
test('forza modifica velocità; bottiglia segue arco e ruota; saldatura emette particelle',()=>{
  for(const [cid,move]of [['mangler','cymbals'],['oscare','cigarette'],['torpe','bottle'],['mileto','guitar']]){
    const light=scene.plan(data,stage(cid),move,'light'),heavy=scene.plan(data,stage(cid),move,'heavy');assert.ok(heavy.projectiles[0].speed>light.projectiles[0].speed);
  }
  const p=scene.plan(data,stage('torpe'),'bottle'),actor=scene.sample(p,p.spawnMs+200).actors.find(a=>a.projectile);assert.ok(actor.rotation>Math.PI/2);assert.ok(Number.isFinite(actor.y));
  const weld=scene.plan(data,stage('torpe'),'welding');assert.ok(scene.sample(weld,weld.spawnMs+100).particles.length>0);
});
test('tutte le nuove mosse: scrub deterministico, coordinate e frame validi, termine finito',()=>{
  for(const c of data.characters.slice(1))for(const m of c.moves)for(const strength of ['light','medium','heavy']){
    const p=scene.plan(data,stage(c.id),m.id,strength);assert.ok(Number.isFinite(p.end)&&p.end>0);
    for(let t=0;t<p.end+100;t+=73){
      const sample=scene.sample(p,t);assert.deepEqual(sample,scene.sample(p,t));
      for(const a of sample.actors){assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y)&&a.scale>0,m.id);assert.ok(assets[a.animation]||['caster-idle','target-idle','target-hurt','target-ko','target-recovery'].includes(a.animation),a.animation);}
    }
  }
});

test('Baglioni e Tom Waits: altri 20 px verso alto, senza cambiare Bue o timing',()=>{
  for(const move of ['baglioni','tom']){
    const raised=scene.plan(data,stage('bue'),move);
    const original=scene.plan({...data,parameters:{...data.parameters,[move]:{...data.parameters[move],previewOffsetY:0}}},stage('bue'),move);
    assert.equal(raised.projectileOffsetY,-50);assert.equal(raised.end,original.end);
    const time=raised.spawnMs+100,a=scene.sample(raised,time),b=scene.sample(original,time);
    for(const actor of a.actors){const before=b.actors.find(v=>v.id===actor.id);assert.equal(actor.y,before.y-(actor.projectile?20:0));assert.equal(actor.scale,before.scale);assert.equal(actor.x,before.x);}
  }
  assert.equal(scene.plan(data,stage('torpe'),'bottle').projectileOffsetY,-30);
});

test('renderer: ombra su entrambi i piedi di Bue, piano locale dei cantanti e appoggio singolo',()=>{
  const renderScene=require('../specials-scene.js'),projection=require('../stage-player.js').shadowProjection;
  const contacts=JSON.parse(fs.readFileSync(path.join(root,'assets/stages/Piazza Europa/foot-contacts.json'),'utf8'));
  const idle=roster.characters.find(c=>c.id==='bue').animations.find(a=>a.id==='idle');
  const animations={'bue-idle':{...idle,footContacts:contacts.items.find(c=>c.characterId==='bue').frames},'tom-run':assets['tom-run'],'one-foot':{...idle,footContacts:[[ {x:330,y:410,width:20} ]]}};
  const calls=[],noop=()=>{},context={clearRect:noop,drawImage:noop,save:noop,restore:noop,fillRect:noop,translate:noop,scale:noop,rotate:noop,transform:noop};
  const env={document:{createElement(){return {getContext(){return context;}};}},StagesPlayer:{shadowProjection(f,style,feet,camera){calls.push({f,feet});return projection(f,style,feet,camera);}}};
  const actors=Object.keys(animations).map((animation,i)=>({id:animation,animation,time:0,x:675+i*200,y:i===1?800:1025,scale:1.4,anchorX:256,anchorY:256,projectile:i===1}));
  const renderer=renderScene.renderer(animations,Object.fromEntries(Object.keys(animations).map(k=>[k,{}])),env);
  renderer.draw(context,{actors,hits:[]},{camera:315,effects:{shadows:.8},stage:base,sceneTime:0});
  assert.equal(calls.length,3);assert.equal(calls[0].feet.length,2);assert.equal(calls[1].f.groundY,800);assert.equal(calls[2].feet.length,1);
  for(const {f,feet}of calls){const [a,b,c,d,x,y]=projection(f,{shearX:.5,flattenY:.11},feet,315);for(const foot of feet){const u=foot.x-f.anchorX,v=foot.y-f.anchorY;assert.ok(Math.abs(a*u+c*v+x-(f.x-315+f.scale*u))<1e-8);assert.ok(Math.abs(b*u+d*v+y-(f.groundY+f.scale*v))<1e-8);}}
  renderer.destroy();
});

test('tutte le sagome Special/Super: appoggi fermi in ogni frame, anche riflessi',()=>{
  const {shadowProjection}=require('../stage-player.js');
  for(const a of data.animations)for(const feet of a.footContacts){
    assert.ok(feet.length===1||feet.length===2,a.id);
    for(const flipX of [false,true]){
      const fighter={x:900,groundY:1025,anchorX:a.frameWidth/2,anchorY:a.frameHeight/2,scale:1.6,flipX};
      const [xx,xy,yx,yy,tx,ty]=shadowProjection(fighter,{shearX:.5,flattenY:.11},feet,315);
      for(const foot of feet){const u=foot.x-fighter.anchorX,v=foot.y-fighter.anchorY;assert.ok(Math.abs(xx*u+yx*v+tx-(585+(flipX?-1:1)*1.6*u))<1e-7,a.id);assert.ok(Math.abs(xy*u+yy*v+ty-(1025+1.6*v))<1e-7,a.id);}
    }
  }
});
