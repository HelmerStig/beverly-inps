(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.StageEffects=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Intensità normalizzate: gli asset originali rimangono invariati.
  const defaults=Object.freeze({shadows:0.8,color:0.35,crt:1,fog:0.65,dust:1,scanlines:0.5,rgbMask:0.5,vignette:0.8,contrast:0.5,saturation:0.7,brightness:1,glass:1});
  function amount(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
  function controlMarkup(id,list){
    return list.map(([key,label])=>`<div class="stage-effect"><label class="stage-effect-toggle" for="${id}-${key}-on"><input id="${id}-${key}-on" data-fx-toggle="${key}" type="checkbox" checked>${label}</label><div class="stage-effect-range"><label class="screen-reader-only" for="${id}-${key}-amount">Intensità: ${label}</label><input id="${id}-${key}-amount" data-fx-amount="${key}" type="range" min="0" max="100" step="1" value="${defaults[key]*100}"><output for="${id}-${key}-amount" data-fx-output="${key}">${defaults[key]*100}%</output></div></div>`).join('');
  }
  function markup(id){
    const prefix=String(id).replace(/[^a-z0-9-]/gi,'-');
    return `<div class="stage-effects"><div class="stage-effects-heading"><h3>Effetti di anteprima</h3><div class="stage-effects-actions"><button class="step-button" type="button" data-fx-original aria-pressed="false">Vista originale</button><button class="step-button" type="button" data-fx-reset>Ripristina</button></div></div><div class="stage-effects-grid">${controlMarkup(prefix,[['shadows','Ombre a terra'],['color','Toni caldi sui personaggi'],['crt','CRT base'],['fog','Foschia lontana'],['dust','Polvere in pixel art']])}</div><p class="stage-effects-status" data-fx-status aria-live="polite">Anteprima con effetti.</p></div>`;
  }
  function crtMarkup(id){
    const prefix=String(id).replace(/[^a-z0-9-]/gi,'-')+'-crt-base';
    return `<details class="crt-base-group" open><summary>CRT base · scanline e vetro</summary><p class="crt-help">I controlli originali, indipendenti dal CRT avanzato. L’intensità generale è il cursore “CRT base” sotto lo stage.</p><div class="stage-effects-grid">${controlMarkup(prefix,[['scanlines','Righe scanline'],['rgbMask','Trama RGB'],['vignette','Vignettatura'],['contrast','Contrasto'],['saturation','Saturazione'],['brightness','Luminosità'],['glass','Riflesso del vetro']])}</div></details>`;
  }
  function install(card,player,advanced=null){
    const original=card.querySelector('[data-fx-original]'),reset=card.querySelector('[data-fx-reset]');
    const overlay=card.querySelector('.stage-crt');
    const canvas=card.querySelector('canvas');
    const output=card.querySelector('.stage-crt-output');
    const status=card.querySelector('[data-fx-status]');
    const controls=Object.keys(defaults).map(key=>({key,toggle:card.querySelector(`[data-fx-toggle="${key}"]`),range:card.querySelector(`[data-fx-amount="${key}"]`),output:card.querySelector(`[data-fx-output="${key}"]`)}));
    let showOriginal=false;
    const cleanups=[];
    function listen(node,event,handler){node.addEventListener(event,handler);cleanups.push(()=>node.removeEventListener(event,handler));}
    function apply(){
      const values={};
      controls.forEach(({key,toggle,range,output})=>{
        const value=amount(Number(range.value)/100);
        output.textContent=Math.round(value*100)+'%';range.disabled=!toggle.checked;
        values[key]=!showOriginal&&toggle.checked?value:0;
      });
      player.setEffects(values);
      overlay.style.opacity=String(values.crt);
      const vars={'--crt-vignette-alpha':values.vignette*.68,'--crt-scanline-alpha':values.scanlines*.38,'--crt-scanline-highlight':values.scanlines*.045,'--crt-mask-rb':values.rgbMask*.12,'--crt-mask-g':values.rgbMask*.065,'--crt-glass-opacity':values.glass,'--crt-frame-alpha':values.glass*.5,'--crt-rim-alpha':values.glass*.85};
      Object.entries(vars).forEach(([key,value])=>overlay.style.setProperty(key,String(value)));
      const filter=values.crt?`contrast(${1+values.crt*values.contrast*.22}) saturate(${1+values.crt*values.saturation*.18}) brightness(${1+values.crt*values.brightness*.08})`:'none';
      canvas.style.filter=filter;if(output)output.style.filter=filter;
      advanced?.setOriginal(showOriginal);
      original.setAttribute('aria-pressed',String(showOriginal));
      status.textContent=showOriginal?'Vista originale: effetti sospesi.':'Anteprima con effetti.';
    }
    controls.forEach(({toggle,range})=>{listen(toggle,'change',apply);listen(range,'input',apply);});
    listen(original,'click',()=>{showOriginal=!showOriginal;apply();});
    listen(reset,'click',()=>{showOriginal=false;controls.forEach(({key,toggle,range})=>{toggle.checked=true;range.value=defaults[key]*100;});apply();});
    apply();
    return {destroy(){cleanups.forEach(cleanup=>cleanup());}};
  }
  return Object.freeze({defaults,amount,markup,crtMarkup,install});
});
