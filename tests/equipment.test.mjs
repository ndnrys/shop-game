import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave, validateSave } from '../js/systems/save.js';

const setup=()=>createSession(skin);
test('several equipment slots and funds commit together; replacement returns used gear, removal preserves other slots',()=>{
  const game=setup(), c=game.state.campaign, hero=c.heroes[0];game.state.warehouse.items.find(item=>item.instanceId==='stock-009').itemId='steel_sword';let commits=0;game.subscribe(()=>commits++);
  assert.equal(game.campaign.support('kyle',{weapon:'stock-001',offhand:'stock-003'},30).ok,true);
  assert.equal(commits,1);assert.equal(c.parties[0].funds,30);assert.equal(c.gold,370);
  assert.equal(game.campaign.support('kyle',{weapon:'stock-009'},10).ok,true);
  assert.equal(hero.equipment.weapon.instanceId,'stock-009');assert.equal(hero.equipment.offhand.instanceId,'stock-003');
  const sword=game.state.warehouse.items.find(item=>item.instanceId==='stock-001');assert.equal(sword.used,true);assert.equal(game.price(sword),50);
  assert.equal(game.campaign.support('kyle',{weapon:null}).ok,true);assert.equal(hero.equipment.weapon,undefined);assert.equal(hero.equipment.offhand.instanceId,'stock-003');
  assert.equal(game.state.warehouse.items.find(item=>item.instanceId==='stock-009').used,true);
  assert.deepEqual(validateSave(makeSave(game.state),skin),game.state);
});
test('wrong slot, duplicate gear, bad IDs and invalid funds preserve the entire transaction',()=>{
  const game=setup();
  for(const [changes,funds] of [[{weapon:'stock-001',offhand:'stock-006'},20],[{weapon:'stock-001',offhand:'stock-001'},20],[{unknown:'stock-001'},20],[{weapon:'bad'},20],[{weapon:'stock-001'},9999],[{weapon:'stock-001'},1.5]]){
    const before=JSON.stringify(game.state);assert.equal(game.campaign.support('kyle',changes,funds).ok,false);assert.equal(JSON.stringify(game.state),before);
  }
});
test('failed warehouse return cannot discard gear, charge money, notify, or destroy undo',()=>{
  const custom=structuredClone(skin);custom.itemDefinitions.iron_sword.equipmentType='two_handed_sword';
  const game=createSession(custom);game.campaign.support('gares','stock-009',30);
  assert.equal(game.warehouse.move('stock-004',7,7).ok,true);
  assert.equal(game.warehouse.canUndo(),true);
  // Fill every remaining cell with one-cell inventory instances.
  const items=game.state.warehouse.items;
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(game.inventory.canPlace(items,'crystal',x,y,0,8,8))items.push({instanceId:`fill-${x}-${y}`,itemId:'crystal',x,y,rotated:0});
  let notifications=0;game.subscribe(()=>notifications++);
  const before=JSON.stringify(game.state);assert.equal(game.campaign.support('gares',{weapon:'stock-001'},25).reason,'mvp.error.returnFull');
  assert.equal(JSON.stringify(game.state),before);assert.equal(notifications,0);assert.equal(game.warehouse.canUndo(),true);
});
test('used price applies to customer budgets, sales, merchant buyback and original cost accounting',()=>{
  const testSkin=structuredClone(skin);testSkin.campaign.purchaseChance=1;testSkin.campaign.customers=[{id:'adventurer',dialogueKey:'mvp.line.swordsman',categories:['weapon'],budget:50}];
  const game=createSession(testSkin);game.state.warehouse.items.find(item=>item.instanceId==='stock-001').purchaseCost=30;
  game.campaign.support('kyle','stock-001');game.campaign.support('kyle',{weapon:null});
  const sword=game.state.warehouse.items.find(item=>item.instanceId==='stock-001');
  game.campaign.startTrade('weapons');assert.equal(game.campaign.buyback(sword),7);
  assert.equal(game.campaign.sellBack(sword.instanceId,'warehouse').ok,true);assert.equal(game.state.campaign.today.buyback,7);
  for(const item of [...game.state.campaign.trade.incoming])game.campaign.sellBack(item.instanceId,'incoming');game.campaign.finishTrade();
  const axe=game.state.warehouse.items.find(item=>item.instanceId==='stock-009');axe.used=true;axe.purchaseCost=30;
  game.stocking.put(axe.instanceId,0,0);const before=game.state.campaign.gold;game.campaign.openShop();
  assert.equal(game.state.campaign.gold-before,50);assert.equal(game.state.campaign.today.sales,50);assert.equal(game.state.campaign.today.cogs,30);
});
test('used status survives repeated exchanges and saving; invalid flags are rejected and v4 saves load',()=>{
  const game=setup();game.campaign.support('kyle','stock-001');game.campaign.support('kyle',{weapon:null});
  game.campaign.support('kyle','stock-001');game.campaign.support('kyle',{weapon:null});
  const sword=game.state.warehouse.items.find(item=>item.instanceId==='stock-001');assert.equal(game.price(sword),50);
  assert.equal(game.price({itemId:'silver_ring',used:true}),47);
  const saved=makeSave(game.state);assert.deepEqual(validateSave(saved,skin),game.state);
  saved.state.warehouse.items.find(item=>item.instanceId==='stock-001').used='yes';assert.throws(()=>validateSave(saved,skin));
  const legacy=makeSave(setup().state);legacy.version=4;assert.deepEqual(validateSave(legacy,skin),legacy.state);
});
test('legacy archived gear can be recovered without losing equipped gear or duplicate items',()=>{
  const game=setup(),hero=game.state.campaign.heroes[0];
  game.campaign.support('kyle','stock-001');
  const [axe]=game.state.warehouse.items.splice(game.state.warehouse.items.findIndex(item=>item.instanceId==='stock-009'),1);hero.giftedEquipment.push(axe);
  assert.equal(game.campaign.recoverArchivedEquipment('kyle').ok,true);assert.equal(hero.giftedEquipment.length,0);assert.equal(hero.equipment.weapon.instanceId,'stock-001');
  assert.equal(game.state.warehouse.items.find(item=>item.instanceId==='stock-009').used,true);assert.deepEqual(validateSave(makeSave(game.state),skin),game.state);
});
