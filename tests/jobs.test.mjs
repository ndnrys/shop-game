import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave,validateSave } from '../js/systems/save.js';
function weapon(type,hands){const s=structuredClone(skin);s.itemDefinitions.iron_sword.equipmentType=type;if(hands!==undefined)s.itemDefinitions.iron_sword.hands=hands;return s;}
test('new basic jobs permit the configured weapon types regardless of item names',()=>{
 for(const [type,allowed] of [['one_handed_sword',['kyle','gares','mira']],['two_handed_sword',['kyle','gares']],['two_handed_axe',['gares']],['spear',['kyle','gares']],['bow',['kyle']],['staff',['mira']]])for(const id of ['kyle','gares','mira']){
  const s=weapon(type);s.locales.ja['items.iron_sword']='名前を変更した商品';const g=createSession(s),before=structuredClone(g.state);
  assert.equal(g.campaign.support(id,'stock-001').ok,allowed.includes(id),`${id}: ${type}`);if(!allowed.includes(id))assert.deepEqual(g.state,before);
 }
});
test('armor restrictions remain the same for the complete derived job tree',()=>{
 for(const [type,allowed] of [['heavy_armor',['gares']],['light_armor',['kyle','gares','mira']],['cloth_armor',['kyle','gares','mira']]])for(const id of ['kyle','gares','mira']){const s=structuredClone(skin);s.itemDefinitions.leather_armor.equipmentType=type;assert.equal(createSession(s).campaign.support(id,'stock-006').ok,allowed.includes(id));}
 assert.equal(Object.keys(skin.campaign.jobs).length,21);
 for(const job of Object.values(skin.campaign.jobs)){assert.deepEqual(job.allowedTypes,skin.campaign.jobs[job.baseJobId].allowedTypes);assert.ok(job.equippedAttributeBonus<=3);}
});
test('two-handed sword or axe with a shield rejects atomically; same-exchange removal works',()=>{
 const s=weapon('two_handed_sword'),g=createSession(s);g.campaign.support('kyle','stock-003');const before=structuredClone(g.state);
 assert.equal(g.campaign.support('kyle',{weapon:'stock-001'},30).reason,'equipment.twoHandedShield');assert.deepEqual(g.state,before);
 assert.equal(g.campaign.support('kyle',{weapon:'stock-001',offhand:null},30).ok,true);assert.deepEqual(validateSave(makeSave(g.state),s),g.state);
});
test('staff is one-handed; bows allow arrows but no shield, swords allow spellbooks',()=>{
 assert.equal(createSession(weapon('staff')).campaign.support('mira','stock-001').ok,true);
 assert.throws(()=>createSession(weapon('staff',2)));assert.throws(()=>createSession(weapon('two_handed_sword',1)));
 const s=weapon('bow');s.itemDefinitions.oak_shield.equipmentType='arrow';const g=createSession(s);
 assert.equal(g.campaign.support('kyle','stock-001').ok,true);assert.equal(g.campaign.support('kyle','stock-003').ok,true);assert.deepEqual(validateSave(makeSave(g.state),s),g.state);
 const shield=createSession(weapon('bow'));shield.campaign.support('kyle','stock-001');assert.equal(shield.campaign.support('kyle','stock-003').reason,'equipment.twoHandedShield');
 const book=weapon('staff');book.itemDefinitions.oak_shield.equipmentType='spellbook';const mage=createSession(book);assert.equal(mage.campaign.support('mira','stock-001').ok,true);assert.equal(mage.campaign.support('mira','stock-003').ok,true);
});
test('legacy incompatible gear is archived, recoverable and not lost',()=>{
 const g=createSession(skin),saved=makeSave(g.state);saved.version=7;const item=saved.state.warehouse.items.splice(saved.state.warehouse.items.findIndex(item=>item.instanceId==='stock-009'),1)[0];
 saved.state.campaign.heroes[0].equipment.weapon={...item,used:true};for(const hero of saved.state.campaign.heroes)delete hero.jobId;
 const migrated=validateSave(saved,skin),h=migrated.campaign.heroes[0];assert.equal(h.jobId,'adventurer');assert.equal(h.equipment.weapon,undefined);assert.equal(h.giftedEquipment[0].instanceId,item.instanceId);
 const resumed=createSession(skin,migrated);assert.equal(resumed.campaign.recoverArchivedEquipment('kyle').ok,true);assert.deepEqual(validateSave(makeSave(migrated),skin),migrated);
});
test('current saves reject unknown jobs, incompatible armor and invalid offhand combinations',()=>{
 for(const jobId of ['unknown','constructor']){const saved=makeSave(createSession(skin).state);saved.state.campaign.heroes[0].jobId=jobId;assert.throws(()=>validateSave(saved,skin));}
 const s=structuredClone(skin);s.itemDefinitions.leather_armor.equipmentType='heavy_armor';const g=createSession(s);g.campaign.support('gares','stock-006');const saved=makeSave(g.state);saved.state.campaign.heroes[1].jobId='mage';assert.throws(()=>validateSave(saved,s));
});
