const test=require('node:test');
const assert=require('node:assert/strict');
const {defaults,amount,markup,install}=require('../stage-effects.js');

function fixture(advanced=null){
  const nodes=new Map(),calls=[];
  function node(){return {style:{setProperty(k,v){this[k]=v;}},checked:true,disabled:false,textContent:'',value:'',attributes:{},listeners:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,f){this.listeners[k]=f;},removeEventListener(k){delete this.listeners[k];}};}
  for(const key of ['[data-fx-original]','[data-fx-reset]','.stage-crt','.stage-crt-output','canvas','[data-fx-status]'])nodes.set(key,node());
  for(const key of Object.keys(defaults)){
    for(const type of ['toggle','amount','output'])nodes.set(`[data-fx-${type}="${key}"]`,node());
    nodes.get(`[data-fx-amount="${key}"]`).value=String(defaults[key]*100);
  }
  const controls=install({querySelector:s=>nodes.get(s)},{setEffects:value=>calls.push(value)},advanced);
  return {nodes,calls,controls};
}

test('i cinque effetti hanno intensità indipendenti, confronto originale e ripristino',()=>{
  const f=fixture();assert.deepEqual(f.calls.at(-1),defaults);
  assert.equal(f.nodes.get('canvas').style.filter,'contrast(1.11) saturate(1.126) brightness(1.08)');
  const strength=f.nodes.get('[data-fx-amount="color"]');strength.value='80';strength.listeners.input();
  assert.equal(f.calls.at(-1).color,.8);assert.equal(f.calls.at(-1).shadows,defaults.shadows);
  const shadow=f.nodes.get('[data-fx-toggle="shadows"]');shadow.checked=false;shadow.listeners.change();
  assert.equal(f.calls.at(-1).shadows,0);assert.equal(f.nodes.get('[data-fx-amount="shadows"]').disabled,true);
  const original=f.nodes.get('[data-fx-original]');original.listeners.click();
  assert.deepEqual(f.calls.at(-1),Object.fromEntries(Object.keys(defaults).map(key=>[key,0])));assert.equal(f.nodes.get('.stage-crt').style.opacity,'0');
  assert.equal(f.nodes.get('canvas').style.filter,'none');
  original.listeners.click();assert.equal(f.calls.at(-1).color,.8);assert.equal(f.calls.at(-1).shadows,0);
  f.nodes.get('[data-fx-reset]').listeners.click();assert.deepEqual(f.calls.at(-1),defaults);
  assert.equal(original.attributes['aria-pressed'],'false');
  f.controls.destroy();assert.equal(Object.keys(original.listeners).length,0);
});

test('CRT base e avanzato sono indipendenti; il confronto originale sospende entrambi senza perdere valori',()=>{
  let suspended=false;
  const advanced={setOriginal(value){suspended=value;},setStrength(){throw Error('Il CRT base non deve modificare quello avanzato');},reset(){throw Error('Ripristina base non deve azzerare avanzato');}};
  const f=fixture(advanced);
  const base=f.nodes.get('[data-fx-amount="crt"]');base.value='50';base.listeners.input();
  assert.equal(f.nodes.get('.stage-crt').style.opacity,'0.5');assert.equal(suspended,false);
  assert.equal(f.nodes.get('.stage-crt-output').style.filter,f.nodes.get('canvas').style.filter);
  const rgb=f.nodes.get('[data-fx-toggle="rgbMask"]');rgb.checked=false;rgb.listeners.change();
  assert.equal(f.nodes.get('.stage-crt').style['--crt-mask-rb'],'0');
  assert.equal(f.nodes.get('.stage-crt').style['--crt-scanline-alpha'],'0.19');
  f.nodes.get('[data-fx-original]').listeners.click();assert.equal(suspended,true);
  f.nodes.get('[data-fx-original]').listeners.click();assert.equal(suspended,false);assert.equal(base.value,'50');
  f.nodes.get('[data-fx-reset]').listeners.click();assert.equal(base.value,100);
  f.controls.destroy();
});

test('valori limitati e controlli con etichette associate per ogni stage',()=>{
  assert.equal(amount(-1),0);assert.equal(amount(2),1);assert.equal(amount('invalid'),0);
  const html=markup('villa-arduino');
  assert.match(html,/for="villa-arduino-color-amount"/);
  assert.match(html,/id="villa-arduino-crt-on"/);
  assert.equal((html.match(/type="range"/g)||[]).length,5);
  assert.match(html,/Foschia lontana/);assert.match(html,/Polvere in pixel art/);
  assert.match(html,/aria-live="polite"/);
  const basic=require('../stage-effects.js').crtMarkup('villa-arduino');
  assert.equal((basic.match(/type="range"/g)||[]).length,7);
  assert.match(basic,/Righe scanline/);assert.match(basic,/Riflesso del vetro/);
});
