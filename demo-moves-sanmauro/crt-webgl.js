/* CRT di anteprima: implementazione locale, nessuna dipendenza o richiesta esterna. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.CrtWebGL=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const vertex=`attribute vec2 position;
varying vec2 uv;
void main(){uv=position*0.5+0.5;gl_Position=vec4(position,0.0,1.0);}`;
  const header=`precision highp float;
varying vec2 uv;
uniform sampler2D image;
uniform vec2 resolution;
vec3 linearColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(2.2));}
vec3 displayColor(vec3 c){return pow(max(c,vec3(0.0)),vec3(1.0/2.2));}
`;
  const shaders={
    copy:header+`void main(){gl_FragColor=texture2D(image,uv);}`,
    prepare:header+`uniform float blurAmount,grainAmount,gammaValue,blackPoint,whitePoint,time;
float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec3 c=vec3(0.0);float total=0.0;
  if(blurAmount>0.0){
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
      float weight=(x==0?2.0:1.0)*(y==0?2.0:1.0);
      c+=texture2D(image,uv+vec2(float(x),float(y))*blurAmount/resolution).rgb*weight;total+=weight;
    }c/=total;
  }else c=texture2D(image,uv).rgb;
  c+=vec3((noise(floor(uv*resolution)+floor(time*12.0))-0.5)*grainAmount);
  c=clamp((c-vec3(blackPoint))/max(whitePoint-blackPoint,0.005),0.0,1.0);
  c=pow(c,vec3(1.0/max(gammaValue,0.1)));
  gl_FragColor=vec4(linearColor(c),1.0);
}`,
    bright:header+`uniform float threshold;
void main(){vec3 c=texture2D(image,uv).rgb;float l=dot(c,vec3(0.2126,0.7152,0.0722));
gl_FragColor=vec4(c*smoothstep(threshold,min(1.01,threshold+0.15),l),1.0);}`,
    blur:header+`uniform vec2 direction;
uniform float radius;
void main(){
  vec3 c=vec3(0.0);float total=0.0;
  for(int i=-4;i<=4;i++){
    float weight=exp(-float(i*i)/8.0);
    c+=texture2D(image,uv+direction*float(i)*radius/resolution).rgb*weight;total+=weight;
  }gl_FragColor=vec4(c/total,1.0);
}`,
    phosphor:header+`uniform float distortion,dotScale,dotPitch,falloff,brightnessBoost,glowRadius,glowIntensity,convergenceStrength;
uniform int patternType;
uniform vec2 redOffset,blueOffset;
vec2 screenUV(vec2 p){vec2 q=p-0.5;return p+q*dot(q,q)*distortion*2.0;}
vec3 readColor(vec2 p){
  vec2 r=redOffset/resolution*convergenceStrength,b=blueOffset/resolution*convergenceStrength;
  return vec3(texture2D(image,p+r).r,texture2D(image,p).g,texture2D(image,p+b).b);
}
float spot(vec2 local,vec2 halfSize){
  float softness=max(0.02,falloff);
  vec2 edge=1.0-smoothstep(halfSize*(1.0-softness),halfSize,abs(local));
  return edge.x*edge.y;
}
vec3 maskAt(vec2 pixel){
  float pitch=max(dotPitch,1.0),scale=clamp(dotScale,0.05,1.8);
  if(patternType==0){
    vec2 cell=vec2(pitch,pitch);float col=floor(pixel.x/cell.x);
    vec2 p=pixel-vec2(0.0,mod(col,2.0)*pitch*0.5);
    vec2 local=mod(p,cell)-cell*0.5;
    float dots=1.0-smoothstep(pitch*scale*0.5*(1.0-max(falloff,0.02)),pitch*scale*0.5,length(local));
    float channel=mod(floor(p.y/pitch)+col,3.0);
    return vec3(channel<0.5?dots:0.0,channel>0.5&&channel<1.5?dots:0.0,channel>1.5?dots:0.0);
  }
  float cellWidth=pitch/3.0,col=floor(pixel.x/cellWidth);
  float shift=patternType==1?mod(floor(pixel.x/pitch),2.0)*pitch*0.5:0.0;
  vec2 local=mod(pixel-vec2(0.0,shift),vec2(cellWidth,pitch))-vec2(cellWidth,pitch)*0.5;
  float dots=spot(local,vec2(cellWidth*0.46,pitch*0.43)*scale);
  float channel=mod(col,3.0);
  return vec3(channel<0.5?dots:0.0,channel>0.5&&channel<1.5?dots:0.0,channel>1.5?dots:0.0);
}
vec3 emit(vec2 p){if(dotScale<=0.0||dotPitch<=0.0)return readColor(p)*brightnessBoost;return readColor(p)*(vec3(0.32)+maskAt(p*resolution)*2.05)*brightnessBoost;}
void main(){
  vec2 p=screenUV(uv);
  if(p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
  vec3 c=emit(p);
  if(glowIntensity>0.0&&glowRadius>0.0){
    vec3 glow=vec3(0.0);
    for(int i=0;i<8;i++){
      float angle=float(i)*0.785398163;
      vec2 offset=vec2(cos(angle),sin(angle))*glowRadius*max(dotPitch,1.0)/resolution;
      glow+=emit(p+offset);
    }c=mix(c,glow/8.0,glowIntensity*0.65);
  }gl_FragColor=vec4(c,1.0);
}`,
    combine:header+`uniform sampler2D bloom,original;
uniform float bloomIntensity,strength,distortion,vignette;
uniform int blendMode;
void main(){
  vec2 q=uv-0.5,p=uv+q*dot(q,q)*distortion*2.0;
  vec3 c=texture2D(image,uv).rgb,b=texture2D(bloom,clamp(p,0.0,1.0)).rgb*bloomIntensity;
  if(p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0)c=vec3(0.0);
  else if(bloomIntensity>0.0){
    if(blendMode==0)c=1.0-(1.0-clamp(c,0.0,1.0))*(1.0-clamp(b,0.0,1.0));
    else if(blendMode==1)c=max(c,b);
    else {c+=b;c=c/(1.0+c)*1.35;}
  }
  float edge=smoothstep(0.2,0.72,length(q*vec2(1.05,1.0)));
  c*=1.0-edge*vignette*0.65;
  vec3 processed=clamp(displayColor(c),0.0,1.0);
  gl_FragColor=vec4(mix(texture2D(original,uv).rgb,processed,strength),1.0);
}`
  };
  function create(source,canvas,onFailure=()=>{}){
    let gl;
    try{gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false});}catch{}
    if(!gl)return {supported:false,render(){},destroy(){}};
    let width=0,height=0,dead=false,failed=false,buffer=null;
    const programs=[],textures=[],targets=[],compiled=[];
    const report=()=>{if(!failed&&!dead){failed=true;onFailure();}};
    function compile(type,text){
      const shader=gl.createShader(type);compiled.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Shader CRT non supportato');return shader;
    }
    function program(fragment){
      const result=gl.createProgram();programs.push(result);
      gl.attachShader(result,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(result,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(result);
      if(!gl.getProgramParameter(result,gl.LINK_STATUS))throw Error('Programma CRT non supportato');
      return {program:result,position:gl.getAttribLocation(result,'position'),uniforms:new Map()};
    }
    function texture(filter){
      const tex=gl.createTexture();textures.push(tex);gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return tex;
    }
    function release(){
      targets.forEach(t=>gl.deleteFramebuffer(t.framebuffer));targets.length=0;
      textures.forEach(t=>gl.deleteTexture(t));textures.length=0;
      programs.forEach(p=>gl.deleteProgram(p));programs.length=0;
      compiled.forEach(s=>gl.deleteShader(s));compiled.length=0;
      if(buffer){gl.deleteBuffer(buffer);buffer=null;}
    }
    let passes,sourceTexture;
    function resize(){
      const w=source.width,h=source.height;
      if(w===width&&h===height)return;
      const max=gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if(w>max||h>max)throw Error('Risoluzione CRT non supportata');
      width=w;height=h;canvas.width=w;canvas.height=h;
      for(const target of targets){
        gl.bindTexture(gl.TEXTURE_2D,target.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.texture,0);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Buffer CRT non supportato');
      }gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    function draw(pass,target,inputs,values){
      gl.bindFramebuffer(gl.FRAMEBUFFER,target?.framebuffer??null);gl.viewport(0,0,width,height);gl.useProgram(pass.program);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(pass.position);gl.vertexAttribPointer(pass.position,2,gl.FLOAT,false,0,0);
      function location(name){if(!pass.uniforms.has(name))pass.uniforms.set(name,gl.getUniformLocation(pass.program,name));return pass.uniforms.get(name);}
      Object.entries(inputs).forEach(([name,tex],unit)=>{gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(location(name),unit);});
      gl.uniform2f(location('resolution'),width,height);
      for(const [name,value] of Object.entries(values)){
        const loc=location(name);
        if(Array.isArray(value))gl.uniform2f(loc,value[0],value[1]);
        else if(['patternType','blendMode'].includes(name))gl.uniform1i(loc,value);
        else gl.uniform1f(loc,value);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    try{
      passes=Object.fromEntries(Object.entries(shaders).map(([name,text])=>[name,program(text)]));
      buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      sourceTexture=texture(gl.NEAREST);
      for(let i=0;i<5;i++)targets.push({texture:texture(gl.LINEAR),framebuffer:gl.createFramebuffer()});
      resize();
    }catch{release();return {supported:false,render(){},destroy(){}};}
    function lost(event){event.preventDefault();report();}
    canvas.addEventListener('webglcontextlost',lost);
    return {supported:true,render(p,strength,time){
      if(dead||failed||strength<=0)return false;
      try{
        resize();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sourceTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
        if(Object.values(p).every(value=>typeof value!=='number'||value===0)){
          draw(passes.copy,null,{image:sourceTexture},{});return true;
        }
        const [prepared,bright,horizontal,blurred,crt]=targets;
        draw(passes.prepare,prepared,{image:sourceTexture},{blurAmount:p.blur,grainAmount:p.grain,gammaValue:p.gamma||1,blackPoint:p.blackPoint/255,whitePoint:(p.whitePoint||255)/255,time:time/1000});
        draw(passes.bright,bright,{image:prepared.texture},{threshold:p.bloomThreshold});
        draw(passes.blur,horizontal,{image:bright.texture},{direction:[1,0],radius:p.bloomRadius});
        draw(passes.blur,blurred,{image:horizontal.texture},{direction:[0,1],radius:p.bloomRadius});
        draw(passes.phosphor,crt,{image:prepared.texture},{distortion:p.distortion,dotScale:p.dotScale,dotPitch:p.dotPitch,falloff:p.falloff,brightnessBoost:p.brightnessBoost||1,glowRadius:p.glowRadius,glowIntensity:p.glowIntensity,convergenceStrength:p.convergenceStrength,patternType:['monitor','tv','lcd'].indexOf(p.type),redOffset:[p.redX,p.redY],blueOffset:[p.blueX,p.blueY]});
        draw(passes.combine,null,{image:crt.texture,bloom:blurred.texture,original:sourceTexture},{bloomIntensity:p.bloomIntensity,strength,distortion:p.distortion,vignette:p.vignette,blendMode:['screen','light','hdr'].indexOf(p.blend)});
        return true;
      }catch{report();return false;}
    },destroy(){if(dead)return;dead=true;canvas.removeEventListener('webglcontextlost',lost);release();canvas.width=1;canvas.height=1;}};
  }
  return Object.freeze({create,shaders,vertex});
});
