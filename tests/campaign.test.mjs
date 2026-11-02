import test from "node:test";
import assert from "node:assert/strict";
import skin from "../js/data/skins/fantasy/index.js";
import { createSession } from "../js/application/createSession.js";
import { calendarDate } from "../js/systems/calendar.js";
import { successChance } from "../js/systems/expeditions.js";

const setup = () => createSession(skin);
test("purchase pays once, unresolved incoming blocks next day, specialty buyback", () => {
  const game = setup(); const c = game.state.campaign;
  assert.equal(game.campaign.startTrade('weapons').ok, true);
  assert.equal(c.gold, 250); assert.equal(c.trade.incoming.length, 4);
  assert.equal(game.campaign.startTrade('armor').ok, false);
  assert.equal(game.campaign.nextDay().ok, false);
  assert.equal(game.campaign.buyback('iron_sword'), 15);
  assert.equal(game.campaign.buyback('oak_shield'), 8);
  for (const item of [...c.trade.incoming]) assert.equal(game.campaign.keep(item.instanceId).ok, true);
  assert.equal(game.campaign.finishTrade().ok, true);
  assert.equal(game.campaign.sellBack('stock-001', 'warehouse').ok, false);
});
test("only current merchant buys old inventory; no duplicate items after undo", () => {
  const game = setup();
  game.warehouse.move('stock-004',7,7);
  game.campaign.startTrade('armor');
  const gold = game.state.campaign.gold;
  assert.equal(game.campaign.sellBack('stock-001','warehouse').ok,true);
  assert.equal(game.state.campaign.gold,gold+10);
  assert.equal(game.warehouse.undo().ok,false);
  assert.equal(game.state.warehouse.items.some(item=>item.instanceId==='stock-001'),false);
});
test("external customers pay for shelf items and a day cannot be sold twice", () => {
  const game=setup(); game.stocking.put('stock-001',0,0); game.stocking.put('stock-002',1,0);
  const gold=game.state.campaign.gold;
  assert.equal(game.campaign.openShop().ok,true);
  assert.ok(game.state.campaign.gold>gold);
  const snapshot=JSON.stringify(game.state);
  assert.equal(game.campaign.openShop().ok,false); assert.equal(JSON.stringify(game.state),snapshot);
  assert.ok(game.state.campaign.journal.some(e=>e.type==='sale'&&e.details.customerId));
});
test("support transfers unique equipment and funds; expedition locks support", () => {
  const game=setup(); const c=game.state.campaign;
  assert.equal(game.campaign.support('lina','stock-001',30).ok,true);
  assert.equal(c.gold,370); assert.equal(c.heroes[0].funds,30);
  const chance=game.campaign.chance();
  assert.ok(chance>successChance(skin.campaign.heroes,skin.campaign,0));
  assert.equal(game.campaign.dispatch().ok,true);
  assert.equal(c.heroes[0].funds,0); assert.equal(c.expedition.heroIds.length,3);
  assert.equal(game.campaign.support('bran',null,10).ok,false);
  const reconstructed=createSession(skin,JSON.parse(JSON.stringify(game.state)));
  assert.deepEqual(reconstructed.state.campaign.expedition,c.expedition);
  c.expedition.roll=0; game.campaign.nextDay();
  assert.equal(c.day,2); assert.equal(c.defeated,true); assert.equal(c.expedition,null);
});
test("failed mission returns everyone and can be retried; end-to-end departure", () => {
  const game=setup(); const c=game.state.campaign;
  game.campaign.support('lina','stock-001',30); game.campaign.dispatch(); c.expedition.roll=1;
  game.campaign.nextDay(); assert.equal(c.defeated,false); assert.equal(c.expedition,null);
  game.campaign.support('lina',null,30); game.campaign.dispatch(); c.expedition.roll=0;
  game.campaign.nextDay(); assert.equal(c.defeated,true);
  assert.equal(game.campaign.depart([]).ok,false);
  c.gold=skin.campaign.targetGold;
  assert.equal(game.campaign.quote([]).openingGold,300);
  assert.equal(game.campaign.quote(['lina']).openingGold,250);
  assert.equal(game.campaign.quote(['lina','lina']).valid,false);
  assert.equal(game.campaign.depart(['lina']).ok,true);
  assert.equal(c.region,'next-town'); assert.equal(c.gold,250);
  assert.equal(c.departure.companions[0].equipment.weapon.itemId,'iron_sword');
  assert.equal(game.campaign.nextDay().ok,false);
});
test("calendar rollover and relief once per low-money day", () => {
  assert.deepEqual(calendarDate(6),{year:1,season:1,day:1});
  assert.deepEqual(calendarDate(21),{year:2,season:0,day:1});
  const game=setup(); const c=game.state.campaign; c.gold=0;
  assert.equal(game.campaign.relief().ok,true);assert.equal(c.gold,80);
  assert.equal(game.campaign.relief().ok,false);game.campaign.nextDay();
  assert.equal(game.campaign.relief().ok,true);
  assert.equal(c.journal.find(e=>e.type==='summary').details.net,80);
});

test("purchase cost allocation and realized gross profit remain distinct from cash flow",()=>{
  const testSkin=structuredClone(skin);testSkin.campaign.purchaseChance=1;
  const game=createSession(testSkin);game.campaign.startTrade('tools');const c=game.state.campaign;
  assert.equal(c.trade.incoming.reduce((sum,item)=>sum+item.purchaseCost,0),150);
  for(const item of [...c.trade.incoming])game.campaign.keep(item.instanceId);
  game.campaign.finishTrade();
  const purchased=game.state.warehouse.items.find(item=>item.purchaseCost>0);
  assert.equal(game.stocking.put(purchased.instanceId,0,0).ok,true);
  // Guaranteed purchase isolates cost accounting from the independent purchase roll.
  game.campaign.openShop();
  assert.ok(c.today.sales>0);
  assert.equal(c.today.cogs,purchased.purchaseCost);
  assert.equal(c.today.purchasing,150);
});

test("equipment occupies independent slots and all gifts remain with the supporter",()=>{
  const game=setup();const c=game.state.campaign;const hero=c.heroes[0];
  for(const id of ['stock-001','stock-003','stock-006','stock-007'])assert.equal(game.campaign.support('lina',id,0).ok,true);
  assert.deepEqual(Object.keys(hero.equipment).sort(),['weapon','offhand','body','accessory'].sort());
  assert.equal(hero.equipment.weapon.itemId,'iron_sword');
  assert.equal(game.campaign.support('lina','stock-009',0).ok,true);
  assert.equal(hero.equipment.weapon.itemId,'iron_axe');
  assert.equal(hero.giftedEquipment[0].itemId,'iron_sword');
  assert.equal(game.campaign.returnEquipment,undefined);
  assert.equal(game.warehouse.undo().ok,false);
  assert.equal(game.state.warehouse.items.some(item=>['stock-001','stock-003','stock-006','stock-007','stock-009'].includes(item.instanceId)),false);
  const expected=successChance([{ability:12,equipment:hero.equipment}, {ability:10}, {ability:8}],skin.campaign,0);
  assert.equal(game.campaign.chance(),expected);
});

test("every visitor speaks even without buying; journal persists after the day ends",()=>{
  const testSkin=structuredClone(skin);testSkin.campaign.purchaseChance=0;
  const game=createSession(testSkin);game.stocking.put('stock-001',0,0);
  const before=game.state.campaign.gold;
  assert.equal(game.campaign.openShop().ok,true);
  const c=game.state.campaign;
  assert.equal(c.gold,before);assert.equal(c.customerVisits.length,5);
  assert.ok(c.customerVisits.every(visit=>visit.purchase===null&&game.i18n.t(visit.dialogueKey)!==visit.dialogueKey));
  assert.equal(c.journal.filter(entry=>entry.type==='visit').length,5);
  const count=c.journal.length;assert.equal(game.campaign.openShop().ok,false);assert.equal(c.journal.length,count);
  game.campaign.nextDay();assert.deepEqual(c.customerVisits,[]);
  assert.equal(c.journal.filter(entry=>entry.type==='visit').length,5);
});
