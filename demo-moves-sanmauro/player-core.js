(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MovesCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function advance(state, deltaMs, fps, frameCount, loop) {
    if (!Number.isInteger(frameCount) || frameCount < 1 || !Number.isFinite(fps) || fps <= 0) throw new Error('Animazione non valida');
    const duration = 1000 / fps;
    const elapsed = state.remainder + Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0);
    const steps = Math.floor(elapsed / duration + 1e-10);
    const next = state.frame + steps;
    return {frame: loop ? next % frameCount : Math.min(next, frameCount - 1), remainder: Math.max(0, elapsed - steps * duration), ended: !loop && next >= frameCount - 1};
  }
  function advanceAnimation(state, deltaMs, animation, multiplier, loop) {
    const durations=animation.frameDurations;
    if(!durations)return advance(state,deltaMs,effectiveFps(animation,multiplier),animation.frames.length,loop);
    const terminalIdle=Number.isFinite(animation.returnToIdleMs)&&animation.returnToIdleMs>0&&animation.returnToIdleMs===animation.durationMs;
    if(durations.length!==animation.frames.length||durations.some((d,i)=>!Number.isFinite(d)||(d<=0&&!(d===0&&terminalIdle&&i===durations.length-1)))||!Number.isFinite(multiplier)||multiplier<=0)throw new Error('Timing non valido');
    const total=durations.reduce((a,b)=>a+b,0);
    let elapsed=durations.slice(0,state.frame).reduce((a,b)=>a+b,0)+state.remainder+Math.max(0,deltaMs)*multiplier;
    if(!loop&&elapsed>=total-1e-8)return {frame:durations.length-1,remainder:0,ended:true};
    if(loop)elapsed=((elapsed%total)+total)%total;
    if(total-elapsed<1e-8)elapsed=0;
    let frame=0;
    while(frame<durations.length-1&&elapsed>=durations[frame]-1e-8){elapsed=Math.max(0,elapsed-durations[frame]);frame++;}
    return {frame,remainder:elapsed,ended:false};
  }
  function effectiveFps(animation, multiplier) {
    return (animation?.playbackFps ?? 24) * multiplier;
  }
  return Object.freeze({advance, advanceAnimation, effectiveFps});
});
