(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.StageCloudsWebGL=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function lightningState(elapsed){
    const cycle=Math.floor(elapsed/9700),phase=elapsed%9700-3800;
    // One short, smooth pulse per storm event, followed by a soft afterglow.
    const flash=phase>=0&&phase<650?Math.exp(-phase/170)*Math.min(1,phase/35):0;
    return {flash,bolt:phase>=0&&phase<260?Math.sin(Math.PI*phase/260):0,
      x:0.2+((cycle*0.317)%0.6),seed:cycle%100};
  }
  const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const fragment=`
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 uv;uniform float time;uniform float worldWidth;uniform float camera;uniform vec2 viewport;
    uniform float flash;uniform float bolt;uniform float strikeX;uniform float seed;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
    float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.03+vec2(9.2,4.7);a*=.5;}return n;}
    float segmentDistance(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
    void main(){
      // Quantize in stage pixels, so the pattern keeps its chunky pixel scale
      // in fullscreen as well as in the page preview.
      vec2 pixel=floor(vec2(uv.x*viewport.x+camera,(1.-uv.y)*viewport.y)/6.)*6.;
      vec2 world=vec2(pixel.x/worldWidth,pixel.y/viewport.y);
      vec2 p=vec2(world.x*5.,world.y*4.5);
      // Sampling toward increasing X makes both cloud fields drift left.
      float far=fbm(p+vec2(time*.022,0.));
      float near=fbm(p*1.65+vec2(time*.047,4.3));
      float band=1.-smoothstep(.42,.80,world.y);
      float density=(smoothstep(.36,.67,far)*.72+smoothstep(.46,.74,near)*.48)*band;
      density=floor(clamp(density,0.,.92)*5.)/5.;
      float shade=floor(smoothstep(.35,.75,far)*3.)/3.;
      vec3 color=mix(vec3(.045,.055,.09),vec3(.17,.19,.27),shade);
      color=mix(color,vec3(.58,.65,.86),flash*.65);
      if(bolt>0.){
        float distanceToBolt=10000.;
        vec2 previous=vec2(strikeX*worldWidth,viewport.y*.1);
        for(int i=1;i<=8;i++){
          float n=float(i);
          vec2 next=vec2(strikeX*worldWidth+(hash(vec2(n,seed+2.))-.5)*130.,viewport.y*(.1+n*.065));
          distanceToBolt=min(distanceToBolt,segmentDistance(pixel,previous,next));
          if(i==4||i==6){
            vec2 branch=next+vec2(95.,65.);
            distanceToBolt=min(distanceToBolt,segmentDistance(pixel,next,branch));
          }
          previous=next;
        }
        float core=(1.-step(5.,distanceToBolt))*bolt;
        float glow=(1.-smoothstep(5.,32.,distanceToBolt))*bolt*.35;
        float light=max(core,glow);
        color=mix(color,vec3(.78,.86,1.),light);
        density=max(density,light);
      }
      gl_FragColor=vec4(color,density);
    }`;
  function create(env=globalThis){
    const canvas=env.document.createElement('canvas');
    let gl,program,buffer,dead=false,lost=false;const shaders=[];
    function destroy(){
      if(dead)return;dead=true;
      canvas.removeEventListener('webglcontextlost',onLost);
      if(gl){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));}
      canvas.width=canvas.height=1;
    }
    function onLost(event){event.preventDefault();lost=true;}
    try{
      gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
      if(!gl)return {supported:false,render(){return false;},destroy};
      for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
        const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      }
      program=gl.createProgram();shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const position=gl.getAttribLocation(program,'position');
      const loc=Object.fromEntries(['time','worldWidth','camera','viewport','flash','bolt','strikeX','seed'].map(name=>[name,gl.getUniformLocation(program,name)]));
      canvas.addEventListener('webglcontextlost',onLost);
      return {supported:true,render(context,width,height,elapsed,camera,worldWidth,lightning=false){
        if(dead||lost)return false;
        const w=Math.min(960,width),h=Math.round(w*height/width);
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
        gl.viewport(0,0,w,h);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
        gl.uniform1f(loc.time,elapsed/1000);gl.uniform1f(loc.worldWidth,worldWidth);gl.uniform1f(loc.camera,camera);gl.uniform2f(loc.viewport,width,height);
        const strike=lightning?lightningState(elapsed):{flash:0,bolt:0,x:0,seed:0};
        gl.uniform1f(loc.flash,strike.flash);gl.uniform1f(loc.bolt,strike.bolt);gl.uniform1f(loc.strikeX,strike.x);gl.uniform1f(loc.seed,strike.seed);
        gl.drawArrays(gl.TRIANGLES,0,6);
        context.save();context.globalAlpha=1;context.filter='none';context.imageSmoothingEnabled=false;
        context.drawImage(canvas,0,0,width,height);context.restore();return true;
      },destroy};
    }catch(error){env.console?.warn('Nuvole WebGL non disponibili:',error);destroy();return {supported:false,render(){return false;},destroy};}
  }
  return Object.freeze({create,vertex,fragment,lightningState});
});
