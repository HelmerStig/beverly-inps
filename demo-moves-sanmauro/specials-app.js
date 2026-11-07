(() => {
  'use strict';
  const data=window.SPECIALS_CATALOG,stage=window.STAGES_CATALOG?.[0],roster=window.SANMAURO_CATALOG;
  const container=document.querySelector('#specials-list');
  if(!data||!stage){container.innerHTML='<p class="notice">Catalogo Special e Super non disponibile.</p>';return;}
  const params=new URLSearchParams(location.search),character=data.characters.find(c=>c.id===params.get('character'))??data.characters[0];
  const id=character.id+'-specials',moves=character.moves,scene=character.id==='arianna'?SpecialsScene:OtherSpecialsScene,escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const targetId=character.id==='oscare'?'arianna':'oscare';
  function fighter(characterId,x,flipX){
    const c=roster.characters.find(c=>c.id===characterId),a=c.animations.find(a=>a.id==='idle'),reference=roster.characters.find(c=>c.id==='arianna').animations.find(a=>a.id==='idle');
    const stageScale=stage.fighters[0].scale/reference.normalizedPreview.scale[0];
    const duration=id=>{const a=c.animations.find(a=>a.id===id);return a.durationMs??a.frames.length/a.playbackFps*1000;};
    return {characterId,x,groundY:stage.height-55,scale:a.normalizedPreview.scale[0]*stageScale*c.stageHeightMultiplier,anchorX:a.normalizedPreview.anchor[0],anchorY:a.normalizedPreview.anchor[1],flipX,knockdownMs:duration('knockdown'),recoveryMs:duration('get-up')};
  }
  const sceneStage=character.id==='arianna'?stage:{...stage,fighters:[fighter(character.id,stage.fighters[0].x,false),fighter(targetId,stage.fighters[1].x,true)]};
  container.innerHTML=`<nav class="specials-choices" aria-label="Personaggi con Special e Super">${data.characters.map(c=>`<a class="step-button" href="specials.html?character=${c.id}" ${c.id===character.id?'aria-current="page"':''}>${escape(c.name)}</a>`).join('')}</nav><section class="stage-card" aria-labelledby="specials-title"><div class="panel-header"><h2 id="specials-title">${escape(character.name)} · Piazza Europa</h2><div class="stage-header-actions">${StageCrt.launcher(id)}<button type="button" class="step-button stage-fullscreen-toggle" data-stage-fullscreen aria-pressed="false" aria-controls="stage-screen-${id}">Fullscreen</button></div></div>
    <div class="specials-choices" role="group" aria-label="Mossa da provare">${moves.map((m,i)=>`<button type="button" class="step-button" data-special="${m.id}" aria-pressed="${i===0}">${escape(m.name)} <small>${m.kind}</small></button>`).join('')}</div>
    <div class="stage-screen" data-stage-screen id="stage-screen-${id}"><div class="stage-preview"><canvas width="1920" height="1080" tabindex="0" role="img" aria-label="Special e Super di ${escape(character.name)} nello stage Piazza Europa. Trascina per esplorare" aria-busy="true"></canvas><canvas class="stage-crt-output" aria-hidden="true" hidden></canvas><div class="stage-crt" aria-hidden="true"></div><p class="stage-status" role="status"></p></div><button type="button" class="step-button stage-fullscreen-exit" data-stage-fullscreen-exit>Esci da fullscreen</button></div><p class="stage-fullscreen-message" data-stage-fullscreen-message role="alert" hidden></p>
    <div class="stage-toolbar specials-toolbar"><button type="button" class="play-button" data-special-play disabled>Pausa</button><button type="button" class="step-button" data-special-replay disabled>Ricomincia</button><label><input type="checkbox" data-special-loop checked> Loop</label><label data-strength-label>Potenza <select data-special-strength><option value="light">Leggera</option><option value="medium">Media</option><option value="heavy">Pesante</option></select></label><button type="button" class="step-button" data-special-shuffle hidden>Nuova ondata</button><button type="button" class="step-button" data-stage-cloud-toggle disabled>Pausa nuvole</button></div>
    <label class="specials-timeline">Tempo <input type="range" min="0" step="1" value="0" data-special-time disabled><output data-special-time-label>0,00 s</output></label><p class="intro" data-special-description></p><p role="status" data-special-status>Caricamento animazioni e proiettili…</p><p><a class="play-button" href="reports/${character.id}-specials.html">Report animazioni e timing →</a></p>
    ${StageEffects.markup(id)}${StageCrt.markup(id,StageEffects.crtMarkup(id))}</section><div id="specials-gallery"></div>`;
  const card=container.querySelector('.stage-card'),$=s=>card.querySelector(s),media=matchMedia('(prefers-reduced-motion: reduce)');
  const player=StagesPlayer.install($('canvas'),$('[data-stage-cloud-toggle]'),$('.stage-status'),{...stage,fighters:[]});
  const fullscreen=StageFullscreen.install(card),crt=StageCrt.install(card,player,id,globalThis,window.STAGE_CRT_PRESETS?.[stage.id]);
  const effects=StageEffects.install(card,player,crt);
  const animations=Object.fromEntries(data.animations.filter(a=>character.id==='arianna'?!a.characterId:a.characterId===character.id).map(a=>[a.id,a]));
  const aliases=character.id==='arianna'?[['arianna-idle','arianna','idle'],['oscare-idle','oscare','idle'],['oscare-hurt','oscare','hurt-high']]:[['caster-idle',character.id,'idle'],['target-idle',targetId,'idle'],['target-hurt',targetId,'hurt-high'],['target-ko',targetId,'knockdown'],['target-recovery',targetId,'get-up']];
  for(const [key,characterId,animationId] of aliases){
    const a=roster.characters.find(c=>c.id===characterId).animations.find(a=>a.id===animationId);
    const contactData=window.STAGE_FOOT_CONTACTS?.items.find(i=>i.characterId===characterId);
    const contacts=animationId==='idle'?contactData?.frames:contactData?.animations?.[animationId]?.frames;
    animations[key]={...a,footContacts:contacts};
  }
  let move=moves.some(m=>m.id===params.get('move'))?params.get('move'):moves[0].id,strength=['light','medium','heavy'].includes(params.get('strength'))?params.get('strength'):'light',seed=Number(params.get('seed'))||7,elapsed=0,lastRaw=null,playing=!media.matches&&params.get('paused')!=='1',ready=false,disposed=false,gallery;
  $('[data-special-strength]').value=strength;
  let current=scene.plan(data,sceneStage,move,strength,seed);
  const images={},render=SpecialsScene.renderer(animations,images);
  function draw(ctx,view){
    if(disposed||!ready)return;
    if(playing&&lastRaw!==null)elapsed+=Math.max(0,view.elapsed-lastRaw);
    lastRaw=view.elapsed;
    if(elapsed>=current.end){if(playing&&$('[data-special-loop]').checked)elapsed%=current.end;else{elapsed=current.end;playing=false;}}
    const state=scene.sample(current,elapsed);render.draw(ctx,state,{...view,sceneTime:elapsed});
    $('[data-special-time]').value=elapsed;$('[data-special-time-label]').textContent=(elapsed/1000).toLocaleString('it',{minimumFractionDigits:2,maximumFractionDigits:2})+' s';
    $('[data-special-play]').textContent=playing?'Pausa':'Riproduci';$('[data-special-play]').setAttribute('aria-pressed',String(playing));
  }
  function change(){
    current=scene.plan(data,sceneStage,move,strength,seed);elapsed=0;lastRaw=null;
    $('[data-special-time]').max=Math.ceil(current.end);$('[data-special-time]').value=0;
    card.querySelectorAll('[data-special]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.special===move)));
    $('[data-strength-label]').hidden=!['baseball','cymbals','cigarette','bottle','welding','shoulder','guitar'].includes(move);$('[data-special-shuffle]').hidden=move!=='cats';
    const intro={baseball:'Mazza da baseball e tornado. La potenza cambia velocità e intensità del proiettile.',dog:'Il fischio richiama Bateau: corsa, attacco, ritorno alla corsa e uscita dallo stage.',cats:'Super con 12 gatti: quattro Tullio, quattro Tilda e quattro Telma. Ordine, intervalli e velocità variano a ogni nuova ondata.'};
    const descriptions={cymbals:'Carica e lancio dei piatti della batteria.',spin:'Rotazione coi pugni e avanzamento di 75 unità Godot/s.',drums:'Preparazione, corsa con le bacchette e due rullate: otto impatti complessivi.',cigarette:'Accensione, lancio e volo della sigaretta.',smoke:'Accensione e fumata sincronizzata con la bocca. Mossa ravvicinata.',bottle:'Torpe (Macchia): lancio, rotazione della bottiglia e frammenti all’impatto.',welding:'Torpe (Macchia): scintille dalla punta del saldatore. Mossa ravvicinata.',shoulder:'Carica elettrica e spallata; mantiene la posa di corsa fino al contatto.',guitar:'Materializzazione e lancio della chitarra elettrica.',baglioni:'Claudio Baglioni: materializzazione, corsa, tre colpi e uscita.',tom:'Tom Waits: materializzazione, corsa, tre colpi di cappello e uscita.'};
    $('[data-special-description]').textContent=(intro[move]??descriptions[move])+' Attivazione a '+(current.spawnMs/1000).toLocaleString('it',{maximumFractionDigits:3})+' s. Timing originali Godot.';
    gallery?.destroy();const selected=moves.find(m=>m.id===move);
    gallery=MovesGallery.install(document.querySelector('#specials-gallery'),{id:character.id,name:character.name,animations:[...(selected.phases??[move]),...selected.projectiles].map(id=>animations[id])},
      {title:'Animazioni e proiettili · '+selected.name,description:'Controlla le sequenze originali oppure osserva la mossa completa nello stage.'});
    if(ready)player.setSceneRenderer(draw);
  }
  card.querySelectorAll('[data-special]').forEach(b=>b.addEventListener('click',()=>{move=b.dataset.special;change();}));
  $('[data-special-strength]').addEventListener('change',e=>{strength=e.target.value;change();});
  $('[data-special-shuffle]').addEventListener('click',()=>{seed=(seed+Math.floor(Math.random()*1000000)+1)>>>0;change();});
  $('[data-special-replay]').addEventListener('click',()=>{elapsed=0;lastRaw=null;playing=true;player.setSceneMotion(true);player.setSceneRenderer(draw);});
  $('[data-special-play]').addEventListener('click',()=>{playing=!playing;lastRaw=null;if(playing){if(elapsed>=current.end)elapsed=0;player.setSceneMotion(true);}player.setSceneRenderer(draw);});
  $('[data-special-time]').addEventListener('input',e=>{elapsed=Number(e.target.value);lastRaw=null;playing=false;player.setSceneRenderer(draw);});
  const reduce=()=>{if(media.matches){playing=false;lastRaw=null;player.setSceneRenderer(draw);}};media.addEventListener('change',reduce);
  change();
  if(params.has('time'))elapsed=Math.max(0,Math.min(current.end,Number(params.get('time'))||0));
  Promise.all([player.loaded,...Object.entries(animations).map(([id,a])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{if(a.frames.some(([x,y,w,h])=>x+w>im.naturalWidth||y+h>im.naturalHeight)){reject(new Error('Spritesheet non valido: '+a.name));return;}images[id]=im;resolve();};im.onerror=()=>reject(new Error('Impossibile caricare '+a.name));im.src=a.image;}))]).then(()=>{
    if(disposed)return;ready=true;$('[data-special-status]').textContent=media.matches?'Anteprima in pausa: premi Riproduci.':'Anteprima pronta.';
    for(const selector of ['[data-special-play]','[data-special-replay]','[data-special-time]'])$(selector).disabled=false;
    player.setSceneRenderer(draw);
  }).catch(error=>{if(!disposed)$('[data-special-status]').textContent=error.message;});
  window.addEventListener('pagehide',()=>{disposed=true;gallery?.destroy();render.destroy();effects.destroy();crt.destroy();fullscreen.destroy();player.destroy();media.removeEventListener('change',reduce);});
})();
