(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SpecialsScene=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  function random(seed){let n=seed>>>0;return ()=>{n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296;};}
  function frame(animation,ms,loop=true){return loop?Math.floor(Math.max(0,ms)*animation.playbackFps/1000+1e-8)%animation.frames.length:Math.min(animation.frames.length-1,Math.floor(Math.max(0,ms)*animation.playbackFps/1000+1e-8));}
  function plan(data,stage,move='baseball',strength='light',seed=1){
    if(!['baseball','dog','cats'].includes(move))throw new Error('Mossa non disponibile');
    const a=stage.fighters.find(f=>f.characterId==='arianna'),b=stage.fighters.find(f=>f.characterId==='oscare');
    const unit=a.scale/.78,animations=Object.fromEntries(data.animations.map(a=>[a.id,a]));
    const cast=animations[move],parameters=data.parameters[move],spawnMs=parameters.spawnFrame*1000/cast.playbackFps;
    const projectileOffsetY=(data.preview?.projectileOffsetY??0)*stage.height/(data.preview?.referenceHeight??1080);
    const p={move,strength,seed,unit,stage,animations,cast,parameters,projectileOffsetY,spawnMs,events:[],projectiles:[],caster:a,target:b};
    const rng=random(seed),target=b.x,ground=b.groundY;
    if(move==='baseball'){
      const speed=parameters.speeds[strength]??parameters.speeds.light;
      const x=a.x+parameters.spawnOffset[0]*unit;
      const hitMs=spawnMs+Math.max(0,target-x)/(speed*unit)*1000;
      p.projectiles.push({id:'tornado',start:spawnMs,end:Math.min(hitMs,spawnMs+parameters.lifetime*1000),x,speed:speed*unit,ground:a.groundY+parameters.spawnOffset[1]*unit});
      if(hitMs<=spawnMs+parameters.lifetime*1000)p.events.push({time:hitMs,kind:'tornado',x:target,y:ground-150*unit,color:{light:'#91e8ff',medium:'#ffdc45',heavy:'#ff5b29'}[strength]});
    }else if(move==='dog'){
      const x=-parameters.margin*unit,speed=parameters.speed*unit,attackStart=spawnMs+Math.max(0,target-parameters.trigger*unit-x)/speed*1000;
      const hitMs=attackStart+parameters.hitFrame*1000/animations['bateau-attack'].playbackFps;
      const recoveryStart=attackStart+animations['bateau-attack'].durationMs;
      const runStart=recoveryStart+animations['bateau-back-to-run'].durationMs;
      const attackX=target-parameters.trigger*unit,contact=target-parameters.contact*unit;
      const hitX=Math.min(contact,attackX+speed*(hitMs-attackStart)/1000);
      const end=runStart+Math.max(0,stage.width+parameters.margin*unit-(hitX+speed*(runStart-hitMs)/1000))/speed*1000;
      p.projectiles.push({id:'bateau',start:spawnMs,end,x,speed,attackStart,hitMs,recoveryStart,runStart,attackX,contact,hitX,ground});
      p.events.push({time:hitMs,kind:'dog',x:target,y:ground-100*unit});
    }else{
      const order=Array.from({length:12},(_,i)=>['tullio','tilda','telma'][i%3]);
      for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
      let delay=rng()*50;
      order.forEach((cat,i)=>{
        if(i)delay+=(parameters.delayRange[0]+rng()*(parameters.delayRange[1]-parameters.delayRange[0]))*1000;
        const multiplier=parameters.speedRange[0]+rng()*(parameters.speedRange[1]-parameters.speedRange[0]);
        const speed=parameters.profiles[cat].speed*multiplier*unit,face=rng()<parameters.faceChance;
        const start=spawnMs+delay,x=-parameters.margin*unit,trigger=(face?parameters.faceTrigger:parameters.trigger)*unit;
        const attackStart=start+(target-trigger-x)/speed*1000,attackX=target-trigger,contact=target-parameters.contact*unit;
        const attackDuration=face?animations[cat+'-jump'].durationMs:animations[cat+'-attack'].durationMs*parameters.attackLoops;
        const exitStart=attackStart+attackDuration,exitX=face?attackX+speed*attackDuration/1000:contact;
        const end=exitStart+Math.max(0,stage.width+parameters.margin*unit-exitX)/speed*1000;
        const approach=[];let t=start;
        while(t<attackStart){const phase=rng()<.5?'run':'jump',duration=animations[cat+'-'+phase].durationMs;approach.push({phase,start:t,end:t+duration});t+=duration;}
        p.projectiles.push({id:cat+'-'+i,cat,start,end,x,speed,attackStart,attackX,contact,exitStart,exitX,face,approach,ground});
        if(face)p.events.push({time:attackStart+parameters.faceHitFrame/24*1000,kind:'face',x:target,y:ground-260*unit});
        else for(let k=0;k<parameters.attackLoops;k++)p.events.push({time:attackStart+k*animations[cat+'-attack'].durationMs+parameters.hitFrame/24*1000,kind:'cat',x:target,y:ground-80*unit});
      });
    }
    p.events.forEach(event=>{event.y+=projectileOffsetY;});
    p.events.sort((a,b)=>a.time-b.time);
    p.end=Math.max(cast.durationMs,...p.projectiles.map(a=>a.end))+800;
    return p;
  }
  function sample(p,ms){
    const actors=[],hits=p.events.filter(e=>ms>=e.time&&ms-e.time<180);
    actors.push({id:'arianna',animation:ms<p.cast.durationMs?p.move:'arianna-idle',time:ms<p.cast.durationMs?ms:ms-p.cast.durationMs,
      x:p.caster.x,y:p.caster.groundY,scale:p.caster.scale,anchorX:p.caster.anchorX,anchorY:p.caster.anchorY,flipX:false});
    const previous=p.events.filter(e=>e.time<=ms).at(-1),hurt=previous&&ms-previous.time<500;
    actors.push({id:'oscare',animation:hurt?'oscare-hurt':'oscare-idle',time:hurt?ms-previous.time:p.move==='cats'&&ms>=p.spawnMs&&ms<p.end-800?0:ms,
      x:p.target.x,y:p.target.groundY,scale:p.target.scale,anchorX:p.target.anchorX,anchorY:p.target.anchorY,flipX:true,flash:hits.length>0});
    for(const q of p.projectiles){
      if(ms<q.start||ms>=q.end)continue;
      let animation,time,x,y=q.ground,scale;
      if(p.move==='baseball'){
        animation='tornado';time=ms-q.start;x=q.x+q.speed*time/1000;
        const u=clamp(time/(p.parameters.growthSeconds*1000),0,1),back=1+2.70158*(u-1)**3+1.70158*(u-1)**2;
        scale=(p.parameters.startScale+(p.animations.tornado.sourceScale[0]-p.parameters.startScale)*back)*p.unit;
      }else if(p.move==='dog'){
        if(ms<q.attackStart){animation='bateau-run';time=ms-q.start;x=q.x+q.speed*time/1000;}
        else if(ms<q.recoveryStart){animation='bateau-attack';time=ms-q.attackStart;x=ms<q.hitMs?Math.min(q.contact,q.attackX+q.speed*time/1000):q.hitX+q.speed*(ms-q.hitMs)/1000;}
        else {animation=ms<q.runStart?'bateau-back-to-run':'bateau-run';time=ms-(ms<q.runStart?q.recoveryStart:q.runStart);x=q.hitX+q.speed*(ms-q.hitMs)/1000;}
        scale=p.animations[animation].sourceScale[0]*p.unit;
      }else{
        scale=p.animations[q.cat+'-run'].sourceScale[0]*p.unit;
        if(ms<q.attackStart){const segment=q.approach.find(s=>s.start<=ms&&s.end>ms)??q.approach.at(-1);animation=q.cat+'-'+segment.phase;time=ms-segment.start;x=q.x+q.speed*(ms-q.start)/1000;}
        else if(ms<q.exitStart){animation=q.cat+(q.face?'-jump':'-attack');time=ms-q.attackStart;x=q.face?q.attackX+q.speed*time/1000:Math.min(q.contact,q.attackX+q.speed*time/1000);
          if(q.face){const f=time*p.animations[animation].playbackFps/1000,hit=p.parameters.faceHitFrame,last=p.animations[animation].frames.length-1,t=f<=hit?smooth(f/hit):1-smooth((f-hit)/(last-hit));y-=260*p.unit*t;}
        }else{animation=q.cat+'-run';time=ms-q.exitStart;x=q.exitX+q.speed*time/1000;}
      }
      const a=p.animations[animation],position=a.sourcePosition??[0,0],sourceScale=a.sourceScale?.[0]??1;
      actors.push({id:q.id,animation,time,x:x+position[0]*p.unit,y:y+p.projectileOffsetY,shadowGroundY:q.ground+p.projectileOffsetY,scale,anchorX:256,anchorY:256-position[1]/sourceScale,projectile:true,trail:p.move==='baseball'?'wind':p.move==='dog'?'flame':'dust',trailColor:p.move==='baseball'?{light:'#bce7fa',medium:'#ffdc45',heavy:'#ff5b29'}[p.strength]:null,intensity:p.move==='baseball'?{light:1,medium:1.35,heavy:1.7}[p.strength]:1});
    }
    return {actors,hits,ended:ms>=p.end};
  }
  function renderer(animations,images,env=globalThis){
    const buffers=new Map();
    function draw(ctx,state,view){
      const camera=view.camera,effects=view.effects;
      for(const actor of state.actors){
        const a=animations[actor.animation],image=images[actor.animation];if(!a||!image)continue;
        const index=frame(a,actor.time,actor.loop??actor.animation!=='oscare-hurt'),[sx,sy,w,h]=a.frames[index];
        const anchorY=actor.projectile?actor.anchorY:(a.normalizedPreview?.anchor?.[1]??a.contentBounds?.[3]??actor.anchorY);
        if(effects.shadows&&actor.shadow!==false&&actor.animation!=='tornado'){
          let item=buffers.get(actor.id);if(!item){const canvas=env.document.createElement('canvas');canvas.width=w;canvas.height=h;item={canvas,ctx:canvas.getContext('2d')};buffers.set(actor.id,item);}
          const b=item.ctx;
          if(b){b.clearRect(0,0,w,h);b.drawImage(image,sx,sy,w,h,0,0,w,h);b.save();b.globalCompositeOperation='source-in';b.fillStyle='#1d1625';b.fillRect(0,0,w,h);b.restore();
            const project=env.StagesPlayer?.shadowProjection,feet=a.footContacts?.[index],fighter={...actor,anchorY,groundY:actor.shadowGroundY??actor.y};
            ctx.save();ctx.globalAlpha=effects.shadows*.6;
            if(project)ctx.transform(...project(fighter,{shearX:.5,flattenY:.11},feet?.length?feet:null,camera));
            else{ctx.translate(actor.x-camera,fighter.groundY);ctx.transform(actor.scale,0,-.5*actor.scale,-.11*actor.scale,0,0);}
            ctx.drawImage(item.canvas,-actor.anchorX,-anchorY);ctx.restore();}
        }
        if(actor.projectile&&actor.trail){ctx.save();ctx.fillStyle=actor.trailColor??(actor.trail==='flame'?'#61ccfc':'#ddcaa7');
          for(let i=0;i<12*actor.intensity;i++){const age=((actor.time+i*71)%360)/360;ctx.globalAlpha=(1-age)*.35;const x=actor.x-camera-age*120,y=actor.y-(actor.trail==='wind'?110:12)-Math.sin(i*2.9)*14;ctx.fillRect(Math.round(x/3)*3,Math.round(y/3)*3,3+(i%3)*2,3+(i%3)*2);}ctx.restore();}
        ctx.save();ctx.translate(actor.x-camera,actor.y);if(actor.rotation)ctx.rotate(actor.rotation);ctx.scale(actor.flipX?-actor.scale:actor.scale,actor.scale);ctx.imageSmoothingEnabled=false;
        if(actor.opacity!==undefined)ctx.globalAlpha=Math.max(0,Math.min(1,actor.opacity));
        if(actor.flash)ctx.filter='brightness(1.7)';ctx.drawImage(image,sx,sy,w,h,-actor.anchorX,-anchorY,w,h);ctx.restore();
      }
      for(const particle of state.particles??[]){ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,particle.alpha));ctx.fillStyle=particle.color;ctx.fillRect(Math.round((particle.x-camera)/3)*3,Math.round(particle.y/3)*3,particle.size,particle.size);ctx.restore();}
      for(const hit of state.hits){const age=(view.sceneTime-hit.time)/180;ctx.save();ctx.fillStyle=hit.color??'#ffe3a6';ctx.globalAlpha=1-age;
        for(let i=0;i<16;i++){const angle=i*Math.PI/8,r=12+age*85,x=hit.x-camera+Math.cos(angle)*r,y=hit.y+Math.sin(angle)*r;ctx.fillRect(Math.round(x/4)*4,Math.round(y/4)*4,4+i%3*2,4+i%3*2);}ctx.restore();}
    }
    return {draw,destroy(){for(const b of buffers.values()){b.canvas.width=0;b.canvas.height=0;}buffers.clear();}};
  }
  return Object.freeze({plan,sample,frame,renderer,random});
});
