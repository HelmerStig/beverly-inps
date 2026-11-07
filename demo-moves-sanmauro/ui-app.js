(() => {
  'use strict';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const container=document.querySelector('#ui-list'),screens=window.UI_CATALOG?.screens;
  if(!screens?.length){container.innerHTML='<p class="notice">Catalogo UI non disponibile.</p>';return;}
  document.querySelector('#ui-count').textContent=screens.length;
  container.innerHTML=screens.map(screen=>`<section class="stage-card ui-card" aria-labelledby="screen-${escape(screen.id)}"><div class="panel-header"><h2 id="screen-${escape(screen.id)}">${escape(screen.name)}</h2><div class="stage-header-actions"><span class="version-tag">PARALLAX</span>${StageCrt.launcher(screen.id)}<button type="button" class="step-button stage-fullscreen-toggle" data-stage-fullscreen aria-pressed="false" aria-controls="stage-screen-${escape(screen.id)}">Fullscreen</button></div></div>
    <div class="stage-screen" data-stage-screen id="stage-screen-${escape(screen.id)}"><div class="stage-preview"><canvas width="${screen.viewportWidth}" height="${screen.height}" tabindex="0" role="img" aria-label="Fondale della schermata iniziale, nuvole e riflessi in movimento. Trascina o usa le frecce per esplorare i lati." aria-busy="true">${escape(screen.name)}</canvas><canvas class="stage-crt-output" aria-hidden="true" hidden></canvas><div class="stage-crt" aria-hidden="true"></div><p class="stage-status" role="status"></p></div><button type="button" class="step-button stage-fullscreen-exit" data-stage-fullscreen-exit aria-label="Esci da fullscreen">Esci da fullscreen</button></div>
    <p class="stage-fullscreen-message" data-stage-fullscreen-message role="alert" hidden></p><div class="stage-toolbar"><p>Trascina o usa le frecce per esplorare il panorama. Nuvole e riflessi si muovono insieme.</p><button type="button" class="play-button" data-stage-cloud-toggle disabled>Pausa nuvole</button></div>
    ${StageEffects.markup(screen.id)}${StageCrt.markup(screen.id,StageEffects.crtMarkup(screen.id))}
    <details class="ui-layers"><summary>Layer della schermata · ${screen.layers.length} immagini</summary><ul>${screen.layers.map(layer=>`<li><a href="${escape(layer.image)}" download>${escape(layer.name)}</a><small>${layer.speed?layer.speed+' px/s · da destra a sinistra':'Fermo'}</small></li>`).join('')}</ul></details></section>`).join('');
  const players=[...container.querySelectorAll('.ui-card')].map((card,index)=>{
    const screen=screens[index];
    const player=StagesPlayer.install(card.querySelector('canvas'),card.querySelector('[data-stage-cloud-toggle]'),card.querySelector('.stage-status'),screen);
    const fullscreen=StageFullscreen.install(card),crt=StageCrt.install(card,player,screen.id,globalThis,screen.crtPreset);
    const effects=StageEffects.install(card,player,crt);
    for(const key of ['shadows','color'])card.querySelector(`[data-fx-toggle="${key}"]`).closest('.stage-effect').hidden=true;
    return {destroy(){effects.destroy();crt.destroy();fullscreen.destroy();player.destroy();}};
  });
  window.addEventListener('pagehide',()=>players.forEach(player=>player.destroy()));
})();
