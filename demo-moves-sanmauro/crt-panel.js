(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.StageCrt=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const groups=[
    ['Preparazione immagine',[
      ['blur','Blur · px',0,4,.1,0],['grain','Grana',0,.3,.005,0],['gamma','Gamma',0,2.4,.01,0],
      ['blackPoint','Punto del nero',0,254,1,0],['whitePoint','Punto del bianco',0,255,1,0]]],
    ['Schermo e fosfori',[
      ['type','Tipo schermo',['monitor','tv','lcd'],'tv'],['distortion','Curvatura',0,.08,.001,0],
      ['dotScale','Dimensione fosfori',0,2,.01,0],['dotPitch','Passo fosfori · px',0,30,.1,0],
      ['falloff','Morbidezza fosfori',0,1,.01,0],['brightnessBoost','Luminosità fosfori',0,3,.01,0],['vignette','Vignettatura',0,1,.01,0]]],
    ['Glow e bloom',[
      ['glowRadius','Raggio glow · passi fosforo',0,.5,.01,0],['glowIntensity','Intensità glow',0,1,.01,0],
      ['blend','Fusione bloom',['screen','light','hdr'],'screen'],['bloomThreshold','Soglia bloom',0,1,.01,0],
      ['bloomIntensity','Intensità bloom',0,5,.01,0],['bloomRadius','Raggio bloom · px',0,10,.1,0]]],
    ['Convergenza dei canali',[
      ['redX','Rosso · spostamento X in px',-6,6,.1,0],['redY','Rosso · spostamento Y in px',-6,6,.1,0],
      ['blueX','Blu · spostamento X in px',-6,6,.1,0],['blueY','Blu · spostamento Y in px',-6,6,.1,0],
      ['convergenceStrength','Intensità convergenza',0,2,.01,0]]]
  ];
  const fields=groups.flatMap(g=>g[1]);
  const defaults=Object.freeze(Object.fromEntries(fields.map(f=>[f[0],Array.isArray(f[2])?f[3]:f[5]])));
  function normalize(input={}){
    const result={};
    for(const [key,,min,max,step,initial] of fields){
      if(Array.isArray(min)){result[key]=min.includes(input[key])?input[key]:defaults[key];continue;}
      const value=typeof input[key]==='number'?input[key]:NaN;
      result[key]=Number.isFinite(value)?Math.max(min,Math.min(max,value)):initial;
    }
    if(result.whitePoint>0&&result.whitePoint<=result.blackPoint)result.whitePoint=result.blackPoint+1;
    return result;
  }
  function preset(settings,strength=1,enabled=true){
    return {schema:'wedoo.crt-preset',version:1,referenceResolution:[1920,1080],
      strength:Math.max(0,Math.min(1,Number.isFinite(strength)?strength:1)),enabled:enabled!==false,settings:normalize(settings)};
  }
  function parsePreset(text){
    const value=JSON.parse(text);
    if(value?.schema!=='wedoo.crt-preset'||value.version!==1||!value.settings||typeof value.settings!=='object'||Array.isArray(value.settings))throw Error('Questo file non è un preset CRT WEDOO valido.');
    return preset(value.settings,value.strength,value.enabled);
  }
  function presetKey(stageId,basePreset){
    const key='wedoo-crt-preset-v1:'+stageId;
    if(!basePreset)return key;
    const text=JSON.stringify(preset(basePreset.settings,basePreset.strength,basePreset.enabled));
    let hash=5381;for(let i=0;i<text.length;i++)hash=(Math.imul(hash,33)^text.charCodeAt(i))>>>0;
    return key+':base-'+hash.toString(16);
  }
  function markup(id,basicControls=''){
    const prefix='crt-'+String(id).replace(/[^a-z0-9-]/gi,'-');
    return `<aside class="crt-drawer" id="${prefix}-drawer" data-crt-drawer role="dialog" aria-labelledby="${prefix}-title" hidden><header class="crt-drawer-header"><h2 id="${prefix}-title">Parametri CRT</h2><button class="icon-button" type="button" data-crt-close aria-label="Chiudi parametri CRT">×</button></header><div class="crt-drawer-scroll">${basicControls}<section class="crt-advanced-group" aria-label="CRT avanzato"><h3>CRT avanzato · fosfori e luce</h3><div class="crt-master-controls"><label for="${prefix}-enabled"><input id="${prefix}-enabled" type="checkbox" data-crt-enabled checked> Attiva CRT avanzato</label><label for="${prefix}-strength">Intensità avanzato</label><div class="crt-param-inputs"><input id="${prefix}-strength" type="range" min="0" max="100" step="1" value="100" data-crt-strength><output data-crt-strength-output>100%</output></div></div><p class="crt-help">Indipendente dal CRT base. Usa “Base di lavoro” per il preset dello stage o “Azzera avanzato” per ripartire da zero. Gamma e luminosità a 0 sono neutre; punto del bianco a 0 equivale a 255. Per vedere la maschera dei fosfori, aumenta sia dimensione sia passo.</p><p class="crt-runtime" data-crt-runtime role="status"></p><div class="crt-groups">${groups.map(([name,items])=>`<fieldset><legend>${name}</legend>${items.map(f=>{
      const [key,label,min,max,step]=f,domId=prefix+'-'+key;
      return Array.isArray(min)?`<label class="crt-choice" for="${domId}">${label}<select id="${domId}" data-crt-param="${key}">${min.map(value=>`<option value="${value}">${value.toUpperCase()}</option>`).join('')}</select></label>`:
        `<div class="crt-param"><label for="${domId}">${label}</label><div class="crt-param-inputs"><input type="range" id="${domId}" data-crt-param="${key}" min="${min}" max="${max}" step="${step}"><input type="number" data-crt-number="${key}" min="${min}" max="${max}" step="${step}" aria-label="Valore: ${label}"></div></div>`;
    }).join('')}</fieldset>`).join('')}</div></section></div><footer class="crt-drawer-footer"><div class="crt-preset-actions"><button type="button" class="play-button" data-crt-save>Fissa preset avanzato</button><button type="button" class="step-button" data-crt-export>Esporta JSON</button><button type="button" class="step-button" data-crt-import>Importa JSON</button><button type="button" class="step-button" data-crt-base>Base di lavoro</button><button type="button" class="step-button" data-crt-reset>Azzera avanzato</button><input type="file" accept="application/json,.json" data-crt-file hidden></div><p class="crt-preset-status" data-crt-status aria-live="polite"></p></footer></aside>`;
  }
  function launcher(id){
    const prefix='crt-'+String(id).replace(/[^a-z0-9-]/gi,'-');
    return `<button class="step-button crt-launcher" type="button" data-crt-open aria-expanded="false" aria-controls="${prefix}-drawer">Parametri CRT</button>`;
  }
  let activePanel=null;
  function install(card,player,stageId,env=globalThis,basePreset=null){
    const source=card.querySelector('.stage-preview canvas');
    const output=card.querySelector('.stage-crt-output');
    const enabledControl=card.querySelector('[data-crt-enabled]'),strengthInput=card.querySelector('[data-crt-strength]'),strengthOutput=card.querySelector('[data-crt-strength-output]');
    const status=card.querySelector('[data-crt-status]'),runtime=card.querySelector('[data-crt-runtime]');
    const initial=basePreset?parsePreset(JSON.stringify(basePreset)):preset(defaults);
    const storageKey=presetKey(stageId,basePreset);
    let settings={...initial.settings},strength=initial.strength,enabled=initial.enabled,original=false,time=0,disposed=false,available=false;
    const cleanups=[];
    function listen(node,event,handler){node.addEventListener(event,handler);cleanups.push(()=>node.removeEventListener(event,handler));}
    const drawer=card.querySelector('[data-crt-drawer]'),openButton=card.querySelector('[data-crt-open]'),closeButton=card.querySelector('[data-crt-close]');
    function closePanel(restoreFocus=true){
      const wasOpen=!drawer.hidden;drawer.hidden=true;openButton.setAttribute('aria-expanded','false');
      if(activePanel===closePanel){activePanel=null;env.document.body.classList.remove('crt-drawer-open');}
      if(wasOpen&&restoreFocus)openButton.focus({preventScroll:true});
    }
    listen(openButton,'click',()=>{
      if(!drawer.hidden){closePanel();return;}
      if(activePanel)activePanel(false);
      activePanel=closePanel;drawer.hidden=false;openButton.setAttribute('aria-expanded','true');
      env.document.body.classList.add('crt-drawer-open');
      card.scrollIntoView({block:'start',behavior:'auto'});closeButton.focus({preventScroll:true});
    });
    listen(closeButton,'click',()=>closePanel());
    listen(env.document,'keydown',event=>{if(event.key==='Escape'&&!drawer.hidden){event.preventDefault();closePanel();}});
    try{const saved=env.localStorage.getItem(storageKey);if(saved){const value=parsePreset(saved);settings=value.settings;strength=value.strength;enabled=value.enabled;status.textContent='Preset avanzato fissato caricato.';}}catch{}
    function effectiveStrength(){return enabled&&!original?strength:0;}
    function appearance(){
      output.hidden=!available||effectiveStrength()<=0;
    }
    const renderer=env.CrtWebGL.create(source,output,()=>{
      available=false;runtime.textContent='CRT avanzato non disponibile. I controlli CRT base restano utilizzabili. Apri la demo tramite il server locale e ricarica per riprovare.';appearance();
    });
    available=renderer.supported;
    runtime.textContent=available?'Anteprima CRT WebGL · 1920 × 1080.':'WebGL non disponibile: puoi usare il CRT base e preparare un preset avanzato.';
    function render(){
      if(disposed)return;
      appearance();
      const value=effectiveStrength();
      if(available&&value>0&&!renderer.render(settings,value,time)){available=false;appearance();}
    }
    const controls=fields.map(field=>({field,input:card.querySelector(`[data-crt-param="${field[0]}"]`),number:Array.isArray(field[2])?null:card.querySelector(`[data-crt-number="${field[0]}"]`)}));
    function sync(){
      controls.forEach(({field,input,number})=>{input.value=settings[field[0]];if(number)number.value=settings[field[0]];});
      enabledControl.checked=enabled;strengthInput.value=strength*100;strengthInput.disabled=!enabled;strengthOutput.textContent=Math.round(strength*100)+'%';
    }
    listen(enabledControl,'change',()=>{enabled=enabledControl.checked;sync();render();});
    listen(strengthInput,'input',()=>{strength=Math.max(0,Math.min(1,Number(strengthInput.value)/100||0));sync();render();});
    controls.forEach(({field,input,number})=>{
      function change(node){
        const value=Array.isArray(field[2])?node.value:Number(node.value);
        if(number&&(node.value===''||!Number.isFinite(value)))return;
        settings=normalize({...settings,[field[0]]:value});sync();render();status.textContent='Configurazione modificata. Premi “Fissa preset” per conservarla.';
      }
      listen(input,Array.isArray(field[2])?'change':'input',()=>change(input));
      if(number)listen(number,'change',()=>change(number));
    });
    function reset(){settings={...defaults};sync();render();status.textContent='Parametri avanzati azzerati. Il CRT base resta invariato.';}
    listen(card.querySelector('[data-crt-reset]'),'click',reset);
    listen(card.querySelector('[data-crt-base]'),'click',()=>{
      settings={...initial.settings};strength=initial.strength;enabled=initial.enabled;sync();render();
      status.textContent='Base di lavoro dello stage ripristinata.';
    });
    listen(card.querySelector('[data-crt-save]'),'click',()=>{
      try{env.localStorage.setItem(storageKey,JSON.stringify(preset(settings,strength,enabled)));status.textContent='Preset avanzato fissato in questo browser. Il CRT base resta separato.';}
      catch{status.textContent='Salvataggio locale non disponibile. Usa “Esporta JSON” per conservare il preset.';}
    });
    listen(card.querySelector('[data-crt-export]'),'click',()=>{
      const blob=new env.Blob([JSON.stringify(preset(settings,strength,enabled),null,2)+'\n'],{type:'application/json'});
      const url=env.URL.createObjectURL(blob),link=env.document.createElement('a');
      link.href=url;link.download=stageId+'-crt-preset.json';env.document.body.append(link);link.click();link.remove();
      env.setTimeout(()=>env.URL.revokeObjectURL(url),1000);status.textContent='Preset esportato in JSON.';
    });
    const fileInput=card.querySelector('[data-crt-file]');
    listen(card.querySelector('[data-crt-import]'),'click',()=>fileInput.click());
    listen(fileInput,'change',async()=>{
      const file=fileInput.files?.[0];if(!file)return;
      try{
        if(file.size>65536)throw Error('Il preset è troppo grande.');
        const value=parsePreset(await file.text());if(disposed)return;
        settings=value.settings;strength=value.strength;enabled=value.enabled;sync();
        render();status.textContent='Preset importato. Premi “Fissa preset” per usarlo ai prossimi avvii.';
      }catch(error){if(!disposed)status.textContent='Importazione non riuscita: '+error.message;}
      fileInput.value='';
    });
    sync();appearance();
    player.setPostProcess((canvas,elapsed)=>{time=elapsed;render();});
    return {setStrength(value){strength=Math.max(0,Math.min(1,Number(value)||0));sync();render();},setOriginal(value){original=Boolean(value);render();},reset,
      destroy(){disposed=true;closePanel(false);player.setPostProcess(null);cleanups.forEach(cleanup=>cleanup());renderer.destroy();output.hidden=true;}};
  }
  return Object.freeze({groups,fields,defaults,normalize,preset,parsePreset,presetKey,markup,launcher,install});
});
