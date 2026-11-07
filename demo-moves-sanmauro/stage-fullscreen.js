(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.StageFullscreen=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function install(card,env=globalThis){
    const doc=env.document,screen=card.querySelector('[data-stage-screen]');
    const button=card.querySelector('[data-stage-fullscreen]'),exit=card.querySelector('[data-stage-fullscreen-exit]');
    const canvas=screen.querySelector('canvas'),message=card.querySelector('[data-stage-fullscreen-message]');
    if(!screen.requestFullscreen||!doc.exitFullscreen||doc.fullscreenEnabled===false){button.hidden=true;exit.hidden=true;return {destroy(){}};}
    let busy=false,disposed=false,wasActive=false;
    function sync(){
      const active=doc.fullscreenElement===screen;
      button.textContent=active?'Esci da fullscreen':'Fullscreen';
      button.setAttribute('aria-pressed',String(active));button.disabled=busy;exit.disabled=busy;
    }
    async function toggle(){
      if(busy||disposed)return;
      busy=true;message.hidden=true;sync();
      try{
        if(doc.fullscreenElement===screen)await doc.exitFullscreen();
        else await screen.requestFullscreen();
      }catch{
        if(!disposed){message.textContent='Fullscreen non consentito da questa finestra. Riprova dal pulsante.';message.hidden=false;}
      }finally{busy=false;if(!disposed)sync();}
    }
    function changed(){
      const active=doc.fullscreenElement===screen;
      if(active&&!wasActive){message.hidden=true;canvas.focus({preventScroll:true});}
      if(!active&&wasActive)button.focus({preventScroll:true});
      wasActive=active;sync();
    }
    button.addEventListener('click',toggle);exit.addEventListener('click',toggle);doc.addEventListener('fullscreenchange',changed);sync();
    return {destroy(){
      disposed=true;button.removeEventListener('click',toggle);exit.removeEventListener('click',toggle);doc.removeEventListener('fullscreenchange',changed);
      if(doc.fullscreenElement===screen){try{Promise.resolve(doc.exitFullscreen()).catch(()=>{});}catch{}}
    }};
  }
  return Object.freeze({install});
});
