const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../stage-storm-audio.js');
function fixture(){
  const sources=[],gains=[];let closed=false;
  function node(){return {connect(){},disconnect(){}};}
  class AudioContext{
    constructor(){this.currentTime=1;this.sampleRate=8000;this.state='running';this.destination=node();}
    createBuffer(_,size){return {getChannelData:()=>new Float32Array(size)};}
    createGain(){const n=node();n.gain={value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};gains.push(n);return n;}
    createBiquadFilter(){return {...node(),frequency:{value:0}};}
    createBufferSource(){const s={...node(),start(t=0){this.started=t;},stop(t=0){this.stopped=t;}};sources.push(s);return s;}
    async resume(){}
    async close(){closed=true;}
  }
  return {audio:create({AudioContext}),sources,gains,get closed(){return closed;}};
}
test('storm audio starts only on enable, syncs once per strike and mutes with visibility',async()=>{
  const f=fixture();assert.equal(f.sources.length,0);
  assert.equal(await f.audio.setEnabled(true),true);assert.equal(f.sources.length,1);
  const update=(elapsed,extra={})=>f.audio.update({rain:true,lightning:true,hidden:false,elapsed,...extra});
  update(3700);assert.ok(f.gains[1].gain.value>0);
  update(3850);assert.equal(f.sources.length,4);
  assert.ok(f.sources[2].started>f.sources[1].started,'rumble follows crack');
  update(3900);assert.equal(f.sources.length,4,'no repeated strike');
  update(4000,{rain:false});assert.equal(f.gains[1].gain.value,0);
  update(4100,{hidden:true});assert.equal(f.gains[0].gain.value,0);
  assert.ok(f.sources.slice(1).every(s=>s.stopped===0),'hidden page cancels queued thunder');
  await f.audio.setEnabled(false);update(13550);assert.equal(f.sources.length,4);
  f.audio.destroy();assert.equal(f.closed,true);
});
test('unsupported audio fails without breaking the stage',async()=>{
  const audio=create({});assert.equal(await audio.setEnabled(true),false);audio.destroy();
});
