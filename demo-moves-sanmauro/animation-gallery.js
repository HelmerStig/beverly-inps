(function (root) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format = value => new Intl.NumberFormat('it', {maximumFractionDigits:2}).format(value);
  function install(container, character, options = {}) {
    const core = root.MovesCore;
    const reduced = root.matchMedia('(prefers-reduced-motion: reduce)');
    const cleanups = [];
    let frameRequest = null, disposed = false, groupElapsed=0, groupLast=null;
    const timingLabel=(animation,multiplier=1)=>animation.attackDurationMs ? `${format(animation.attackDurationMs/1000/multiplier)} s / estensione ${format(animation.impactMs/1000/multiplier)} s` : animation.poseDurationMs ? `${format(animation.poseDurationMs/1000/multiplier)} s / ${format(core.effectiveFps(animation,multiplier))} fps` : animation.reactionDurationMs ? `${format(animation.reactionDurationMs/1000/multiplier)} s / ${format(core.effectiveFps(animation,multiplier))} fps` : animation.guardDurationMs ? `${format(animation.guardDurationMs/1000/multiplier)} s / ${format(core.effectiveFps(animation,multiplier))} fps` : animation.apexMs ? `${format(animation.durationMs/1000/multiplier)} s / apice ${format(animation.apexMs/1000/multiplier)} s` : animation.takeoffMs ? `${format(animation.durationMs/1000/multiplier)} s / stacco ${format(animation.takeoffMs/multiplier)} ms` : animation.blockMs ? `${format(core.effectiveFps(animation,multiplier))} fps / parata ${format(animation.blockMs/1000/multiplier)} s` : animation.frameDurations && !Number.isFinite(animation.impactMs) ? `${format(animation.durationMs/1000/multiplier)} s / ${format(core.effectiveFps(animation,multiplier))} fps` : animation.frameDurations ? `${format(animation.durationMs/1000/multiplier)} s / impatto ${format(animation.impactMs/1000/multiplier)} s` : `${format(core.effectiveFps(animation,multiplier))} fps`;
    const listen = (node, type, callback) => {
      node.addEventListener(type, callback);
      cleanups.push(() => node.removeEventListener(type, callback));
    };
    container.innerHTML = `<div class="gallery-toolbar"><div><h2>${escape(options.title ?? 'Tutte le animazioni')} <span class="count-pill">${character.animations.length}</span></h2><p>${escape(options.description ?? 'Confronta le mosse e controlla ogni anteprima.')}</p></div><div class="gallery-actions"><button type="button" class="play-button" data-action="play-all">Riproduci tutte</button><button type="button" class="step-button" data-action="pause-all">Pausa tutte</button></div></div><div class="animation-gallery">${character.animations.map((animation, index) => `
      <section class="player-panel animation-card" data-animation-card="${index}" aria-label="${escape(animation.name)} di ${escape(animation.characterName ?? character.name)}" id="animation-${index}">
        <div class="panel-header"><h3><span class="playing-dot is-paused" aria-hidden="true"></span>${animation.characterId ? `<a href="personaggio.html?id=${encodeURIComponent(animation.characterId)}&amp;anim=${encodeURIComponent(animation.id)}">${escape(animation.characterName)}</a>` : escape(animation.name)}</h3><span class="version-tag">${animation.trimmed ? 'TRIMMED' : 'COMPLETA'}</span></div>
        <div class="stage" data-background="dark" aria-busy="true"><canvas width="${animation.frameWidth}" height="${animation.frameHeight}" tabindex="0" role="img" aria-label="${escape(animation.name)} di ${escape(animation.characterName ?? character.name)}">Anteprima di ${escape(animation.name)}.</canvas><div class="stage-loading" role="status">Caricamento ${escape(animation.name)}…</div><div class="stage-error" role="alert" hidden></div></div>
        <div class="player-controls">
          <div class="timeline"><input data-role="timeline" type="range" min="0" max="${animation.frames.length-1}" value="0" step="1" aria-label="Frame di ${escape(animation.name)}" disabled><span class="frame-counter">01 / ${animation.frames.length}</span></div>
          <div class="controls-row"><div class="transport"><button class="play-button" data-action="play" type="button" disabled>▶ Riproduci</button><button class="step-button" data-action="step" type="button" aria-label="Frame successivo di ${escape(animation.name)}" disabled>▹|</button></div><label class="loop-control"><input data-role="loop" type="checkbox" checked> Loop</label><label class="speed-control">Velocità <select data-role="speed" aria-label="Velocità di ${escape(animation.name)}"><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1× · ${timingLabel(animation)}</option><option value="1.5">1,5×</option><option value="2">2×</option></select></label></div>
          <div class="gallery-card-meta"><span>${animation.frames.length} frame · ${animation.frameWidth} × ${animation.frameHeight}</span><span data-role="fps">${timingLabel(animation)}</span></div>
          <div class="gallery-card-bottom"><div class="swatches" role="group" aria-label="Sfondo di ${escape(animation.name)}"><button class="swatch" type="button" data-background="dark" aria-label="Sfondo scuro" aria-pressed="true"></button><button class="swatch" type="button" data-background="light" aria-label="Sfondo chiaro" aria-pressed="false"></button><button class="swatch" type="button" data-background="checker" aria-label="Sfondo a scacchi" aria-pressed="false"></button></div><a class="download-button" href="${escape(animation.image)}" download="${escape(animation.characterId ?? character.id)}-${escape(animation.id)}.png">Scarica PNG ↓</a></div>
        </div>
      </section>`).join('')}</div>`;

    const cards = [...container.querySelectorAll('[data-animation-card]')];
    const players = cards.map((card, index) => {
      const animation = character.animations[index];
      const $ = selector => card.querySelector(selector);
      const canvas = $('canvas'), context = canvas.getContext('2d');
      const stage = $('.stage'), slider = $('[data-role="timeline"]');
      const play = $('[data-action="play"]'), step = $('[data-action="step"]');
      const speed = $('[data-role="speed"]'), loop = $('[data-role="loop"]');
      const state = {loaded:false, requested:!reduced.matches, playing:false, visible:!root.IntersectionObserver, frame:0, remainder:0, lastTime:null, following:Boolean(animation.frameDurations)};
      let image = null, started = false;
      const fps = () => core.effectiveFps(animation, Number(speed.value));
      function sync() {
        state.playing = state.loaded && state.requested;
        play.textContent = state.playing ? 'Ⅱ Pausa' : '▶ Riproduci';
        play.setAttribute('aria-label', `${state.playing ? 'Metti in pausa' : 'Riproduci'} ${animation.name}`);
        $('.playing-dot').classList.toggle('is-paused', !state.playing);
      }
      function draw() {
        if (!state.loaded) return;
        const [x,y,w,h] = animation.frames[state.frame];
        context.clearRect(0,0,canvas.width,canvas.height);
        context.imageSmoothingEnabled = false;
        const destination=animation.preview?.drawRect??[0,0,canvas.width,canvas.height];
        context.drawImage(image,x,y,w,h,...destination);
        slider.value = state.frame;
        slider.setAttribute('aria-valuetext', `Frame ${state.frame+1} di ${animation.frames.length}`);
        $('.frame-counter').textContent = `${String(state.frame+1).padStart(2,'0')} / ${animation.frames.length}`;
      }
      function setPlaying(value) {
        state.following=false;state.requested = value; state.lastTime = null;
        if (value && state.frame === animation.frames.length-1 && !loop.checked) {state.frame=0;state.remainder=0;draw();}
        sync(); schedule();
      }
      function showFrame(frame) {
        setPlaying(false);state.frame=Math.max(0,Math.min(animation.frames.length-1,frame));state.remainder=0;draw();
      }
      function fail(message) {
        state.loaded=false;state.playing=false;sync();
        $('.stage-loading').hidden=true;$('.stage-error').hidden=false;$('.stage-error').textContent=message;
        stage.setAttribute('aria-busy','false');
      }
      function load() {
        if(started || disposed) return;
        started=true;
        if(!context){fail('Questo browser non supporta l’anteprima canvas.');return;}
        image=new root.Image();
        image.onload=()=>{
          if(disposed)return;
          if(!animation.frames.length || animation.frames.some(([x,y,w,h])=>x<0||y<0||w<=0||h<=0||x+w>image.naturalWidth||y+h>image.naturalHeight)) {
            fail('Lo spritesheet non corrisponde ai frame del catalogo.');return;
          }
          state.loaded=true;slider.disabled=false;play.disabled=false;step.disabled=false;
          $('.stage-loading').hidden=true;stage.setAttribute('aria-busy','false');sync();draw();schedule();
        };
        image.onerror=()=>{if(!disposed)fail('Impossibile caricare lo spritesheet di '+animation.name+'.');};
        image.src=animation.image;
      }
      listen(play,'click',()=>setPlaying(!state.requested));
      listen(step,'click',()=>showFrame((state.frame+1)%animation.frames.length));
      listen(slider,'input',()=>showFrame(Number(slider.value)));
      listen(speed,'change',()=>{state.following=false;state.lastTime=null;$('[data-role="fps"]').textContent=timingLabel(animation,Number(speed.value));});
      listen(canvas,'keydown',event=>{
        if(!state.loaded)return;
        if(event.code==='Space'){event.preventDefault();setPlaying(!state.requested);}
        if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();showFrame((state.frame+(event.key==='ArrowRight'?1:-1)+animation.frames.length)%animation.frames.length);}
      });
      card.querySelectorAll('.swatch').forEach(button=>listen(button,'click',()=>{
        stage.dataset.background=button.dataset.background;
        card.querySelectorAll('.swatch').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      }));
      return {card,animation,state,load,setPlaying,draw,tick(time){
        if(!state.playing||!state.visible||document.hidden){state.lastTime=null;return;}
        if(state.lastTime!==null||state.following){
          const next=state.following ? core.advanceAnimation({frame:0,remainder:0},groupElapsed,animation,Number(speed.value),loop.checked) : core.advanceAnimation(state,Math.min(time-state.lastTime,250),animation,Number(speed.value),loop.checked);
          const changed=next.frame!==state.frame;state.frame=next.frame;state.remainder=next.remainder;
          if(changed)draw();
          if(next.ended){state.requested=false;sync();}
        }
        state.lastTime=time;
      }};
    });
    function active(){return !disposed&&!document.hidden&&players.some(p=>p.state.playing&&p.state.visible);}
    function tick(time){frameRequest=null;if(groupLast!==null)groupElapsed+=Math.min(Math.max(0,time-groupLast),250);groupLast=time;players.forEach(p=>p.tick(time));schedule();}
    function schedule(){if(frameRequest===null&&active())frameRequest=root.requestAnimationFrame(tick);}
    function resetClock(){
      groupLast=null;
      players.forEach(p=>p.state.lastTime=null);
      if(frameRequest!==null){root.cancelAnimationFrame(frameRequest);frameRequest=null;}
      schedule();
    }
    const playAll=()=>{
      groupElapsed=0;groupLast=null;
      players.forEach(p=>{p.state.frame=0;p.state.remainder=0;p.setPlaying(true);p.state.following=Boolean(p.animation.frameDurations);p.draw();});
    };
    const pauseAll=()=>{players.forEach(p=>p.setPlaying(false));resetClock();};
    listen(container.querySelector('[data-action="play-all"]'),'click',playAll);
    listen(container.querySelector('[data-action="pause-all"]'),'click',pauseAll);
    listen(document,'visibilitychange',resetClock);
    if(reduced.addEventListener)listen(reduced,'change',()=>{if(reduced.matches)pauseAll();});
    let observer;
    if(root.IntersectionObserver){
      observer=new root.IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          const player=players.find(p=>p.card===entry.target);
          if(!player)return;
          player.state.visible=entry.isIntersecting;player.state.lastTime=null;
          if(entry.isIntersecting)player.load();
        });
        resetClock();
      },{rootMargin:'200px'});
      players.forEach(p=>observer.observe(p.card));
    }else players.forEach(p=>p.load());
    const highlighted=players.find(p=>p.animation.id===options.highlightId);
    if(highlighted){highlighted.card.classList.add('animation-highlight');highlighted.card.scrollIntoView({block:'start'});}
    return {playAll,pauseAll,destroy(){
      disposed=true;observer?.disconnect();
      if(frameRequest!==null)root.cancelAnimationFrame(frameRequest);
      cleanups.forEach(cleanup=>cleanup());
    }};
  }
  root.MovesGallery=Object.freeze({install});
})(typeof globalThis!=='undefined'?globalThis:this);
