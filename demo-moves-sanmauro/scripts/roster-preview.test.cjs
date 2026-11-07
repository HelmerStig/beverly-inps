const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../player-core.js');

function fixture({reducedMotion=false,normalized=false}={}){
  const images=[],frames=new Map(),draws=[];let sequence=0;
  const document={hidden:false,activeElement:null,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},createElement(){return {hidden:true,setAttribute(){},getContext(){return {clearRect(){},drawImage(...args){draws.push(args);}};}};}};
  const cards=['alberto','oscar'].map(id=>({dataset:{character:id},hidden:false,hover:false,classes:new Set(),listeners:{},
    classList:{add(value){this.owner.classes.add(value);},remove(value){this.owner.classes.delete(value);}},
    addEventListener(type,fn){this.listeners[type]=fn;},matches(){return this.hover;},querySelector(){return {append:canvas=>{this.canvas=canvas;}};}
  }));
  cards.forEach(card=>card.classList.owner=card);
  const sandbox={MovesCore:core,document,matchMedia:()=>({matches:reducedMotion}),performance:{now:()=>0},
    Image:class {constructor(){images.push(this);}},
    requestAnimationFrame(fn){const id=++sequence;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../roster-preview.js'),'utf8'),sandbox);
  const characters=cards.map(c=>({id:c.dataset.character,animations:[{id:'idle',image:c.dataset.character+'.png',frameWidth:512,frameHeight:512,frames:[[0,0,512,512],[512,0,512,512],[1024,0,512,512]]}]}));
  if(normalized)characters.forEach(c=>c.animations[0].preview={drawRect:[20,30,450,450]});
  const preview=sandbox.MovesRoster.install({querySelectorAll:()=>cards},characters);
  return {cards,images,frames,draws,document,preview,enter(card){card.hover=true;return card.listeners.mouseenter();},leave(card){card.hover=false;card.listeners.mouseleave();},step(time){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time));}};
}

test('hover usa la stessa trasformazione normalizzata dei player',async()=>{
  const f=fixture({normalized:true});const pending=f.enter(f.cards[0]);
  f.images[0].onload();await pending;
  assert.deepEqual(f.draws.at(-1).slice(5),[20,30,450,450]);
  f.step(100);assert.deepEqual(f.draws.at(-1).slice(5),[20,30,450,450]);f.preview.stop();
});

test('hover carica idle su richiesta, anima a 24 fps e ripristina la posa all’uscita',async()=>{
  const f=fixture(),card=f.cards[0];
  assert.equal(f.images.length,0);
  const pending=f.enter(card);assert.equal(f.images[0].src,'alberto.png');
  assert.equal(card.canvas.hidden,true);
  f.images[0].onload();await pending;
  assert.equal(card.canvas.hidden,false);assert.ok(card.classes.has('is-idle'));
  f.step(100);assert.equal(f.draws.at(-1)[1],1024);
  f.leave(card);assert.equal(card.canvas.hidden,true);assert.equal(f.frames.size,0);assert.ok(!card.classes.has('is-idle'));
  await f.enter(card);assert.equal(f.images.length,1);
});

test('una risposta lenta non attiva una scheda lasciata e il filtro ferma la riproduzione',async()=>{
  const f=fixture();
  const first=f.enter(f.cards[0]);f.leave(f.cards[0]);
  const second=f.enter(f.cards[1]);
  f.images[0].onload();await first;
  assert.equal(f.cards[0].canvas.hidden,true);assert.equal(f.draws.length,0);
  f.images[1].onload();await second;assert.equal(f.draws.length,1);
  f.cards[1].hidden=true;f.preview.refresh();assert.equal(f.frames.size,0);assert.equal(f.cards[1].canvas.hidden,true);
});

test('errore di caricamento conserva la posa e permette di riprovare; movimento ridotto resta statico',async()=>{
  const f=fixture({reducedMotion:true}),card=f.cards[0];
  const pending=f.enter(card);f.images[0].onerror(new Error('missing'));await pending;
  assert.equal(card.canvas.hidden,true);assert.ok(!card.classes.has('is-idle'));
  const retry=f.enter(card);assert.equal(f.images.length,2);f.images[1].onload();await retry;
  assert.equal(card.canvas.hidden,false);assert.equal(f.frames.size,0);
});
