import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,skin} from './fixtures/fantasy.js';
import {makeSave,validateSave} from '../js/systems/save.js';
import {fixtureBonus} from '../js/systems/stores.js';

test('bulk restock is atomic, preserves individual IDs and used prices, and invalidates undo',()=>{
 const game=createGame(), s=game.state, source=s.warehouse.items[0];
 s.warehouse.items.push({...source,instanceId:'extra',x:7,y:7,used:true});
 const before=structuredClone(s);
 assert.equal(game.stocking.replenish(source.instanceId,'fixture-1',99).ok,false);
 assert.deepEqual(s,before);
 game.warehouse.move('stock-004',7,6);
 assert.equal(game.stocking.replenish(source.instanceId,'fixture-1',1).ok,true);
 assert.equal(game.warehouse.canUndo(),false);
 assert.equal(s.shop.displayedItems[0].instanceId,source.instanceId);
 assert.ok(s.warehouse.items.some(i=>i.instanceId==='extra'));
 assert.equal(s.warehouse.items.some(i=>i.instanceId===source.instanceId),false);
 assert.equal(game.stocking.return(source.instanceId).ok,true);
 assert.equal(s.warehouse.items.filter(i=>i.instanceId===source.instanceId).length,1);
});
test('fixtures reject collisions and bounds; bonuses use orthogonal adjacency and persist',()=>{
 const game=createGame(), s=game.state;
 assert.equal(game.stocking.placeFixture('special',1,0).ok,true);
 assert.equal(game.stocking.placeFixture('equipment',2,0).ok,true);
 assert.ok(Math.abs(fixtureBonus(s.shop,'fixture-2')-.15)<1e-10);
 const before=structuredClone(s);
 assert.equal(game.stocking.placeFixture('counter',2,0).ok,false);
 assert.equal(game.stocking.placeFixture('counter',-1,0).ok,false);
 assert.deepEqual(s,before);
 assert.equal(game.stocking.placeFixture('equipment',3,1,'fixture-3').ok,true);
 assert.equal(fixtureBonus(s.shop,'fixture-2'),.1);
 assert.deepEqual(validateSave(makeSave(s),skin),s);
});
test('old displayed instances migrate without warehouse space or ID changes; malformed shelves reject',()=>{
 const game=createGame();game.stocking.put('stock-001',0,0);
 const old=makeSave(game.state);old.version=10;delete old.state.shop.fixtures;delete old.state.shop.displayedItems[0].shelfId;
 const migrated=validateSave(old,skin);
 assert.equal(migrated.shop.displayedItems[0].instanceId,'stock-001');
 assert.equal(migrated.shop.displayedItems[0].shelfId,'fixture-1');
 const broken=makeSave(migrated);broken.state.shop.displayedItems[0].shelfId='missing';
 assert.throws(()=>validateSave(broken,skin));
});
test('empty shelves and unsold stock remain across days; shelf goods cannot support heroes',()=>{
 const game=createGame();game.stocking.put('stock-001',0,0);
 assert.equal(game.campaign.support('lina','stock-001').ok,false);
 const before=structuredClone(game.state.shop);
 assert.equal(game.campaign.nextDay().ok,true);
 assert.deepEqual(game.state.shop,before);
});

test('special and adjacent fixture effects are applied by the real customer purchase decision',async()=>{
 const {sellToCustomers}=await import('../js/systems/sales.js');
 const {random}=await import('../js/systems/random.js');
 const game=createGame(),s=game.state;
 game.stocking.placeFixture('special',1,0);game.stocking.placeFixture('equipment',2,0);
 game.stocking.replenish('stock-001','fixture-2',1);
 const item=s.shop.displayedItems[0], definition=game.itemDefinitions[item.itemId];
 const roll=random(structuredClone(s.campaign));
 const config={purchaseChance:Math.max(0,roll-.12),customers:[{id:'test',categories:[definition.categoryKey],budget:10000}]};
 assert.equal(sellToCustomers(s,game.itemDefinitions,config).receipts.length,1);
 assert.equal(s.shop.displayedItems.length,0);
 assert.equal(s.shop.fixtures.length,3);
});
