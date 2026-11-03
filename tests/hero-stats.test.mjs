import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave, validateSave } from '../js/systems/save.js';

function elementalSkin() {
  const s=structuredClone(skin);
  s.itemDefinitions.leather_armor.attributes={fire:1};s.itemDefinitions.silver_ring.attributes={fire:1};s.itemDefinitions.oak_shield.attributes={water:1};return s;
}
test('JSON base values and fixed traits are derived separately and never accumulate on reload',()=>{
  let g=createSession(skin);assert.deepEqual(g.campaign.heroStats('kyle'),{hp:4,attack:4,defense:2,attributes:{}});
  assert.deepEqual(g.campaign.heroStats('gares'),{hp:4,attack:2,defense:4,attributes:{}});
  assert.deepEqual(g.campaign.heroStats('mira'),{hp:4,attack:1,defense:3,attributes:{fire:1}});
  assert.equal(g.campaign.heroStats('unknown'),null);
  g.state.campaign.heroes[0].level=2;g.state.campaign.heroes[0].pendingGrowth=1;g.campaign.grow('kyle','balanced');
  for(let i=0;i<3;i++){g=createSession(skin,validateSave(makeSave(g.state),skin));assert.equal(g.campaign.heroStats('kyle').hp,5);assert.equal(g.state.campaign.heroes[0].hp,4);}
});
test('innate attributes work without gear and do not trigger equipped-attribute traits',()=>{
  const s=elementalSkin(),g=createSession(s);
  assert.deepEqual(g.campaign.heroStats('mira').attributes,{fire:1});
  g.campaign.support('mira','stock-006');assert.deepEqual(g.campaign.heroStats('mira').attributes,{fire:3});
  g.campaign.support('mira','stock-007');assert.deepEqual(g.campaign.heroStats('mira').attributes,{fire:4});
  g.campaign.support('mira','stock-003');assert.deepEqual(g.campaign.heroStats('mira').attributes,{fire:4,water:2});
  g.campaign.support('mira',{body:null,accessory:null,offhand:null});assert.deepEqual(g.campaign.heroStats('mira').attributes,{fire:1});
});
test('non-mages receive equipment attributes without a trait and inspection never mutates state',()=>{
  const s=elementalSkin(),g=createSession(s);g.campaign.support('kyle','stock-006');g.campaign.support('kyle','stock-007');
  const saved=makeSave(g.state);let notices=0;g.subscribe(()=>notices++);assert.deepEqual(g.campaign.heroStats('kyle').attributes,{fire:2});
  assert.equal(notices,0);assert.deepEqual(makeSave(g.state),saved);assert.deepEqual(validateSave(saved,s),g.state);
});
test('invalid job bonuses and untranslated or negative attributes are rejected',()=>{
  for(const mutate of [s=>s.campaign.jobs.mage.equippedAttributeBonus=-1,s=>s.campaign.jobs.warrior.statBonuses.defense=1.5,s=>s.itemDefinitions.leather_armor.attributes={fire:-1},s=>s.itemDefinitions.leather_armor.attributes={unknown:1}]){const s=structuredClone(skin);mutate(s);assert.throws(()=>createSession(s));}
});
