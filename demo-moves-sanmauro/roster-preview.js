(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./player-core.js'));
  else root.MovesRoster = factory(root.MovesCore);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  'use strict';
  function install(grid, characters) {
    const cache = new Map();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let active = null, request = null;
    function stop() {
      if (request !== null) cancelAnimationFrame(request);
      request = null;
      if (active) {
        active.canvas.hidden = true;
        active.card.classList.remove('is-idle');
      }
      active = null;
    }
    function load(url) {
      if (cache.has(url)) return cache.get(url);
      const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
      cache.set(url, promise);
      // Large spritesheets: retain only two recent images.
      if (cache.size > 2) cache.delete(cache.keys().next().value);
      promise.catch(() => cache.delete(url));
      return promise;
    }
    function tick(time) {
      request = null;
      if (!active) return;
      if (active.card.hidden) { stop(); return; }
      if (document.hidden) { active.lastTime = null; return; }
      const state = active;
      if (state.lastTime !== null) state.frame = core.advance(state.frame, Math.min(time - state.lastTime, 250), core.effectiveFps(state.idle, 1), state.idle.frames.length, true);
      state.lastTime = time;
      const [x,y,w,h] = state.idle.frames[state.frame.frame];
      state.context.clearRect(0,0,state.canvas.width,state.canvas.height);
      state.context.imageSmoothingEnabled = false;
      const destination=state.idle.preview?.drawRect??[0,0,state.canvas.width,state.canvas.height];
      state.context.drawImage(state.image,x,y,w,h,...destination);
      state.canvas.hidden = false;
      state.card.classList.add('is-idle');
      if (!reducedMotion.matches) request = requestAnimationFrame(tick);
    }
    for (const card of grid.querySelectorAll('.character-card')) {
      const character = characters.find(c => c.id === card.dataset.character);
      const idle = character?.animations.find(a => a.id === 'idle');
      if (!idle?.frames.length) continue;
      let canvas;
      async function start() {
        if (active?.card === card) return;
        stop();
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.className = 'card-idle'; canvas.hidden = true;
          canvas.width = idle.frameWidth; canvas.height = idle.frameHeight;
          canvas.setAttribute('aria-hidden', 'true');
          card.querySelector('.card-portrait').append(canvas);
        }
        const context = canvas.getContext('2d');
        if (!context) return;
        const state = {card,canvas,context,idle,frame:{frame:0,remainder:0},lastTime:null};
        active = state;
        try {
          state.image = await load(idle.image);
          if (active !== state) return;
          if (card.hidden) { stop(); return; }
          tick(performance.now());
        } catch { if (active === state) stop(); }
      }
      function leave() {
        if (active?.card === card && !card.matches(':hover') && document.activeElement !== card) stop();
      }
      card.addEventListener('mouseenter', start);
      card.addEventListener('mouseleave', leave);
      card.addEventListener('focus', start);
      card.addEventListener('blur', leave);
    }
    document.addEventListener('visibilitychange', () => {
      if (!active?.image) return;
      active.lastTime = null;
      if (document.hidden) {
        if (request !== null) cancelAnimationFrame(request);
        request = null;
      } else if (request === null) tick(performance.now());
    });
    return {stop,refresh() { if (active?.card.hidden) stop(); }};
  }
  return Object.freeze({install});
});
