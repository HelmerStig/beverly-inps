(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.StagesPlayer=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function cloudPositions(stageWidth,layerWidth,elapsed,speed){
    let x=(stageWidth-layerWidth)/2-(elapsed*speed/1000)%layerWidth;
    while(x+layerWidth<=0)x+=layerWidth;
    const positions=[];
    for(;x<stageWidth;x+=layerWidth)positions.push(x);
    return positions;
  }
  function dustParticles(width,height,elapsed,intensity){
    const amount=Number.isFinite(intensity)?Math.max(0,Math.min(1,intensity)):0;
    const count=amount>0?160:0;
    return Array.from({length:count},(_,i)=>{
      const life=4000+i%5*900;
      const phase=(((elapsed+i*1730)%life)+life)%life/life;
      const x=(((i*401+137-phase*(30+i%4*12))%width)+width)%width;
      const y=height*(0.96-(i%7)*0.006)-phase*(24+i%4*12);
      return {x:Math.round(x/2)*2,y:Math.round(y/2)*2,size:2+i%3*2,
        alpha:amount*0.65*Math.sin(Math.PI*phase),color:['#d3bd99','#b49d7d','#e1cba7'][i%3]};
    });
  }
  function shadowProjection(fighter,style,feet,camera){
    const slope=feet?.length===2&&Math.abs(feet[1].x-feet[0].x)>1e-8?(feet[1].y-feet[0].y)/(feet[1].x-feet[0].x):0;
    const offset=feet?.length?feet[0].y-fighter.anchorY-slope*(feet[0].x-fighter.anchorX):0;
    const s=fighter.scale,flip=fighter.flipX?-1:1;
    // I punti sulla linea delle suole restano fermi; si proietta solo l'altezza sopra quella linea.
    return [s*(flip+style.shearX*slope),s*slope*(1+style.flattenY),
      -style.shearX*s,-style.flattenY*s,
      fighter.x-camera+style.shearX*s*offset,fighter.groundY+s*offset*(1+style.flattenY)];
  }
  function install(canvas,button,status,stage,env=globalThis){
    const context=canvas.getContext('2d');
    const media=env.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed=false,ready=false,playing=!media.matches,elapsed=0,last=null,request=null;
    let fighterElapsed=0,animateFighters=!media.matches;
    let postProcess=null,sceneRenderer=null;
    const viewportWidth=stage.viewportWidth??stage.height*16/9;
    const maxCamera=Math.max(0,stage.width-viewportWidth);
    let camera=maxCamera/2,drag=null;
    const layers=stage.layers.map((layer,index)=>({...layer,index,imageObject:null})).sort((a,b)=>a.zIndex-b.zIndex||a.index-b.index);
    const fighters=(stage.fighters??[]).map(fighter=>({...fighter,imageObject:null}));
    const assets=[...layers,...fighters];
    const shadowStyle={color:'#1d1625',shearX:0.5,flattenY:0.11,opacity:0.72,contactOpacity:0.28,...stage.shadow};
    let effects={shadows:0,color:0,fog:0,dust:0};
    function fog(depth){
      if(!effects.fog)return;
      context.save();context.fillStyle='#dae4ef';
      const end=stage.height*0.7;
      for(let y=0;y<end;y+=24){
        const altitude=y/stage.height;
        const weight=altitude<0.45?0.12+altitude/0.45*0.88:Math.max(0,(0.7-altitude)/0.25);
        context.globalAlpha=effects.fog*0.5*depth*weight;
        context.fillRect(0,y,viewportWidth,Math.min(24,end-y));
      }
      context.restore();
    }
    function dust(){
      if(!effects.dust)return;
      context.save();
      for(const particle of dustParticles(stage.width,stage.height,fighterElapsed,effects.dust)){
        const x=particle.x-camera;
        if(x+particle.size<0||x>viewportWidth)continue;
        context.fillStyle=particle.color;context.globalAlpha=particle.alpha;
        context.fillRect(x,particle.y,particle.size,particle.size);
      }
      context.restore();
    }
    function shadow(fighter){
      if(!effects.shadows)return;
      const animation=fighter.animation;
      const frame=currentFrame(animation);
      const feet=fighter.footContacts?.[frame];
      const [sx,sy,w,h]=animation.frames[frame];
      if(!fighter.shadowCanvas){
        fighter.shadowCanvas=env.document.createElement('canvas');
        fighter.shadowCanvas.width=w;fighter.shadowCanvas.height=h;
        fighter.shadowContext=fighter.shadowCanvas.getContext('2d');
      }
      const buffer=fighter.shadowContext;
      if(!buffer)return;
      if(fighter.shadowFrame!==frame){
        buffer.clearRect(0,0,w,h);buffer.imageSmoothingEnabled=false;
        buffer.drawImage(fighter.imageObject,sx,sy,w,h,0,0,w,h);
        buffer.save();buffer.globalCompositeOperation='source-in';
        buffer.fillStyle=shadowStyle.color;buffer.fillRect(0,0,w,h);buffer.restore();
        fighter.shadowFrame=frame;
      }
      context.save();
      context.fillStyle=shadowStyle.color;context.globalAlpha=effects.shadows*shadowStyle.contactOpacity;
      for(const foot of feet??[{x:fighter.anchorX,y:fighter.anchorY,width:168}]){
        const x=fighter.x-camera+(fighter.flipX?-1:1)*fighter.scale*(foot.x-fighter.anchorX);
        const y=fighter.groundY+fighter.scale*(foot.y-fighter.anchorY);
        const width=Math.max(24,Math.min(100,foot.width*fighter.scale));
        [0.75,1,0.75].forEach((ratio,i)=>context.fillRect(x-width*ratio/2,y-2+i*2,width*ratio,2));
      }
      context.restore();
      context.save();context.globalAlpha=effects.shadows*shadowStyle.opacity;
      // Il ribaltamento riguarda la sagoma, non la direzione della luce nel mondo.
      context.transform(...shadowProjection(fighter,shadowStyle,feet,camera));
      context.drawImage(fighter.shadowCanvas,-fighter.anchorX,-fighter.anchorY,w,h);
      context.restore();
    }
    function currentFrame(animation){
      return Math.floor(fighterElapsed*(animation.playbackFps??24)/1000+1e-10)%animation.frames.length;
    }
    function coloredFrame(fighter,frame,sx,sy,w,h){
      if(!fighter.colorCanvas){
        fighter.colorCanvas=env.document.createElement('canvas');
        fighter.colorCanvas.width=w;fighter.colorCanvas.height=h;
        fighter.colorContext=fighter.colorCanvas.getContext('2d');
      }
      const buffer=fighter.colorContext;
      if(!buffer)return null;
      if(fighter.colorFrame!==frame||fighter.colorAmount!==effects.color){
        buffer.clearRect(0,0,w,h);buffer.imageSmoothingEnabled=false;
        buffer.drawImage(fighter.imageObject,sx,sy,w,h,0,0,w,h);
        buffer.save();buffer.globalCompositeOperation='source-atop';
        buffer.fillStyle=`rgba(255,184,120,${effects.color*0.16})`;
        buffer.fillRect(0,0,w,h);buffer.restore();
        fighter.colorFrame=frame;fighter.colorAmount=effects.color;
      }
      return fighter.colorCanvas;
    }
    canvas.width=viewportWidth;canvas.height=stage.height;
    function draw(){
      if(!ready||disposed)return;
      context.clearRect(0,0,viewportWidth,stage.height);
      context.imageSmoothingEnabled=false;
      for(const layer of layers){
        const width=layer.renderWidth??layer.width,height=layer.renderHeight??layer.height;
        const positions=layer.speed?cloudPositions(stage.width,width,elapsed,layer.speed):[(stage.width-width)/2];
        for(const x of positions){
          if(layer.renderWidth!==undefined||layer.renderHeight!==undefined)context.drawImage(layer.imageObject,x-camera,(stage.height-height)/2,width,height);
          else context.drawImage(layer.imageObject,x-camera,0);
        }
        if(layer.haze)fog(layer.haze);
      }
      dust();
      fighters.forEach(shadow);
      for(const fighter of fighters){
        const animation=fighter.animation;
        const frame=currentFrame(animation);
        const [sx,sy,w,h]=animation.frames[frame];
        context.save();
        context.translate(fighter.x-camera,fighter.groundY);
        context.scale(fighter.flipX?-fighter.scale:fighter.scale,fighter.scale);
        const tinted=effects.color?coloredFrame(fighter,frame,sx,sy,w,h):null;
        context.drawImage(tinted??fighter.imageObject,tinted?0:sx,tinted?0:sy,w,h,-fighter.anchorX,-fighter.anchorY,w,h);
        context.restore();
      }
      sceneRenderer?.(context,{elapsed:fighterElapsed,camera,effects,stage,viewportWidth});
      postProcess?.(canvas,fighterElapsed);
    }
    function sync(){
      button.disabled=!ready;
      button.textContent=playing?'Pausa nuvole':'Avvia nuvole';
      button.setAttribute('aria-pressed',String(playing));
    }
    function schedule(){
      if(!disposed&&ready&&(playing||(animateFighters&&(fighters.length||effects.dust>0||sceneRenderer)))&&!env.document.hidden&&request===null)request=env.requestAnimationFrame(tick);
    }
    function tick(time){
      request=null;
      const delta=last===null?0:Math.max(0,Math.min(time-last,100));
      if(playing)elapsed+=delta;
      if(animateFighters)fighterElapsed+=delta;
      last=time;draw();schedule();
    }
    function resetClock(){
      last=null;
      if(request!==null){env.cancelAnimationFrame(request);request=null;}
      schedule();
    }
    function toggle(){playing=!playing;sync();resetClock();}
    function visibility(){resetClock();}
    function reduced(){animateFighters=!media.matches;if(media.matches)playing=false;sync();resetClock();}
    function moveCamera(value){camera=Math.max(0,Math.min(maxCamera,value));draw();}
    function pointerDown(event){
      if(!ready||drag||event.isPrimary===false||event.button!==0)return;
      drag={id:event.pointerId,x:event.clientX,camera,scale:viewportWidth/canvas.getBoundingClientRect().width};
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-dragging');
      canvas.focus({preventScroll:true});
    }
    function pointerMove(event){
      if(!drag||event.pointerId!==drag.id)return;
      moveCamera(drag.camera-(event.clientX-drag.x)*drag.scale);
    }
    function pointerEnd(event){
      if(!drag||event.pointerId!==drag.id)return;
      const id=drag.id;drag=null;canvas.classList.remove('is-dragging');
      if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    }
    function keyDown(event){
      const next={ArrowLeft:camera-64,ArrowRight:camera+64,Home:0,End:maxCamera}[event.key];
      if(next===undefined)return;
      event.preventDefault();moveCamera(next);
    }
    button.disabled=true;
    if(!context){status.textContent='Anteprima non supportata da questo browser.';return {setEffects(){},setPostProcess(){},setSceneRenderer(){},setSceneMotion(){},destroy(){}};}
    button.addEventListener('click',toggle);
    canvas.addEventListener('pointerdown',pointerDown);
    canvas.addEventListener('pointermove',pointerMove);
    canvas.addEventListener('pointerup',pointerEnd);
    canvas.addEventListener('pointercancel',pointerEnd);
    canvas.addEventListener('lostpointercapture',pointerEnd);
    canvas.addEventListener('keydown',keyDown);
    env.document.addEventListener('visibilitychange',visibility);
    media.addEventListener?.('change',reduced);
    status.textContent='Caricamento dello stage…';
    const loaded=Promise.all(assets.map(layer=>new Promise((resolve,reject)=>{
      const image=new env.Image();layer.imageObject=image;
      image.onload=()=>{
        if(layer.animation){
          const frames=layer.animation.frames;
          if(!frames?.length||frames.some(([x,y,w,h])=>![x,y,w,h].every(Number.isInteger)||x<0||y<0||w<=0||h<=0||x+w>image.naturalWidth||y+h>image.naturalHeight)){
            reject(new Error('Spritesheet non valido: '+layer.characterId));return;
          }
        }else if(image.naturalWidth!==layer.width||image.naturalHeight!==layer.height){reject(new Error('Dimensioni inattese: '+layer.id));return;}
        resolve();
      };
      image.onerror=()=>reject(new Error('Impossibile caricare lo stage. Verifica le immagini locali.'));
      image.src=layer.animation?.image??layer.image;
    }))).then(()=>{
      if(disposed)return;
      ready=true;status.textContent='';status.hidden=true;canvas.setAttribute('aria-busy','false');sync();draw();schedule();
    }).catch(error=>{
      if(disposed)return;
      status.textContent=error.message;canvas.setAttribute('aria-busy','false');
    });
    return {loaded,setSceneRenderer(callback){sceneRenderer=callback;draw();schedule();},setSceneMotion(value){animateFighters=Boolean(value);resetClock();draw();},setPostProcess(callback){postProcess=callback;if(callback)draw();},setEffects(values){
      const clamp=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):0;
      effects={shadows:clamp(values.shadows),color:clamp(values.color),fog:clamp(values.fog),dust:clamp(values.dust)};
      draw();schedule();
    },destroy(){
      disposed=true;postProcess=null;sceneRenderer=null;resetClock();
      button.removeEventListener('click',toggle);
      if(drag)pointerEnd({pointerId:drag.id});
      for(const [type,handler] of [['pointerdown',pointerDown],['pointermove',pointerMove],['pointerup',pointerEnd],['pointercancel',pointerEnd],['lostpointercapture',pointerEnd],['keydown',keyDown]])canvas.removeEventListener(type,handler);
      env.document.removeEventListener('visibilitychange',visibility);
      media.removeEventListener?.('change',reduced);
      assets.forEach(layer=>{layer.imageObject.onload=null;layer.imageObject.onerror=null;});
      fighters.forEach(fighter=>{for(const canvas of [fighter.colorCanvas,fighter.shadowCanvas])if(canvas){canvas.width=0;canvas.height=0;}});
    }};
  }
  return Object.freeze({install,cloudPositions,dustParticles,shadowProjection});
});
