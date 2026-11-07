// Stage and five locomotion animations per character; no legacy project dependency.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const demo = path.resolve(__dirname, '../../demo-moves-sanmauro');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(demo, 'assets/manifest.json')));
const stage = JSON.parse(fs.readFileSync(path.join(demo, 'assets/stages/Piazza Europa/stage.json')));
const contacts = JSON.parse(fs.readFileSync(path.join(demo, 'assets/stages/Piazza Europa/foot-contacts.json')));
function copy(relative) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(path.join(demo, relative), target);
}
for (const layer of stage.layers) copy(layer.image);
copy('assets/stages/Piazza Europa/stage.json');
copy('assets/stages/Piazza Europa/crt-preset.json');
const characters = manifest.characters.map(character => {
  const idle = character.animations.find(a => a.id === 'idle');
  const animations = {};
  for(const id of ['idle','walk','backwalk','run','back-jump','jump']) {
    const animation = character.animations.find(a=>a.id===id);
    if(!animation) throw Error('Missing movement: '+character.id+'/'+id);
    copy(animation.image);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,animation.image))).digest('hex');
    if(digest!==animation.sourceSha256) throw Error('Movement hash mismatch: '+character.id+'/'+id);
    animations[id]=structuredClone(animation);
    if(id==='jump') {
      animations[id].demoFrameDurations=animation.frameDurations;
      // A 67ms startup spread across 8-12 source frames skipped most of the
      // anticipation on a 60Hz display. Give each startup frame a visible tick.
      animations[id].frameDurations=animation.sourceFrameDurations.map((duration,index)=>
        index<animation.takeoffFrame ? Math.max(duration,1000/60) : duration);
      animations[id].playbackFps=animation.sourceFps;
      animations[id].durationMs=animations[id].frameDurations.reduce((s,d)=>s+d,0);
      animations[id].takeoffMs=animations[id].frameDurations.slice(0,animation.takeoffFrame).reduce((s,d)=>s+d,0);
    }
  }
  copy(idle.image);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,idle.image))).digest('hex');
  if(hash !== idle.sourceSha256) throw Error('Idle hash mismatch: ' + character.id);
  return {id:character.id, name:character.name, heightCm:character.heightCm, idle, animations,
    footContacts: contacts.items.find(item=>item.characterId===character.id).frames};
});
fs.mkdirSync(path.join(root,'data'), {recursive:true});
fs.writeFileSync(path.join(root,'data/debug-roster.json'), JSON.stringify({characters}, null, 2)+'\n');
console.log('Imported Piazza Europa and 42 verified locomotion animations.');
