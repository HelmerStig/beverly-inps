const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../crt-webgl.js');
const {defaults}=require('../crt-panel.js');

function gpu({compile=true,tainted=false}={}){
  let id=0,active=0,framebuffer=null,program=null;
  const bindings=new Map(),draws=[],deleted=[];
  const gl={};
  for(const [i,key] of ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','TEXTURE_2D','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','NEAREST','LINEAR','ARRAY_BUFFER','STATIC_DRAW','FRAMEBUFFER','RGBA','UNSIGNED_BYTE','COLOR_ATTACHMENT0','FRAMEBUFFER_COMPLETE','MAX_TEXTURE_SIZE','FLOAT','TRIANGLE_STRIP','UNPACK_FLIP_Y_WEBGL'].entries())gl[key]=i+1;
  gl.TEXTURE0=100;
  for(const name of ['Shader','Program','Texture','Framebuffer','Buffer']){
    gl['create'+name]=()=>({id:++id,kind:name,samplers:new Map()});
    gl['delete'+name]=value=>deleted.push(value);
  }
  for(const name of ['shaderSource','compileShader','attachShader','linkProgram','texParameteri','bindBuffer','bufferData','viewport','enableVertexAttribArray','vertexAttribPointer','uniform2f','uniform1f','pixelStorei'])gl[name]=()=>{};
  gl.getShaderParameter=()=>compile;gl.getProgramParameter=()=>true;gl.getAttribLocation=()=>0;
  gl.getParameter=()=>4096;gl.checkFramebufferStatus=()=>gl.FRAMEBUFFER_COMPLETE;
  gl.activeTexture=unit=>{active=unit-gl.TEXTURE0;};
  gl.bindTexture=(type,texture)=>bindings.set(active,texture);
  gl.bindFramebuffer=(type,value)=>{framebuffer=value;};
  gl.framebufferTexture2D=(target,attachment,type,texture)=>{framebuffer.texture=texture;};
  gl.useProgram=value=>{program=value;};
  gl.getUniformLocation=(p,name)=>({program:p,name});
  gl.uniform1i=(loc,value)=>{if(['image','original','bloom'].includes(loc.name))loc.program.samplers.set(loc.name,value);};
  gl.texImage2D=(...args)=>{if(tainted&&args.length===6)throw Error('Canvas tainted');};
  gl.drawArrays=()=>{
    if(framebuffer)for(const unit of program.samplers.values())assert.notEqual(bindings.get(unit),framebuffer.texture,'nessuna lettura dal buffer scritto nello stesso passaggio');
    draws.push(framebuffer);
  };
  const canvas={width:0,height:0,listeners:{},getContext:()=>gl,addEventListener(k,f){this.listeners[k]=f;},removeEventListener(k){delete this.listeners[k];}};
  return {canvas,draws,deleted};
}

test('pipeline CRT a sei passaggi senza feedback; ridimensionamento e rilascio risorse',()=>{
  const f=gpu(),source={width:1920,height:1080};
  const renderer=create(source,f.canvas);assert.equal(renderer.supported,true);
  const enabled={...defaults,dotPitch:3,dotScale:1};
  assert.equal(renderer.render(enabled,1,0),true);assert.equal(f.draws.length,6);assert.equal(f.draws.at(-1),null);
  assert.equal(f.canvas.width,1920);assert.equal(f.canvas.height,1080);
  renderer.render(defaults,0,0);assert.equal(f.draws.length,6);
  source.width=960;source.height=540;renderer.render(enabled,.5,100);assert.equal(f.canvas.width,960);
  renderer.destroy();assert.ok(f.deleted.some(v=>v.kind==='Texture'));assert.ok(f.deleted.some(v=>v.kind==='Program'));assert.equal(f.canvas.listeners.webglcontextlost,undefined);
});

test('parametri tutti a zero: copia diretta della sorgente senza maschera o correzione gamma',()=>{
  const f=gpu(),renderer=create({width:1920,height:1080},f.canvas);
  assert.equal(renderer.render(defaults,1,0),true);assert.equal(f.draws.length,1);
  assert.equal(f.draws[0],null);renderer.destroy();
});

test('compilazione fallita, origine non leggibile e contesto perso ritornano al fallback',()=>{
  const broken=gpu({compile:false});assert.equal(create({width:1920,height:1080},broken.canvas).supported,false);assert.ok(broken.deleted.length>0);
  let errors=0;const tainted=gpu({tainted:true}),source={width:1920,height:1080};
  const renderer=create(source,tainted.canvas,()=>errors++);assert.equal(renderer.render(defaults,1,0),false);assert.equal(errors,1);
  assert.equal(renderer.render(defaults,1,0),false);assert.equal(errors,1);renderer.destroy();
  const lost=gpu(),r=create(source,lost.canvas,()=>errors++);lost.canvas.listeners.webglcontextlost({preventDefault(){}});
  assert.equal(r.render(defaults,1,0),false);r.destroy();
});
