(() => {
  'use strict';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const container=document.querySelector('#stages-list');
  const stages=window.STAGES_CATALOG;
  document.querySelector('#stages-count').textContent=stages.length;
  container.innerHTML=stages.map(stage=>`<section class="stage-card" aria-labelledby="stage-${escape(stage.id)}"><div class="panel-header"><h2 id="stage-${escape(stage.id)}">${escape(stage.name)}</h2><div class="stage-header-actions"><span class="version-tag">PARALLAX</span>${StageCrt.launcher(stage.id)}<button type="button" class="step-button stage-fullscreen-toggle" data-stage-fullscreen aria-pressed="false" aria-controls="stage-screen-${escape(stage.id)}">Fullscreen</button></div></div><div class="stage-screen" data-stage-screen id="stage-screen-${escape(stage.id)}"><div class="stage-preview"><canvas width="${stage.viewportWidth ?? 1920}" tabindex="0" height="${stage.height}" role="img" aria-label="${escape(stage.name)}, Arianna a sinistra e Oscare a destra in idle, vista 16:9. Trascina o usa le frecce per esplorare i lati" aria-busy="true">Anteprima di ${escape(stage.name)}.</canvas><canvas class="stage-crt-output" aria-hidden="true" hidden></canvas><div class="stage-crt" aria-hidden="true"></div><p class="stage-status" role="status"></p></div><button type="button" class="step-button stage-fullscreen-exit" data-stage-fullscreen-exit aria-label="Esci da fullscreen">Esci da fullscreen</button></div><p class="stage-fullscreen-message" data-stage-fullscreen-message role="alert" hidden></p><div class="stage-toolbar"><p>Trascina per esplorare lo stage. Puoi usare anche le frecce.</p><button type="button" class="play-button" data-stage-cloud-toggle disabled>Pausa nuvole</button></div>${StageEffects.markup(stage.id)}${StageCrt.markup(stage.id,StageEffects.crtMarkup(stage.id))}</section>`).join('');
  const players=[...container.querySelectorAll('.stage-card')].map((card,i)=>{
    const stage=stages[i];
    const fighters=(stage.fighters??[]).map(fighter=>{
      const character=window.SANMAURO_CATALOG.characters.find(c=>c.id===fighter.characterId);
      const animation=character?.animations.find(a=>a.id===fighter.animationId);
      if(!animation)throw new Error('Animazione mancante: '+fighter.characterId);
      const contacts=window.STAGE_FOOT_CONTACTS?.items.find(item=>item.characterId===fighter.characterId);
      if(contacts&&(contacts.image!==animation.image||contacts.frames.length!==animation.frames.length))throw new Error('Rigenera i contatti dei piedi: '+fighter.characterId);
      return {...fighter,animation,footContacts:contacts?.frames};
    });
    const player=StagesPlayer.install(card.querySelector('canvas'),card.querySelector('[data-stage-cloud-toggle]'),card.querySelector('[role="status"]'),{...stage,fighters});
    const fullscreen=StageFullscreen.install(card);
    const crt=StageCrt.install(card,player,stage.id,globalThis,window.STAGE_CRT_PRESETS?.[stage.id]);
    const effects=StageEffects.install(card,player,crt);

    return {destroy(){effects.destroy();crt.destroy();fullscreen.destroy();player.destroy();}};
  });
  window.addEventListener('pagehide',()=>players.forEach(player=>player.destroy()));
})();
