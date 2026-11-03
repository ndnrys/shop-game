import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave, validateSave } from '../js/systems/save.js';

test('daily stages, trade blocking, empty-shelf opening, and next-day report persist', () => {
  const game = createSession(skin), a = game.campaign, c = game.state.campaign;
  let notifications = 0; game.subscribe(() => notifications++);
  assert.equal(c.phase, 'report'); a.advancePhase();
  assert.equal(c.phase, 'purchase'); a.startTrade('weapons');
  const before = JSON.stringify(game.state);
  assert.equal(a.advancePhase().ok, false); assert.equal(JSON.stringify(game.state), before);
  for (const item of [...c.trade.incoming]) a.sellBack(item.instanceId, 'incoming');
  a.finishTrade(); a.advancePhase(); assert.equal(c.phase, 'warehouse');
  a.advancePhase(); a.advancePhase(); assert.equal(c.phase, 'support');
  assert.equal(a.advancePhase().ok, false);
  assert.equal(a.openShop().ok, true); assert.equal(c.phase, 'sales');
  const saleState = JSON.stringify(game.state); assert.equal(a.openShop().ok, false); assert.equal(JSON.stringify(game.state), saleState);
  assert.equal(a.advancePhase().ok, false); assert.equal(c.phase, 'sales');
  assert.equal(a.previousPhase().ok, false);
  assert.deepEqual(validateSave(makeSave(game.state), skin), game.state);
  a.nextDay(); assert.equal(c.phase, 'report'); assert.equal(c.day, 2); assert.ok(notifications > 0);
});

test('merchant payments change quantities and allocate the exact total cost; invalid payments do not mutate', () => {
  const game = createSession(skin), a = game.campaign, c = game.state.campaign;
  c.gold = 1000;
  for (const amount of [0, -1, 151, 150.5, Infinity, 999999, NaN]) {
    const before = JSON.stringify(game.state); assert.equal(a.startTrade('weapons', amount).ok, false); assert.equal(JSON.stringify(game.state), before);
  }
  assert.equal(a.deliveryQuote('weapons',300).count,8);
  assert.equal(a.startTrade('weapons',300).ok,true);
  assert.equal(c.gold,700); assert.equal(c.trade.incoming.length,8);
  assert.equal(c.trade.incoming.reduce((sum,item)=>sum+item.purchaseCost,0),300);
  assert.deepEqual(validateSave(makeSave(game.state), skin),game.state);
});

test('party funds are shared while only selected members contribute power, grow and suffer injuries', () => {
  const game=createSession(skin), a=game.campaign, c=game.state.campaign;
  a.support('kyle','stock-001',30); a.support('gares','stock-003',40);
  c.heroes[1].recoverUntil=3;
  assert.equal(a.setParty(['unknown']).ok,false); assert.equal(a.setParty(['kyle','kyle']).ok,false);
  a.setParty([]); assert.equal(a.dispatch().reason,'mvp.error.party');
  a.setParty(['kyle']); assert.equal(a.dispatch().ok,true);
  assert.deepEqual(c.expedition.heroIds,['kyle']); assert.equal(c.expedition.funds,70); assert.equal(c.parties[0].funds,0);
  assert.equal(a.setParty(['gares']).ok,false);
  assert.deepEqual(validateSave(makeSave(game.state),skin),game.state);
  c.expedition.roll=0;c.expedition.injuryRolls=[0];c.expedition.recoveryRolls=[0];
  a.nextDay();assert.equal(c.heroes[0].experience,4);assert.equal(c.heroes[1].experience,0);assert.equal(c.heroes[2].recoverUntil,0);
});

test('version 3 saves migrate their stage and party without changing pending trade or expedition', () => {
  const game=createSession(skin);game.campaign.startTrade('tools');
  const old=makeSave(game.state);old.version=3;delete old.state.campaign.phase;delete old.state.campaign.parties; for(const hero of old.state.campaign.heroes) hero.funds=0;
  const state=validateSave(old,skin);assert.equal(state.campaign.phase,'warehouse');assert.deepEqual(state.campaign.trade,game.state.campaign.trade);
  assert.deepEqual(state.campaign.parties[0].members,['kyle','gares','mira']);
  for(const mutate of [s=>s.campaign.phase='unknown',s=>s.campaign.parties[0].members=['unknown',null,null],s=>s.campaign.phase='sales']){
    const invalid=makeSave(game.state);mutate(invalid.state);assert.throws(()=>validateSave(invalid,skin));
  }
});

 test('legacy opening and end saves resume without duplicate sales or lost day totals', () => {
 for (const [oldPhase, phase] of [['opening','support'],['end','sales']]) {
  const g=createSession(skin);if(oldPhase==='end')g.campaign.openShop();
  const save=makeSave(g.state);save.version=12;save.state.campaign.phase=oldPhase;
  const restored=validateSave(save,skin);assert.equal(restored.campaign.phase,phase);
  assert.deepEqual(restored.campaign.today,g.state.campaign.today);
  assert.deepEqual(restored.campaign.customerVisits,g.state.campaign.customerVisits);
  assert.deepEqual(validateSave(makeSave(restored),skin),restored);
 }
});
 test('procurement draws once then receives goods in warehouse before stocking',()=>{
 const g=createSession(skin),a=g.campaign,c=g.state.campaign;
 a.advancePhase();assert.ok(a.startProcurement([{merchantId:'weapons',lots:1}]).ok);
 assert.equal(c.phase,'warehouse');const seed=c.seed;
 assert.equal(a.advancePhase().ok,false);
 for(const item of [...c.trade.incoming])a.sellBack(item.instanceId,'incoming');
 a.finishTrade();assert.equal(c.phase,'warehouse');assert.equal(c.seed,seed);
 a.advancePhase();assert.equal(c.phase,'stocking');
});
