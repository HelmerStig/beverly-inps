const test=require('node:test');
const assert=require('node:assert/strict');
const crt=require('../crt-panel.js');
const fs=require('node:fs');
const path=require('node:path');
const basePreset=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/stages/Piazza Europa/crt-preset.json'),'utf8'));

test('base Piazza Europa: JSON e catalogo offline conservano esattamente il preset',()=>{
  const vm=require('node:vm'),context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../crt-presets.js'),'utf8'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.STAGE_CRT_PRESETS['piazza-europa'])),basePreset);
  assert.deepEqual(crt.parsePreset(JSON.stringify(basePreset)),basePreset);
});

test('base dello stage caricata, azzerabile e ripristinabile senza cambiare CRT base',()=>{
  const f=fixture({basePreset});f.render();
  assert.deepEqual(f.draws.at(-1)[0],basePreset.settings);
  assert.equal(f.draws.at(-1)[1],1);
  f.controller.reset();assert.deepEqual(f.draws.at(-1)[0],crt.defaults);
  f.controller.setStrength(.2);
  f.nodes.get('[data-crt-enabled]').checked=false;
  f.nodes.get('[data-crt-enabled]').listeners.change();
  f.nodes.get('[data-crt-base]').listeners.click();
  assert.deepEqual(f.draws.at(-1)[0],basePreset.settings);
  assert.equal(f.draws.at(-1)[1],1);
  assert.equal(f.nodes.get('[data-crt-enabled]').checked,true);
  assert.equal(f.nodes.get('.stage-preview canvas').style.filter,'contrast(1.1)');
  assert.equal(f.nodes.get('.stage-crt').style.opacity,'0.6');
  f.nodes.get('[data-crt-export]').listeners.click();
  assert.deepEqual(crt.parsePreset(f.downloads[0].parts[0]),basePreset);
  f.controller.destroy();
});

test('vecchi preset locali non coprono la nuova base; fissaggio legato alla revisione',()=>{
  const oldKey=crt.presetKey('piazza-europa');
  const key=crt.presetKey('piazza-europa',basePreset);
  assert.notEqual(key,oldKey);
  assert.notEqual(key,crt.presetKey('piazza-europa',{...basePreset,strength:.5}));
  const stored=JSON.stringify(crt.preset({...crt.defaults,dotPitch:5},.7));
  const f=fixture({basePreset,stored,storedKey:oldKey});f.render();
  assert.deepEqual(f.draws.at(-1)[0],basePreset.settings);
  f.nodes.get('[data-crt-save]').listeners.click();assert.equal(f.writes[0][0],key);
  f.controller.destroy();
  const pinned=fixture({basePreset,stored,storedKey:key});pinned.render();
  assert.equal(pinned.draws.at(-1)[0].dotPitch,5);
  assert.equal(pinned.draws.at(-1)[1],.7);pinned.controller.destroy();
});

test('preset versionati: round trip, limiti e livelli del bianco/nero validi',()=>{
  const settings={...crt.defaults,type:'monitor',redX:2,blueY:-1,bloomIntensity:1.5};
  const value=crt.preset(settings,.7);
  assert.deepEqual(crt.parsePreset(JSON.stringify(value)),value);
  const bounded=crt.normalize({...settings,grain:Infinity,dotPitch:0,distortion:100,blackPoint:254,whitePoint:1,type:'script'});
  assert.equal(bounded.dotPitch,0);assert.equal(bounded.distortion,.08);
  assert.equal(bounded.whitePoint,255);assert.equal(bounded.type,crt.defaults.type);
  assert.equal(bounded.grain,crt.defaults.grain);
  assert.throws(()=>crt.parsePreset('{"version":1,"settings":{}}'));
  assert.throws(()=>crt.parsePreset('{"schema":"wedoo.crt-preset","version":2,"settings":{}}'));
  assert.throws(()=>crt.parsePreset('{"schema":"wedoo.crt-preset","version":1,"settings":[]}'));
});

function fixture({supported=true,stored=null,storageDenied=false,basePreset=null,storedKey=null}={}){
  const nodes=new Map(),draws=[],writes=[],downloads=[];let hook=null,failure;
  function node(){return {style:{},hidden:false,value:'',textContent:'',listeners:{},attributes:{},files:[],focus(){this.focused=true;},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,f){this.listeners[k]=f;},removeEventListener(k){delete this.listeners[k];},click(){this.clicked=true;},remove(){}};}
  for(const selector of ['.stage-preview canvas','.stage-crt-output','.stage-crt','[data-crt-status]','[data-crt-runtime]','[data-crt-reset]','[data-crt-base]','[data-crt-save]','[data-crt-export]','[data-crt-import]','[data-crt-file]','[data-crt-open]','[data-crt-close]','[data-crt-drawer]','[data-crt-enabled]','[data-crt-strength]','[data-crt-strength-output]'])nodes.set(selector,node());
  nodes.get('[data-crt-drawer]').hidden=true;
  for(const field of crt.fields){nodes.set(`[data-crt-param="${field[0]}"]`,node());if(!Array.isArray(field[2]))nodes.set(`[data-crt-number="${field[0]}"]`,node());}
  const source=nodes.get('.stage-preview canvas');source.width=1920;source.height=1080;
  source.style.filter='contrast(1.1)';nodes.get('.stage-crt').style.opacity='0.6';
  const classes=new Set(),document={...node(),body:{append(){},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}},createElement:node};
  const env={localStorage:{getItem(key){if(storageDenied)throw Error();return storedKey&&storedKey!==key?null:stored;},setItem(key,text){if(storageDenied)throw Error();writes.push([key,text]);}},
    CrtWebGL:{create(input,output,fail){failure=fail;return {supported,render(...args){draws.push(args);return true;},destroy(){}};}},
    Blob:class {constructor(parts){this.parts=parts;}},URL:{createObjectURL(blob){downloads.push(blob);return 'blob:test';},revokeObjectURL(){}},
    document,setTimeout(fn){fn();}};
  const player={setPostProcess(fn){hook=fn;}};
  const card={querySelector:s=>nodes.get(s),scrollIntoView(){this.scrolled=true;}};
  const controller=crt.install(card,player,'piazza-europa',env,basePreset);
  return {nodes,draws,writes,downloads,controller,document,classes,card,fail:()=>failure(),render(time=0){hook?.(source,time);},hook:()=>hook};
}

test('offcanvas: apertura, chiusura, Escape e focus senza perdere i parametri',()=>{
  const f=fixture();
  const open=f.nodes.get('[data-crt-open]'),close=f.nodes.get('[data-crt-close]'),drawer=f.nodes.get('[data-crt-drawer]');
  open.listeners.click();assert.equal(drawer.hidden,false);assert.equal(open.attributes['aria-expanded'],'true');
  assert.ok(f.classes.has('crt-drawer-open'));assert.equal(close.focused,true);assert.equal(f.card.scrolled,true);
  const pitch=f.nodes.get('[data-crt-param="dotPitch"]');pitch.value='6';pitch.listeners.input();
  f.document.listeners.keydown({key:'Escape',preventDefault(){}});
  assert.equal(drawer.hidden,true);assert.equal(open.focused,true);assert.equal(f.classes.size,0);
  open.listeners.click();assert.equal(pitch.value,6);close.listeners.click();assert.equal(drawer.hidden,true);
  open.listeners.click();f.controller.destroy();assert.equal(drawer.hidden,true);assert.equal(f.classes.size,0);
  assert.equal(f.document.listeners.keydown,undefined);
  assert.match(crt.markup('piazza-europa'),/role="dialog"/);
  assert.match(crt.launcher('piazza-europa'),/aria-controls="crt-piazza-europa-drawer"/);
});

test('tutti i valori numerici iniziali sono zero, senza alterare i preset fissati',()=>{
  assert.ok(Object.values(crt.defaults).filter(v=>typeof v==='number').every(v=>v===0));
  assert.equal(crt.normalize({}).whitePoint,0);
  const f=fixture({stored:JSON.stringify(crt.preset({...crt.defaults,dotPitch:5},1))});
  assert.equal(f.nodes.get('[data-crt-param="dotPitch"]').value,5);
  f.controller.reset();assert.equal(f.nodes.get('[data-crt-param="dotPitch"]').value,0);
  f.controller.destroy();
});

test('controlli CRT, confronto originale, fissaggio ed esportazione mantengono i valori',()=>{
  const f=fixture();f.render();assert.equal(f.draws.at(-1)[0].type,'tv');
  const pitch=f.nodes.get('[data-crt-param="dotPitch"]');pitch.value='7';pitch.listeners.input();
  const type=f.nodes.get('[data-crt-param="type"]');type.value='lcd';type.listeners.change();
  f.controller.setStrength(.6);f.render(750);
  assert.equal(f.draws.at(-1)[0].dotPitch,7);assert.equal(f.draws.at(-1)[0].type,'lcd');
  assert.equal(f.draws.at(-1)[1],.6);assert.equal(f.draws.at(-1)[2],750);
  assert.equal(f.nodes.get('.stage-preview canvas').style.filter,'contrast(1.1)','CRT base lasciato indipendente');
  const before=f.draws.length;f.controller.setStrength(0);f.render();assert.equal(f.draws.length,before);
  assert.equal(f.nodes.get('.stage-crt-output').hidden,true);
  f.controller.setStrength(.6);assert.equal(f.draws.at(-1)[0].dotPitch,7);
  f.nodes.get('[data-crt-save]').listeners.click();assert.equal(f.writes.length,1);
  const saved=crt.parsePreset(f.writes[0][1]);assert.equal(saved.settings.dotPitch,7);assert.equal(saved.strength,.6);
  f.nodes.get('[data-crt-export]').listeners.click();assert.equal(f.downloads.length,1);
  assert.deepEqual(crt.parsePreset(f.downloads[0].parts[0]),saved);
  f.controller.reset();assert.equal(f.draws.at(-1)[0].dotPitch,crt.defaults.dotPitch);
  f.controller.destroy();assert.equal(f.hook(),null);assert.equal(Object.keys(pitch.listeners).length,0);
});

test('preset fissato e importazione aggiornano soltanto la forza del CRT avanzato',async()=>{
  const saved=JSON.stringify(crt.preset({...crt.defaults,glowIntensity:.8},.4));
  const f=fixture({stored:saved});
  f.render();assert.equal(f.draws.at(-1)[1],.4);assert.equal(f.draws.at(-1)[0].glowIntensity,.8);
  const input=f.nodes.get('[data-crt-file]');input.files=[{size:100,text:async()=>JSON.stringify(crt.preset({...crt.defaults,type:'monitor'},.9))}];
  await input.listeners.change();assert.equal(f.draws.at(-1)[1],.9);assert.equal(f.draws.at(-1)[0].type,'monitor');
  assert.equal(f.nodes.get('.stage-preview canvas').style.filter,'contrast(1.1)');
  input.files=[{size:10,text:async()=>'{'}];await input.listeners.change();
  assert.match(f.nodes.get('[data-crt-status]').textContent,/Importazione non riuscita/);
  assert.equal(f.draws.at(-1)[0].type,'monitor');f.controller.destroy();
});

test('assenza WebGL, perdita contesto e storage negato non bloccano la demo',()=>{
  const f=fixture({supported:false,storageDenied:true});f.controller.setStrength(.8);f.render();
  assert.equal(f.nodes.get('.stage-crt-output').hidden,true);assert.equal(f.nodes.get('.stage-crt').style.opacity,'0.6');
  assert.match(f.nodes.get('.stage-preview canvas').style.filter,/contrast/);
  f.nodes.get('[data-crt-save]').listeners.click();assert.match(f.nodes.get('[data-crt-status]').textContent,/Salvataggio locale non disponibile/);f.controller.destroy();
  const lost=fixture();lost.controller.setStrength(1);lost.fail();
  assert.equal(lost.nodes.get('.stage-crt-output').hidden,true);assert.equal(lost.nodes.get('.stage-crt').style.opacity,'0.6');lost.controller.destroy();
});

test('attivazione e intensita avanzata non modificano il CRT base e sono incluse nel preset',()=>{
  const f=fixture();
  const strength=f.nodes.get('[data-crt-strength]'),enabled=f.nodes.get('[data-crt-enabled]');
  strength.value='35';strength.listeners.input();assert.equal(f.draws.at(-1)[1],.35);
  enabled.checked=false;enabled.listeners.change();assert.equal(f.nodes.get('.stage-crt-output').hidden,true);
  assert.equal(f.nodes.get('.stage-crt').style.opacity,'0.6');
  assert.equal(f.nodes.get('.stage-preview canvas').style.filter,'contrast(1.1)');
  f.nodes.get('[data-crt-save]').listeners.click();assert.equal(crt.parsePreset(f.writes.at(-1)[1]).enabled,false);
  enabled.checked=true;enabled.listeners.change();f.controller.setOriginal(true);assert.equal(f.nodes.get('.stage-crt-output').hidden,true);
  f.controller.setOriginal(false);assert.equal(f.draws.at(-1)[1],.35);
  assert.equal(f.nodes.get('.stage-crt').style.opacity,'0.6');f.controller.destroy();
});
