(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MovesGroups = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function group(characters) {
    const groups = new Map();
    for (const character of characters) {
      for (const animation of character.animations) {
        if (!groups.has(animation.id)) groups.set(animation.id, {id:animation.id, name:animation.name, animations:[]});
        groups.get(animation.id).animations.push({...animation, characterId:character.id, characterName:character.name});
      }
    }
    const baseOrder=["idle","walk","backwalk","run","jump","back-jump","air-guard","crouch","stand-up","block-high","block-mid","block-low","hurt-high","hurt-medium","hurt-low","hurt-crouched","hurt-air","knockdown","get-up","victory","ko","light-punch","medium-punch","heavy-punch","light-kick","medium-kick","heavy-kick","crouched-light-punch","crouched-medium-punch","crouched-heavy-punch","crouched-light-kick","crouched-medium-kick","crouched-heavy-kick","jump-light-punch","jump-medium-punch","jump-heavy-punch","jump-light-kick","jump-medium-kick","jump-heavy-kick"];
    const rank=id=>{const index=baseOrder.indexOf(id);return index<0?baseOrder.length:index;};
    return [...groups.values()].sort((a,b)=>rank(a.id)-rank(b.id));
  }
  function filter(group, query) {
    const text = query.trim().toLocaleLowerCase('it');
    return {...group, animations:group.animations.filter(a=>a.characterName.toLocaleLowerCase('it').includes(text))};
  }
  return Object.freeze({group, filter});
});
