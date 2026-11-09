(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.StageStormAudio=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(env=globalThis){
    let context=null,master=null,rain=null,rainGain=null,enabled=false,disposed=false,lastTime=null;
    const voices=new Set();
    function noise(seconds){
      const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*seconds),context.sampleRate);
      const samples=buffer.getChannelData(0);let seed=51791;
      for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;samples[i]=(seed>>>0)/2147483648-1;}
      return buffer;
    }
    function stopVoices(){for(const voice of voices){try{voice.stop();}catch{}}voices.clear();}
    function setup(){
      const Audio=env.AudioContext??env.webkitAudioContext;
      if(!Audio)return false;
      context=new Audio();master=context.createGain();master.gain.value=0;master.connect(context.destination);
      rainGain=context.createGain();rainGain.gain.value=0;rainGain.connect(master);
      const high=context.createBiquadFilter();high.type='highpass';high.frequency.value=650;
      const low=context.createBiquadFilter();low.type='lowpass';low.frequency.value=7500;
      rain=context.createBufferSource();rain.buffer=noise(4);rain.loop=true;
      rain.connect(high);high.connect(low);low.connect(rainGain);rain.start();
      return true;
    }
    function burst(buffer,frequency,volume,delay,duration){
      const source=context.createBufferSource();source.buffer=buffer;
      const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=frequency;
      const gain=context.createGain(),start=context.currentTime+delay;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
      source.connect(filter);filter.connect(gain);gain.connect(master);voices.add(source);
      source.onended=()=>{voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};
      source.start(start);source.stop(start+duration);
    }
    let thunderNoise=null,crackNoise=null;
    function strike(cycle){
      thunderNoise??=noise(4);crackNoise??=noise(.2);
      burst(crackNoise,4800,.85,0,.18);
      burst(thunderNoise,220,1.90,.35+(cycle%3)*.12,3.5);
      burst(thunderNoise,90,1.30,.70+(cycle%2)*.10,3.1);
    }
    async function setEnabled(value){
      if(disposed)return false;
      if(!value){enabled=false;lastTime=null;stopVoices();if(master)master.gain.setTargetAtTime(0,context.currentTime,.04);return false;}
      try{
        if(!context&&!setup())return false;
        await context.resume();
        if(disposed)return false;
        enabled=context.state==='running';lastTime=null;
        return enabled;
      }catch{enabled=false;return false;}
    }
    function update({rain:wet,elapsed,lightning,hidden}){
      if(!context||disposed)return;
      const audible=enabled&&!hidden;
      master.gain.setTargetAtTime(audible?.38:0,context.currentTime,.06);
      rainGain.gain.setTargetAtTime(audible&&wet?.32:0,context.currentTime,.12);
      if(!audible){stopVoices();lastTime=null;return;}
      if(lightning&&lastTime!==null&&elapsed>=lastTime){
        const cycle=Math.floor(elapsed/9700),event=cycle*9700+3800;
        if(lastTime<event&&elapsed>=event)strike(cycle);
      }
      lastTime=elapsed;
    }
    return {setEnabled,update,destroy(){
      disposed=true;enabled=false;stopVoices();
      if(rain){try{rain.stop();}catch{}}
      if(context)context.close().catch(()=>{});
    }};
  }
  return Object.freeze({create});
});
