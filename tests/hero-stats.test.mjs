import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave, validateSave } from '../js/systems/save.js';

function elementalSkin() {
  const custom=structuredClone(skin);
  custom.itemDefinitions.leather_armor.attributes={fire:1};
  custom.itemDefinitions.silver_ring.attributes={fire:1};
  custom.itemDefinitions.oak_shield.attributes={water:1};
  return custom;
}
test('fixed stat traits are derived from base growth, are never saved twice and do not multiply on level up',()=>{
  let game=createSession(skin);
  assert.deepEqual(game.campaign.heroStats('lina'),{hp:4,attack:3,defense:3,attributes:{}});
  assert.deepEqual(game.campaign.heroStats('bran'),{hp:3,attack:3,defense:4,attributes:{}});
  assert.deepEqual(game.campaign.heroStats('noa'),{hp:3,attack:3,defense:3,attributes:{}});
  assert.equal(game.campaign.heroStats('unknown'),null);
  const c=game.state.campaign; c.heroes[0].level=2;c.heroes[0].pendingGrowth=1;
  game.campaign.grow('lina','balanced');assert.equal(game.campaign.heroStats('lina').hp,5);assert.equal(c.heroes[0].hp,4);
  for(let i=0;i<3;i++) { game=createSession(skin,validateSave(makeSave(game.state),skin));assert.equal(game.campaign.heroStats('lina').hp,5);assert.equal(game.campaign.heroStats('bran').defense,4); }
});
test('mage adds one per present attribute after summing equipped pieces, including larger values',()=>{
  const custom=elementalSkin(),game=createSession(custom);
  assert.deepEqual(game.campaign.heroStats('noa').attributes,{});
  game.campaign.support('noa','stock-006');assert.deepEqual(game.campaign.heroStats('noa').attributes,{fire:2});
  game.campaign.support('noa','stock-007');assert.deepEqual(game.campaign.heroStats('noa').attributes,{fire:3});
  game.campaign.support('noa','stock-003');assert.deepEqual(game.campaign.heroStats('noa').attributes,{fire:3,water:2});
  game.campaign.support('noa',{body:null});assert.deepEqual(game.campaign.heroStats('noa').attributes,{fire:2,water:2});
  game.campaign.support('noa',{accessory:null,offhand:null});assert.deepEqual(game.campaign.heroStats('noa').attributes,{});
  custom.itemDefinitions.silver_ring.attributes={fire:5,earth:0};
  game.campaign.support('noa','stock-007');assert.deepEqual(game.campaign.heroStats('noa').attributes,{fire:6});
});
test('non-mages receive equipment values without the trait, and inspection does not mutate saves',()=>{
  const custom=elementalSkin(),game=createSession(custom);
  game.campaign.support('lina','stock-006');game.campaign.support('lina','stock-007');
  const saved=makeSave(game.state);let notices=0;game.subscribe(()=>notices++);
  assert.deepEqual(game.campaign.heroStats('lina').attributes,{fire:2});
  assert.deepEqual(game.campaign.heroStats('noa').attributes,{});
  assert.equal(notices,0);assert.deepEqual(makeSave(game.state),saved);
  const resumed=createSession(custom,validateSave(saved,custom));assert.deepEqual(resumed.campaign.heroStats('lina'),game.campaign.heroStats('lina'));
});
test('trait and attribute data reject invalid values and untranslated attributes',()=>{
  for (const mutate of [s=>s.campaign.jobs.mage.equippedAttributeBonus=-1,s=>s.campaign.jobs.warrior.statBonuses.defense=1.5,s=>s.itemDefinitions.leather_armor.attributes={fire:-1},s=>s.itemDefinitions.leather_armor.attributes={unknown:1}]) {
    const custom=structuredClone(skin);mutate(custom);assert.throws(()=>createSession(custom));
  }
});
