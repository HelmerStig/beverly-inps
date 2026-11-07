const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),data=require('../ui-catalog.js'),screen=data.screens[0],stage=require('../stages-catalog.js')[0],{install,cloudPositions}=require('../stage-player.js');

test('UI: dieci PNG originali TitleScreen, ordine Godot, proporzioni native e composizione senza menu',()=>{
  const saved=JSON.parse(fs.readFileSync(path.join(root,'assets/ui/title-screen/screen.json'),'utf8'));
  assert.deepEqual(saved,screen);assert.equal(screen.layers.length,10);assert.deepEqual(screen.fighters,[]);
  assert.deepEqual(screen.layers.map(l=>path.basename(l.image)),['livello-01.png','nuvole-01.png','nuvole-02.png','nuvole-03.png','livello-03.png','water-level-03_5.png','riflesso-1.png','riflesso-2.png','riflesso-3.png','livello-04.png']);
  for(const [i,layer]of screen.layers.entries()){
    const png=fs.readFileSync(path.join(root,layer.image));assert.equal(createHash('sha256').update(png).digest('hex'),layer.sourceSha256);
    assert.equal(png.readUInt32BE(16),layer.width);assert.equal(png.readUInt32BE(20),layer.height);assert.equal(layer.zIndex,i);
    assert.equal(layer.renderHeight,1080);assert.equal(layer.renderWidth/layer.renderHeight,layer.width/layer.height);
  }
  assert.equal(screen.width,3240);assert.equal(screen.viewportWidth,1920);assert.equal(screen.height,1080);
  assert.ok(screen.layers.every(l=>!/(10099|Beverly|logo)/i.test(l.image)));
});
test('UI: nuvole e riflessi sincronizzati a 6/12/20 px/s, preset identico a Piazza Europa',()=>{
  const speeds=stage.layers.filter(l=>l.speed).map(l=>l.speed);
  assert.deepEqual(screen.layers.slice(1,4).map(l=>l.speed),speeds);assert.deepEqual(screen.layers.slice(6,9).map(l=>l.speed),speeds);
  assert.deepEqual(screen.crtPreset,JSON.parse(fs.readFileSync(path.join(root,'assets/stages/Piazza Europa/crt-preset.json'),'utf8')));
  assert.deepEqual(screen.crtPreset,JSON.parse(fs.readFileSync(path.join(root,'assets/ui/title-screen/crt-preset.json'),'utf8')));
  for(const time of [0,1000,50000,200000,900000])for(let i=1;i<=3;i++){
    const cloud=screen.layers[i],reflection=screen.layers[i+5],positions=cloudPositions(screen.width,cloud.renderWidth,time,cloud.speed);
    assert.deepEqual(positions,cloudPositions(screen.width,reflection.renderWidth,time,reflection.speed));
    assert.ok(positions[0]<=0&&positions.at(-1)+cloud.renderWidth>=screen.width);
    for(let j=1;j<positions.length;j++)assert.equal(positions[j]-positions[j-1],cloud.renderWidth);
  }
});
test('player: PNG nativi validati, disegno scalato a 1080, drag indipendente e pausa nuvole',async()=>{
  const node=()=>({listeners:{},setAttribute(){},addEventListener(k,f){this.listeners[k]=f;},removeEventListener(k){delete this.listeners[k];}});
  const images=[],draws=[],callbacks=new Map(),document=node(),media=node(),canvas=node(),button=node(),status=node();let next=0;
  document.hidden=false;media.matches=false;
  canvas.getContext=()=>({clearRect(){},save(){},restore(){},drawImage(...args){draws.push(args);}});
  canvas.classList={add(){},remove(){}};canvas.getBoundingClientRect=()=>({width:960});
  const env={document,matchMedia:()=>media,Image:class{constructor(){images.push(this);}},requestAnimationFrame(f){callbacks.set(++next,f);return next;},cancelAnimationFrame(id){callbacks.delete(id);}};
  const player=install(canvas,button,status,screen,env);
  images.forEach((im,i)=>{im.naturalWidth=screen.layers[i].width;im.naturalHeight=screen.layers[i].height;im.onload();});await player.loaded;
  assert.equal(images.length,10);assert.deepEqual([canvas.width,canvas.height],[1920,1080]);
  assert.deepEqual(draws[0].slice(1),[-660,0,3240,1080]);assert.equal(button.disabled,false);
  function tick(t){const pending=[...callbacks.values()];callbacks.clear();pending.forEach(f=>f(t));}
  tick(0);tick(100);const before=draws.filter(d=>d[0]===images[1]).at(-2)[1];assert.equal(before,-660.6);
  canvas.listeners.keydown({key:'Home',preventDefault(){}});assert.equal(draws.filter(d=>d[0]===images[1]).at(-2)[1],-.6);
  button.listeners.click();tick(200);assert.equal(draws.filter(d=>d[0]===images[1]).at(-2)[1],-.6);
  player.destroy();assert.equal(callbacks.size,0);
});
test('sezione UI: navigazione, stage, pannello CRT, fullscreen, download layer e rilascio controller',()=>{
  const html=fs.readFileSync(path.join(root,'ui.html'),'utf8');assert.match(html,/data-page="ui"/);assert.match(html,/<h1>UI<\/h1>/);
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g))if(!match[1].startsWith('#'))assert.ok(fs.existsSync(path.join(root,match[1])),match[1]);
  assert.match(fs.readFileSync(path.join(root,'app.js'),'utf8'),/href="ui.html"/);
  const calls={},hidden=[],node={closest(){const n={};hidden.push(n);return n;}},card={querySelector:()=>node},container={querySelectorAll:()=>[card]};let cleanup;
  const controller=name=>({destroy(){calls[name]=true;}});
  const context={document:{querySelector:s=>s==='#ui-list'?container:node},window:{UI_CATALOG:data,addEventListener(type,fn){cleanup=fn;}},
    StagesPlayer:{install(canvas,button,status,passed){assert.equal(passed,screen);return controller('player');}},
    StageFullscreen:{install(){return controller('fullscreen');}},StageCrt:{launcher:()=>'',markup:()=>'',install(card,player,id,env,preset){assert.equal(preset,screen.crtPreset);return controller('crt');}},
    StageEffects:{markup:()=>'',crtMarkup:()=>'',install(){return controller('effects');}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'ui-app.js'),'utf8'),context);
  assert.equal(hidden.length,2);assert.ok(hidden.every(n=>n.hidden));assert.equal((container.innerHTML.match(/ download/g)||[]).length,10);
  cleanup();for(const name of ['player','fullscreen','crt','effects'])assert.equal(calls[name],true);
});
test('server locale serve la UI e i layer dalla cartella autonoma',async t=>{
  const {createDemoServer}=await import('./serve.mjs'),server=createDemoServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  for(const route of ['ui.html','ui-app.js','ui-catalog.js','ui.css',...screen.layers.map(l=>l.image)])assert.equal((await fetch(base+'/'+route,{method:'HEAD'})).status,200,route);
});
