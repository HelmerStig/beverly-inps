const test=require('node:test');
const assert=require('node:assert/strict');
const {install}=require('../stage-fullscreen.js');

function fixture({supported=true,deny=false}={}){
  function node(){return {hidden:false,disabled:false,textContent:'',attributes:{},listeners:{},setAttribute(k,v){this.attributes[k]=v;},focus(){this.focused=true;},addEventListener(k,f){this.listeners[k]=f;},removeEventListener(k){delete this.listeners[k];}};}
  const screen=node(),button=node(),exit=node(),message=node(),canvas=node(),document=node();
  const requests=[];document.fullscreenElement=null;document.fullscreenEnabled=true;
  screen.querySelector=()=>canvas;
  if(supported){
    screen.requestFullscreen=async()=>{requests.push(screen);if(deny)throw Error('NotAllowedError');document.fullscreenElement=screen;document.listeners.fullscreenchange?.();};
    document.exitFullscreen=async()=>{requests.push('exit');document.fullscreenElement=null;document.listeners.fullscreenchange?.();};
  }
  const nodes={'[data-stage-screen]':screen,'[data-stage-fullscreen]':button,'[data-stage-fullscreen-exit]':exit,'[data-stage-fullscreen-message]':message};
  const controller=install({querySelector:s=>nodes[s]},{document});
  return {screen,button,exit,message,canvas,document,requests,controller};
}

test('la Fullscreen API riceve soltanto il contenitore dello stage e sincronizza uscita e focus',async()=>{
  const f=fixture();await f.button.listeners.click();
  assert.equal(f.requests[0],f.screen);assert.equal(f.document.fullscreenElement,f.screen);
  assert.equal(f.button.attributes['aria-pressed'],'true');assert.equal(f.canvas.focused,true);
  await f.exit.listeners.click();assert.equal(f.document.fullscreenElement,null);assert.equal(f.button.focused,true);
  await f.button.listeners.click();
  f.document.fullscreenElement=null;f.document.listeners.fullscreenchange();
  assert.equal(f.button.attributes['aria-pressed'],'false','anche uscita nativa con Esc');
  f.controller.destroy();assert.equal(f.document.listeners.fullscreenchange,undefined);
});

test('rifiuto e assenza della API non bloccano lo stage',async()=>{
  const denied=fixture({deny:true});await denied.button.listeners.click();
  assert.equal(denied.button.disabled,false);assert.equal(denied.message.hidden,false);
  assert.match(denied.message.textContent,/Fullscreen non consentito/);denied.controller.destroy();
  const unavailable=fixture({supported:false});assert.equal(unavailable.button.hidden,true);
  assert.equal(unavailable.exit.hidden,true);unavailable.controller.destroy();
});

test('la distruzione del player esce da un fullscreen ancora attivo',async()=>{
  const f=fixture();await f.button.listeners.click();f.controller.destroy();
  assert.equal(f.document.fullscreenElement,null);assert.equal(f.requests.at(-1),'exit');
});
