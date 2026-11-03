import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave, validateSave } from '../js/systems/save.js';

function weapon(type, hands) {
  const custom=structuredClone(skin);custom.itemDefinitions.iron_sword.equipmentType=type;
  if(hands !== undefined)custom.itemDefinitions.iron_sword.hands=hands;
  return custom;
}
test('JSON job assignments and weapon types determine actual permission independently of item names',()=>{
  const cases=[['one_handed_sword',['lina']],['two_handed_sword',['lina','bran']],['one_handed_axe',['bran']],['two_handed_axe',['bran']],['staff',['noa']]];
  for(const [type,allowed] of cases)for(const id of ['lina','bran','noa']){
    const custom=weapon(type,type==='staff'?1:undefined);custom.locales.ja['items.iron_sword']='名前を変更した商品';
    const game=createSession(custom),before=structuredClone(game.state);
    assert.equal(game.campaign.support(id,'stock-001').ok,allowed.includes(id),`${id}: ${type}`);
    if(!allowed.includes(id))assert.deepEqual(game.state,before);
  }
  const custom=structuredClone(skin);custom.campaign.jobs.mage.allowedTypes.push('one_handed_sword');
  assert.equal(createSession(custom).campaign.support('noa','stock-001').ok,true,'editing job data changes permission');
});
test('body armor follows job types while shields and accessories are shared',()=>{
  for(const [type,allowed] of [['heavy_armor',['lina','bran']],['light_armor',['lina','noa']],['cloth_armor',['noa']]])for(const id of ['lina','bran','noa']){
    const custom=structuredClone(skin);custom.itemDefinitions.leather_armor.equipmentType=type;
    assert.equal(createSession(custom).campaign.support(id,'stock-006').ok,allowed.includes(id),`${id}: ${type}`);
  }
  for(const id of ['lina','bran','noa']){
    const game=createSession(skin);assert.equal(game.campaign.support(id,'stock-003').ok,true);assert.equal(game.campaign.support(id,'stock-007').ok,true);
  }
});
test('two-handed weapon and shield conflict rejects atomically; removing shield in same exchange works',()=>{
  const custom=weapon('two_handed_sword');const game=createSession(custom),hero=game.state.campaign.heroes[0];
  game.campaign.support('lina','stock-003');let notices=0;game.subscribe(()=>notices++);const before=structuredClone(game.state);
  assert.equal(game.campaign.support('lina',{weapon:'stock-001'},30).reason,'equipment.twoHandedShield');
  assert.equal(notices,0);assert.deepEqual(game.state,before);
  assert.equal(game.campaign.support('lina',{weapon:'stock-001',offhand:null},30).ok,true);
  assert.ok(hero.equipment.weapon && !hero.equipment.offhand);assert.equal(game.state.warehouse.items.find(item=>item.instanceId==='stock-003').used,true);
  const next=structuredClone(game.state);assert.equal(game.campaign.support('lina','stock-003').reason,'equipment.twoHandedShield');assert.deepEqual(game.state,next);
  assert.deepEqual(validateSave(makeSave(game.state),custom),game.state);
});
test('staff hand count must be explicit and a two-handed type cannot be overridden to one-handed',()=>{
  assert.throws(()=>createSession(weapon('staff')));
  assert.throws(()=>createSession(weapon('two_handed_sword',1)));
  const custom=weapon('staff',2),game=createSession(custom);game.campaign.support('noa','stock-003');
  assert.equal(game.campaign.support('noa','stock-001').reason,'equipment.twoHandedShield');
});
test('v7 job-incompatible gear is retained in archived equipment and can be recovered',()=>{
  const game=createSession(skin),saved=makeSave(game.state);saved.version=7;
  const item=saved.state.warehouse.items.splice(saved.state.warehouse.items.findIndex(item=>item.instanceId==='stock-009'),1)[0];
  saved.state.campaign.heroes[0].equipment.weapon={...item,used:true};
  for(const hero of saved.state.campaign.heroes)delete hero.jobId;
  const migrated=validateSave(saved,skin),hero=migrated.campaign.heroes[0];
  assert.equal(hero.jobId,'swordsman');assert.equal(hero.equipment.weapon,undefined);assert.equal(hero.giftedEquipment[0].instanceId,item.instanceId);
  const resumed=createSession(skin,migrated);assert.equal(resumed.campaign.recoverArchivedEquipment('lina').ok,true);
  assert.equal(migrated.warehouse.items.find(entry=>entry.instanceId===item.instanceId).used,true);
  assert.deepEqual(validateSave(makeSave(migrated),skin),migrated);
});
test('current saves reject unknown jobs, forbidden equipment and two-handed shield combinations',()=>{
  for (const jobId of ['unknown','constructor']) { const saved=makeSave(createSession(skin).state);saved.state.campaign.heroes[0].jobId=jobId;assert.throws(()=>validateSave(saved,skin)); }
  const game=createSession(skin);game.campaign.support('lina','stock-001');const value=makeSave(game.state);value.state.campaign.heroes[0].jobId='mage';assert.throws(()=>validateSave(value,skin));
  const both=createSession(skin);both.campaign.support('lina','stock-001');both.campaign.support('lina','stock-003');assert.throws(()=>validateSave(makeSave(both.state),weapon('two_handed_sword')));
});
