(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.OtherSpecialsScene=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function point(keys,values,frame){
    let i=keys.findIndex(k=>k>=frame);if(i<0)return values.at(-1);if(!i)return values[0];
    const u=(frame-keys[i-1])/(keys[i]-keys[i-1]);return values[i].map((v,n)=>values[i-1][n]+(v-values[i-1][n])*u);
  }
  function plan(data,stage,move,strength='light'){
    const character=data.characters.find(c=>c.moves.some(m=>m.id===move));
    if(!character||character.id==='arianna')throw new Error('Special non disponibile');
    const selected=character.moves.find(m=>m.id===move),animations=Object.fromEntries(data.animations.map(a=>[a.id,a]));
    const phases=selected.phases.map(id=>animations[id]),caster=stage.fighters[0],target=stage.fighters[1],parameters=data.parameters[move];
    const unit=caster.scale/phases[0].sourceScale[0],power=['light','medium','heavy'].indexOf(strength);
    const pre=phases.length>1&&['cigarette','smoke','guitar'].includes(move)?phases[0].durationMs:0;
    const castDuration=phases.reduce((t,a)=>t+a.durationMs,0),cast=animations[move]??phases[0];
    const p={move,strength,power,selected,animations,caster,target,unit,parameters,phases,pre,castDuration,
      spawnMs:pre+(parameters.spawnFrame??0)/cast.playbackFps*1000,events:[],projectiles:[],stage,
      projectileOffsetY:((data.preview?.projectileOffsetY??0)+(parameters.previewOffsetY??0))*stage.height/(data.preview?.referenceHeight??1080)};
    const hit=(time,x=target.x,y=target.groundY-180*unit,color='#b6eaff')=>p.events.push({time,x,y,color});
    const hand=xy=>[caster.x+(xy[0]-caster.anchorX)*caster.scale,caster.groundY+(xy[1]-caster.anchorY)*caster.scale+p.projectileOffsetY];
    if(['cymbals','cigarette','guitar','bottle'].includes(move)){
      const offset=parameters.offset;
      let [x,y]=offset?[caster.x+offset[0]*unit,caster.groundY+offset[1]*unit+p.projectileOffsetY]:hand(parameters.hand);
      if(move==='bottle')x+=parameters.visibleLength*caster.scale*.45;
      const speed=parameters.speeds[power]*unit;
      let travel=Math.max(0,target.x-65*unit-x)/speed;
      if(move==='bottle'){
        const dy=caster.groundY-25*unit-y;
        const floor=(-parameters.velocityY+Math.sqrt(parameters.velocityY**2+2*parameters.gravity*dy/unit))/parameters.gravity;
        travel=Math.min(travel,floor);
      }
      travel=Math.min(parameters.lifetime,travel);
      const q={id:move+'-object',animation:{cymbals:'cymbal-projectile',cigarette:'cigarette-projectile',guitar:'guitar-projectile',bottle:'bottle-projectile'}[move],start:p.spawnMs,end:p.spawnMs+travel*1000,x,y,speed};
      p.projectiles.push(q);
      const endY=y+(move==='bottle'?(parameters.velocityY*travel+.5*parameters.gravity*travel**2)*unit:0),endX=x+speed*travel;
      const impact=travel<parameters.lifetime;
      if(impact)hit(q.end,endX,endY,move==='bottle'?'#ffcc73':move==='cigarette'?'#ff9840':'#a9e4ff');
      p.hitTarget=impact&&Math.abs(endX-target.x)<100*unit;
      p.end=Math.max(castDuration,q.end+450)+800;
    }else if(move==='shoulder'){
      p.rush=p.spawnMs;p.contact=p.rush+Math.max(0,target.x-parameters.stopDistance*unit-caster.x)/(parameters.speeds[power]*unit)*1000;
      p.recovery=p.contact;p.castDuration=p.contact+(cast.frames.length-parameters.holdFrame-1)/cast.playbackFps*1000;
      hit(p.contact);p.hitTarget=true;p.end=p.castDuration+1000;
    }else if(move==='drums'){
      p.spawnMs=parameters.auraFrame/phases[0].playbackFps*1000;
      const rotate=phases[0].durationMs,run=rotate+phases[1].durationMs;
      p.rush=rotate+parameters.moveFrame/phases[1].playbackFps*1000;
      p.contact=Math.max(run,p.rush+Math.max(0,target.x-parameters.stopDistance*unit-caster.x)/(parameters.speed*unit)*1000);
      p.rollEnd=p.contact+phases[3].durationMs*parameters.loops;
      for(let loop=0;loop<parameters.loops;loop++)for(const frame of parameters.hitFrames)hit(p.contact+loop*phases[3].durationMs+frame/phases[3].playbackFps*1000,target.x,target.groundY-260*unit,'#ff6346');
      p.knockdownMs=target.knockdownMs??900;p.recoveryMs=target.recoveryMs??500;
      p.castDuration=p.rollEnd;p.hitTarget=true;p.end=p.rollEnd+p.knockdownMs+p.recoveryMs+600;
    }else if(move==='tom'||move==='baglioni'){
      const x=caster.x+parameters.offset[0]*unit,y=caster.groundY+parameters.offset[1]*unit+p.projectileOffsetY;
      const approach=p.spawnMs+animations[move+'-materialize'].durationMs;
      const attack=approach+Math.max(0,target.x-parameters.contact*unit-x)/(parameters.speed*unit)*1000;
      const exit=attack+(parameters.exitOnLastStrike?(parameters.hitFrames.at(-1)+1)/60*1000:animations[move+'-slaps'].durationMs);
      const contactX=target.x-parameters.contact*unit,end=exit+Math.max(0,stage.width+150*unit-contactX)/(parameters.speed*unit)*1000;
      p.projectiles.push({id:move,start:p.spawnMs,end,approach,attack,exit,x,y,contactX,speed:parameters.speed*unit});
      for(const frame of parameters.hitFrames)hit(attack+frame/60*1000);
      p.hitTarget=true;p.end=end+600;
    }else if(move==='welding'||move==='smoke'){
      p.emissionEnd=move==='smoke'?p.spawnMs+animations['smoke-projectile'].durationMs:Math.min(castDuration,(parameters.endFrame+1)/cast.playbackFps*1000);
      p.end=Math.max(castDuration,p.emissionEnd+350)+800;
    }else if(move==='spin'){
      p.end=castDuration+900;
    }
    p.events.sort((a,b)=>a.time-b.time);return p;
  }
  function sample(p,ms){
    const actors=[],hits=p.events.filter(e=>ms>=e.time&&ms-e.time<180),particles=[];
    const {caster:c,target:t,parameters:k,unit:u,animations:a,move}=p;
    let animation='caster-idle',time=Math.max(0,ms-p.castDuration),x=c.x;
    if(ms<p.castDuration){
      let rest=ms;for(const phase of p.phases){if(rest<phase.durationMs){animation=phase.id;time=rest;break;}rest-=phase.durationMs;}
    }
    if(move==='shoulder'){
      x=Math.min(t.x-k.stopDistance*u,c.x+Math.max(0,ms-p.rush)*k.speeds[p.power]*u/1000);
      if(ms<p.contact){animation='shoulder';time=Math.min(ms,k.holdFrame/48*1000);}
      else if(ms<p.castDuration){animation='shoulder';time=(k.holdFrame+1)/48*1000+ms-p.contact;}
    }else if(move==='spin')x=c.x+Math.min(ms,p.castDuration)/1000*k.speed*u;
    else if(move==='drums'){
      x=Math.min(t.x-k.stopDistance*u,c.x+Math.max(0,ms-p.rush)*k.speed*u/1000);
      if(ms>=p.phases[0].durationMs+p.phases[1].durationMs&&ms<p.contact){animation='drums-run';time=ms-p.rush;}
      if(ms>=p.contact&&ms<p.rollEnd){animation='drums-roll';time=(ms-p.contact)%a['drums-roll'].durationMs;}
    }
    actors.push({id:'caster',animation,time,x,y:c.groundY,scale:c.scale,anchorX:c.anchorX,anchorY:c.anchorY,flipX:false,loop:animation==='caster-idle'||animation==='drums-run'});
    const previous=p.events.filter(e=>e.time<=ms).at(-1),hurt=p.hitTarget&&previous&&ms-previous.time<500;
    const knockdown=move==='drums'&&ms>=p.rollEnd&&ms<p.rollEnd+p.knockdownMs;
    const recovery=move==='drums'&&ms>=p.rollEnd+p.knockdownMs&&ms<p.rollEnd+p.knockdownMs+p.recoveryMs;
    actors.push({id:'target',animation:knockdown?'target-ko':recovery?'target-recovery':hurt?'target-hurt':'target-idle',time:knockdown?ms-p.rollEnd:recovery?ms-p.rollEnd-p.knockdownMs:hurt?ms-previous.time:move==='drums'&&ms<p.rollEnd?0:ms,
      x:t.x,y:t.groundY,scale:t.scale,anchorX:t.anchorX,anchorY:t.anchorY,flipX:true,flash:hits.length>0&&p.hitTarget,loop:!knockdown&&!recovery&&!hurt});
    for(const q of p.projectiles){
      if(ms<q.start||ms>=q.end)continue;
      let id=q.animation,elapsed=ms-q.start,px=q.x+q.speed*elapsed/1000,py=q.y,scale,rotation=0;
      if(move==='tom'||move==='baglioni'){
        const phase=ms<q.approach?'materialize':ms<q.attack?'run':ms<q.exit?'slaps':'run';id=move+'-'+phase;
        elapsed=ms-(ms<q.approach?q.start:ms<q.attack?q.approach:ms<q.exit?q.attack:q.exit);
        px=ms<q.approach?q.x:ms<q.attack?q.x+q.speed*(ms-q.approach)/1000:ms<q.exit?q.contactX:q.contactX+q.speed*(ms-q.exit)/1000;
      }
      const asset=a[id],s=asset.sourceScale[0],pos=asset.sourcePosition;
      scale=s*u;
      if(move==='bottle'){const dt=elapsed/1000;py+=(k.velocityY*dt+.5*k.gravity*dt*dt)*u;rotation=Math.PI/2+dt*Math.PI*2*k.spins[p.power];scale=k.visibleLength*c.scale/1400;}
      actors.push({id:q.id,animation:id,time:elapsed,x:px+pos[0]*u,y:py+pos[1]*u,scale,anchorX:asset.frameWidth/2,anchorY:asset.frameHeight/2,projectile:true,rotation,loop:true,shadow:move==='tom'||move==='baglioni',trail:move==='bottle'?'dust':'flame',trailColor:move==='bottle'?'#d99e46':'#8edaff',intensity:1});
    }
    if(move==='smoke'&&ms>=p.spawnMs&&ms<p.emissionEnd){
      const frame=(ms-p.pre)*60/1000,xy=point(k.mouthFrames,k.mouthPositions,frame),scale=c.scale*.7;
      actors.push({id:'smoke',animation:'smoke-projectile',time:ms-p.spawnMs,x:c.x+(xy[0]-c.anchorX)*c.scale,y:c.groundY+(xy[1]-c.anchorY)*c.scale+p.projectileOffsetY,
        scale,anchorX:k.outlet[0],anchorY:k.outlet[1],projectile:true,shadow:false,loop:false,opacity:Math.min(1,(frame-19)/3,(46-frame)/6)});
    }
    if(move==='welding'&&ms>=p.spawnMs&&ms<p.emissionEnd+300){
      const end=Math.min(ms,p.emissionEnd),frame=end*60/1000,xy=point(k.torchFrames,k.torchPositions,frame),ox=c.x+(xy[0]-c.anchorX)*c.scale,oy=c.groundY+(xy[1]-c.anchorY)*c.scale+p.projectileOffsetY;
      const rate=k.rates[p.power],life=k.reach/k.speed;
      for(let i=Math.max(0,Math.floor((ms/1000-life)*rate));i<Math.floor(end/1000*rate);i++){
        if(i/rate*1000<p.spawnMs)continue;
        const age=ms/1000-i/rate,angle=Math.sin(i*12.9898)*.26,speed=k.speed*(.7+.3*((i*17%101)/100));
        particles.push({x:ox+Math.cos(angle)*speed*age*u,y:oy+Math.sin(angle)*speed*age*u+.5*k.gravity*age**2*u,size:3+(i%3),color:['#2699ff','#ff2014','#ffda1a'][i%3],alpha:1-age/life});
      }
    }
    if(move==='shoulder'&&ms>=p.rush&&ms<p.contact||move==='drums'&&ms>=18/48*1000&&ms<p.contact){
      for(let i=0;i<45;i++){const angle=i*2.4+ms*.01,r=70+(i%5)*13;particles.push({x:x+Math.cos(angle)*r,y:c.groundY-180*u+Math.sin(angle)*r*1.6,size:3+i%3,color:move==='drums'?'#ff6e41':['#5dcfff','#ff9c24','#ff3a2a'][p.power],alpha:.7});}
    }
    if(move==='bottle'&&p.events[0]&&ms>=p.events[0].time&&ms<p.events[0].time+450){
      const e=p.events[0],dt=(ms-e.time)/1000;for(let i=0;i<20;i++){const angle=i*2.4;particles.push({x:e.x+Math.cos(angle)*(80+i*7)*dt,y:e.y-130*dt+Math.sin(angle)*90*dt+300*dt*dt,size:3+i%4,color:['#ae762c','#e1bb6d','#eef2d0'][i%3],alpha:1-dt/.45});}
    }
    return {actors,hits,particles,ended:ms>=p.end};
  }
  return Object.freeze({plan,sample,point});
});
