const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {cloudPositions,install,dustParticles,shadowProjection}=require('../stage-player.js');
const stages=require('../stages-catalog.js');
const demo=path.resolve(__dirname,'..');
const folder=path.join(demo,'assets/stages/Piazza Europa');
const manifest=JSON.parse(fs.readFileSync(path.join(demo,'assets/manifest.json'),'utf8'));

test('scene aggiuntive continuano con nuvole in pausa e rispettano il movimento ridotto',async()=>{
  const f=fixture();await f.load();
  let calls=0;f.player.setSceneRenderer(()=>calls++);
  f.button.listeners.click();f.tick(0);f.tick(100);assert.ok(calls>=3);
  assert.ok(f.callbacks.size>0,'la scena continua anche con nuvole ferme');
  f.player.setSceneRenderer(null);f.tick(200);assert.equal(f.callbacks.size,0);f.player.destroy();
  const reduced=fixture(true);await reduced.load();reduced.player.setSceneRenderer(()=>{});
  assert.equal(reduced.callbacks.size,0);reduced.player.setSceneMotion(true);assert.ok(reduced.callbacks.size>0);reduced.player.destroy();
});

test('Piazza Europa mantiene le cinque immagini native, i tre piani nuvole e il fondale davanti',()=>{
  const stage=stages[0];assert.equal(stage.name,'Piazza Europa');assert.equal(stage.layers.length,5);
  assert.deepEqual([stage.width,stage.height,stage.viewportWidth],[2550,1080,1920]);
  for(const layer of stage.layers){
    const png=fs.readFileSync(path.join(demo,layer.image));
    assert.equal(png.readUInt32BE(16),layer.width);assert.equal(png.readUInt32BE(20),layer.height);
  }
  assert.deepEqual(stage.layers.map(l=>l.zIndex),[0,2,3,4,4]);
  assert.deepEqual(stage.layers.filter(l=>l.speed).map(l=>l.speed),[6,12,20]);
  assert.match(stage.layers.at(-1).image,/piazza-europa.png$/);
  assert.match(stage.layers[3].image,/03-nuvole-vicine.png$/);
  assert.deepEqual(stage,JSON.parse(fs.readFileSync(path.join(folder,'stage.json'),'utf8')));
  for(const elapsed of [0,1000,1e8]){
    const xs=cloudPositions(2550,5000,elapsed,20);
    assert.ok(xs[0]<=0&&xs.at(-1)+5000>=2550,'loop senza buchi');
  }
});

test('Arianna a sinistra e Oscare riflesso: altezze in centimetri applicate sopra le scale normalizzate',()=>{
  assert.deepEqual(stages[0].fighters.map(f=>[f.characterId,f.flipX]),[['arianna',false],['oscare',true]]);
  for(const fighter of stages[0].fighters){
    const character=manifest.characters.find(c=>c.id===fighter.characterId),idle=character.animations[0];
    assert.ok(Math.abs(fighter.scale*idle.medianContentHeight-344*4/3*character.heightCm/165)<1e-8);
    assert.equal(fighter.heightCm,character.heightCm);
    assert.deepEqual([fighter.anchorX,fighter.anchorY],idle.preview.anchor);
    assert.equal(fighter.groundY,1025);
  }
});

test('altezze definitive salvate per tutti e sette, proporzioni delle mosse e dati Godot conservati',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(demo,'assets/character-proportions.json'),'utf8'));
  assert.deepEqual(config.heightsCm,{arianna:165,bue:170,mangler:183,mileto:170,oscare:183,peirolo:170,torpe:175});
  assert.deepEqual(manifest.characterProportions,config);
  for(const character of manifest.characters){
    assert.equal(character.heightCm,config.heightsCm[character.id]);
    assert.equal(character.stageHeightMultiplier,character.heightCm/165);
  }
  const [arianna,oscare]=stages[0].fighters;
  const idleHeight=f=>manifest.characters.find(c=>c.id===f.characterId).animations[0].medianContentHeight*f.scale;
  assert.ok(Math.abs(idleHeight(oscare)/idleHeight(arianna)-183/165)<1e-8);
});

test('ombre animate: entrambi i piedi restano agganciati per tutti i personaggi idle, anche dopo drag e riflesso',()=>{
  const data=JSON.parse(fs.readFileSync(path.join(folder,'foot-contacts.json'),'utf8'));
  const manifest=JSON.parse(fs.readFileSync(path.join(demo,'assets/manifest.json'),'utf8'));
  assert.deepEqual(data.items.map(i=>i.characterId),manifest.characters.map(c=>c.id));
  for(const character of manifest.characters){
    const idle=character.animations.find(a=>a.id==='idle');
    const fighter={characterId:character.id,x:675,groundY:1025,scale:idle.normalizedPreview.scale[0]*4/3*character.stageHeightMultiplier,anchorX:idle.normalizedPreview.anchor[0],anchorY:idle.normalizedPreview.anchor[1]};
    const item=data.items.find(i=>i.characterId===fighter.characterId);
    assert.equal(item.frames.length,idle.frames.length);
    for(const id of ['hurt-high','knockdown','get-up']){
      const animation=character.animations.find(a=>a.id===id),contact=item.animations[id];
      assert.equal(contact.frames.length,animation.frames.length);
      assert.equal(contact.pngSha256,createHash('sha256').update(fs.readFileSync(path.join(demo,contact.image))).digest('hex'));
    }
    assert.equal(item.pngSha256,createHash('sha256').update(fs.readFileSync(path.join(demo,item.image))).digest('hex'));
    for(const feet of item.frames){
      assert.equal(feet.length,2);
      for(const camera of [0,315,630])for(const flipX of [false,true]){
        fighter.flipX=flipX;
        const [a,b,c,d,tx,ty]=shadowProjection(fighter,stages[0].shadow,feet,camera);
        for(const foot of feet){
          const u=foot.x-fighter.anchorX,v=foot.y-fighter.anchorY;
          assert.ok(Math.abs(a*u+c*v+tx-(fighter.x-camera+(fighter.flipX?-1:1)*fighter.scale*u))<1e-8);
          assert.ok(Math.abs(b*u+d*v+ty-(fighter.groundY+fighter.scale*v))<1e-8);
        }
      }
    }
  }
});

test('player: idle a 24 fps, riflesso, nuvole autonome, ombre sincronizzate, drag e filtri',async()=>{
  const f=fixture(false,true);await f.load();
  assert.equal(f.images.length,7);assert.deepEqual([f.canvas.width,f.canvas.height],[1920,1080]);
  assert.deepEqual(f.transforms.slice(-4),[
    ['translate',360,1025],['scale',stages[0].fighters[0].scale,stages[0].fighters[0].scale],
    ['translate',1575,1025],['scale',-stages[0].fighters[1].scale,stages[0].fighters[1].scale]
  ]);
  f.player.setEffects({shadows:.8,color:.35,fog:.65,dust:1});
  assert.equal(f.buffers.length,4);assert.equal(dustParticles(2550,1080,0,1).length,160);
  f.tick(0);f.tick(100);
  const frame=f.buffers[0].calls.filter(c=>c[0]==='draw').at(-1).slice(2,6);
  assert.deepEqual(frame,[1024,0,512,512]);
  assert.deepEqual(f.buffers[2].calls.filter(c=>c[0]==='draw').at(-1).slice(2,6),frame);
  const cloud=f.draws.filter(d=>d[0]===f.images[1]).at(-1)[1];
  f.button.listeners.click();f.tick(200);f.tick(300);
  assert.equal(f.draws.filter(d=>d[0]===f.images[1]).at(-1)[1],cloud);
  assert.deepEqual(f.buffers[0].calls.filter(c=>c[0]==='draw').at(-1).slice(2,6),[2048,0,512,512]);
  f.canvas.listeners.keydown({key:'End',preventDefault(){}});
  assert.deepEqual(f.transforms.slice(-4)[0],['translate',45,1025]);
  let post=false;f.player.setPostProcess(()=>post=true);assert.equal(post,true);
  f.player.destroy();assert.equal(f.callbacks.size,0);assert.ok(f.buffers.every(b=>b.width===0));
});

test('movimento ridotto ferma idle, nuvole e polvere; immagini mancanti producono uno stato visibile',async()=>{
  const f=fixture(true,true);await f.load();assert.equal(f.callbacks.size,0);f.player.destroy();
  const broken=fixture();broken.images[0].onerror();await broken.player.loaded;
  assert.match(broken.status.textContent,/Impossibile caricare/);broken.player.destroy();
});

test('pagina stage autonoma e pipeline CRT con stessi default WEDOO',()=>{
  const html=fs.readFileSync(path.join(demo,'stages.html'),'utf8');
  assert.match(html,/<h1>Stages<\/h1>/);
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    if(!match[1].startsWith('#'))assert.ok(fs.existsSync(path.join(demo,match[1])));
  }
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(demo,'crt-presets.js'),'utf8'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.STAGE_CRT_PRESETS['piazza-europa'])),JSON.parse(fs.readFileSync(path.join(folder,'crt-preset.json'),'utf8')));
  assert.deepEqual(require('../stage-effects.js').defaults,require('../../demo-moves/stage-effects.js').defaults);
});

test('stages-app collega catalogo Sanmauro, contatti, CRT ed effetti e rilascia i controller',()=>{
  const calls={},node={},card={querySelector:()=>node},container={querySelectorAll:()=>[card]};
  const contacts=JSON.parse(fs.readFileSync(path.join(folder,'foot-contacts.json'),'utf8'));
  const controller=name=>({destroy(){calls[name+'Destroyed']=true;}});
  let cleanup;
  const context={document:{querySelector:s=>s==='#stages-list'?container:node},
    window:{STAGES_CATALOG:stages,SANMAURO_CATALOG:manifest,STAGE_FOOT_CONTACTS:contacts,STAGE_CRT_PRESETS:{'piazza-europa':{settings:{}}},addEventListener(type,fn){cleanup=fn;}},
    StagesPlayer:{install(canvas,button,status,stage){calls.stage=stage;return controller('player');}},
    StageFullscreen:{install(){return controller('fullscreen');}},
    StageCrt:{launcher:()=>'',markup:()=>'',install(card,player,id,env,preset){calls.preset=preset;return controller('crt');}},
    StageEffects:{markup:()=>'',crtMarkup:()=>'',install(){return controller('effects');}}};
  vm.runInNewContext(fs.readFileSync(path.join(demo,'stages-app.js'),'utf8'),context);
  assert.match(container.innerHTML,/Arianna a sinistra e Oscare a destra/);
  assert.equal(calls.stage.fighters[0].animation.playbackFps,24);assert.equal(calls.stage.fighters[0].footContacts.length,24);
  assert.equal(calls.stage.fighters[1].footContacts.length,63);assert.ok(calls.preset);
  cleanup();for(const name of ['player','fullscreen','crt','effects'])assert.equal(calls[name+'Destroyed'],true);
});

test('server locale serve anche nomi con spazi, stage e moduli CRT senza esporre gli archivi',async t=>{
  const {createDemoServer}=await import('./serve.mjs');const server=createDemoServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  for(const route of ['stages.html','stages-app.js','stages-catalog.js','stage-foot-contacts.js','stage-player.js','stage-effects.js','stage-fullscreen.js','crt-panel.js','crt-webgl.js','crt-presets.js',...stages[0].layers.map(l=>l.image)]){
    assert.equal((await fetch(base+'/'+route,{method:'HEAD'})).status,200,route);
  }
  assert.equal((await fetch(base+'/assets/stages/Piazza%20Europa/nuvole-parallax-5000x1080.zip')).status,403);
});

function fixture(reduced=false,withFighters=false){
  function node(){return {listeners:{},hidden:false,disabled:false,textContent:'',setAttribute(){},addEventListener(k,f){this.listeners[k]=f;},removeEventListener(k){delete this.listeners[k];}};}
  const images=[],draws=[],transforms=[],fills=[],paint=[],buffers=[],callbacks=new Map();let next=0;
  const document=node(),media=node();document.hidden=false;media.matches=reduced;
  document.createElement=()=>{
    const calls=[];
    const context={clearRect(){},drawImage(...args){calls.push(['draw',...args]);},save(){},restore(){},fillRect(...args){calls.push(['tint',this.globalCompositeOperation,this.fillStyle,...args]);}};
    const canvas={width:0,height:0,getContext:()=>context,calls};buffers.push(canvas);return canvas;
  };
  const env={document,matchMedia:()=>media,Image:class{constructor(){images.push(this);}},requestAnimationFrame:f=>{callbacks.set(++next,f);return next;},cancelAnimationFrame:id=>callbacks.delete(id)};
  const canvas=node(),button=node(),status=node();
  let captured=null;
  canvas.getBoundingClientRect=()=>({width:960});
  canvas.focus=()=>{};
  canvas.classList={add(){},remove(){}};
  canvas.setPointerCapture=id=>{captured=id;};
  canvas.hasPointerCapture=id=>captured===id;
  canvas.releasePointerCapture=()=>{captured=null;};
  canvas.getContext=()=>({clearRect(){paint.push({kind:'clear'});},fillRect(...args){fills.push(args);paint.push({kind:'fill',color:this.fillStyle,alpha:this.globalAlpha,args});},drawImage(...args){draws.push(args);paint.push({kind:'image',image:args[0]});},save(){},restore(){},transform(...args){transforms.push(['project',...args]);},translate(...args){transforms.push(['translate',...args]);},scale(...args){transforms.push(['scale',...args]);}});
  const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(demo,'catalog.js'),'utf8'),sandbox);
  const contacts=JSON.parse(fs.readFileSync(path.join(folder,'foot-contacts.json'),'utf8'));
  const fighters=withFighters?stages[0].fighters.map(f=>({...f,footContacts:contacts.items.find(i=>i.characterId===f.characterId).frames,animation:sandbox.window.SANMAURO_CATALOG.characters.find(c=>c.id===f.characterId).animations.find(a=>a.id===f.animationId)})):[];
  const player=install(canvas,button,status,{...stages[0],fighters},env);
  function load(){images.forEach((image,i)=>{
    if(i<5)Object.assign(image,{naturalWidth:stages[0].layers[i].width,naturalHeight:1080});
    else{
      const png=fs.readFileSync(path.resolve(demo,fighters[i-5].animation.image));
      Object.assign(image,{naturalWidth:png.readUInt32BE(16),naturalHeight:png.readUInt32BE(20)});
    }
    image.onload();
  });return player.loaded;}
  function tick(time){const pending=[...callbacks.values()];callbacks.clear();pending.forEach(f=>f(time));}
  return {canvas,button,status,player,images,draws,transforms,fills,paint,buffers,callbacks,document,media,load,tick};
}
