import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave, parseSave, validateSave } from '../js/systems/save.js';

test('roundtrip preserves incoming stock, RNG and remaining funds',()=>{
  const game=createSession(skin);game.campaign.startTrade('weapons');
  const text=JSON.stringify(makeSave(game.state));const state=parseSave(text,skin);
  assert.deepEqual(state,game.state);
  const resumed=createSession(skin,state);assert.equal(resumed.campaign.startTrade('armor').ok,false);
  for(const item of [...state.campaign.trade.incoming])resumed.campaign.sellBack(item.instanceId,'incoming');
  resumed.campaign.finishTrade();resumed.campaign.startTrade('armor');
  assert.equal(validateSave(makeSave(state),skin).campaign.trade.incoming.length,1);
});
test('saved missions retain their result across restart',()=>{
  const game=createSession(skin);game.campaign.support('kyle','stock-001',30);game.campaign.dispatch();
  const resumed=createSession(skin,parseSave(JSON.stringify(makeSave(game.state)),skin));
  game.campaign.nextDay();resumed.campaign.nextDay();assert.deepEqual(resumed.state,game.state);
});
test('overlaps, duplicate items, unknown catalog and invalid money are rejected',()=>{
  for(const mutate of [
    s=>{s.warehouse.items.push({...s.warehouse.items[0]});},
    s=>{s.warehouse.items[1].x=1;},
    s=>{s.warehouse.items[0].itemId='unknown';},
    s=>{s.campaign.gold=-1;},
    s=>{s.campaign.gold=NaN;},
    s=>{s.campaign.heroes[0].id='unknown';},
    s=>{s.campaign.region='unknown';},
  ]){
    const saved=makeSave(createSession(skin).state);mutate(saved.state);
    assert.throws(()=>validateSave(saved,skin));
  }
});
test('invalid format/version and cross-skin saves are rejected',()=>{
  const saved=makeSave(createSession(skin).state);saved.version=99;
  assert.throws(()=>validateSave(saved,skin));assert.throws(()=>parseSave('{',skin));
  saved.version=1;saved.state.skinId='other';assert.throws(()=>validateSave(saved,skin));
});
test('departure snapshot and companion gear survive saving; village operations stop',()=>{
  const game=createSession(skin);const c=game.state.campaign;
  c.dungeonProgress={forest:60,camp:139};game.campaign.support('kyle','stock-001',30);game.campaign.dispatch();c.expedition.roll=0;game.campaign.nextDay();c.gold=skin.campaign.targetGold;
  game.campaign.depart(['kyle']);
  const resumed=createSession(skin,validateSave(makeSave(game.state),skin));
  assert.equal(resumed.state.campaign.departure.companions[0].equipment.weapon.itemId,'iron_sword');
  assert.equal(resumed.warehouse.move('stock-004',7,7).ok,false);
  assert.equal(resumed.campaign.startTrade('weapons').ok,false);
});

test('legacy single-slot equipment migrates without losing gifts or changing pending outcomes',()=>{
  const game=createSession(skin);game.campaign.support('kyle','stock-001',30);game.campaign.dispatch();
  const legacy=legacySave(game.state);legacy.version=1;
  for(const hero of legacy.state.campaign.heroes){hero.equipment=Object.values(hero.equipment)[0]??null;delete hero.giftedEquipment;}
  const state=validateSave(legacy,skin);
  assert.equal(state.campaign.heroes[0].equipment.weapon.itemId,'iron_sword');
  assert.deepEqual(state.campaign.heroes[1].equipment,{});
  assert.equal(state.campaign.expedition.legacyOutcome.roll,.1);
  assert.equal(state.campaign.expedition.legacyOutcome.chance,.8);
  assert.equal(state.campaign.expedition.legacyOutcome.kind,"explore");
  assert.deepEqual(state.campaign.dungeonProgress,{forest:0,camp:0});
});

test('slot assignments and archived gifts roundtrip; duplicate gifts are rejected',()=>{
  const game=createSession(skin);
  game.campaign.support('kyle','stock-001');game.campaign.support('kyle','stock-009');game.campaign.support('kyle','stock-003');
  const value=makeSave(game.state);
  assert.deepEqual(validateSave(value,skin),game.state);
  const invalid=structuredClone(value);invalid.state.campaign.heroes[0].equipment.body=invalid.state.campaign.heroes[0].equipment.offhand;delete invalid.state.campaign.heroes[0].equipment.offhand;
  assert.throws(()=>validateSave(invalid,skin));
  value.state.campaign.heroes[0].giftedEquipment.push(value.state.campaign.heroes[0].equipment.weapon);
  assert.throws(()=>validateSave(value,skin));
});

test('visitor speech and purchase results roundtrip; forged speech keys are rejected',()=>{
  const game=createSession(skin);game.stocking.put('stock-001',0,0);game.campaign.openShop();
  const value=makeSave(game.state);
  assert.deepEqual(validateSave(value,skin),game.state);
  value.state.campaign.customerVisits[0].dialogueKey='unrecognized';
  assert.throws(()=>validateSave(value,skin));
});

test('progress, levels, injuries and recovery dates survive restart',()=>{
  const game=createSession(skin);game.campaign.support('kyle','stock-001',30);game.campaign.dispatch();
  const c=game.state.campaign;c.expedition.roll=0;c.expedition.injuryRolls=[0,0,0];c.expedition.severityRolls=[.1,.1,.1];game.campaign.nextDay();
  const state=validateSave(makeSave(game.state),skin);assert.deepEqual(state,game.state);
  const resumed=createSession(skin,state);
  assert.equal(resumed.campaign.dispatch().reason,'health.noMembers');
  assert.equal(state.progress,undefined);assert.equal(state.campaign.dungeonProgress.forest,7);
  assert.equal(state.campaign.heroes[0].recoverUntil,5);
  const invalid=makeSave(game.state);invalid.state.campaign.dungeonProgress.forest=61;assert.throws(()=>validateSave(invalid,skin));
  const invalidLevel=makeSave(game.state);invalidLevel.state.campaign.heroes[0].level=0;assert.throws(()=>validateSave(invalidLevel,skin));
});

test('version 2 pending missions migrate to exploration without rerolling or losing gear',()=>{
  const game=createSession(skin);game.campaign.support('kyle','stock-001',30);game.campaign.dispatch();
  const legacy=legacySave(game.state);legacy.version=2;
  delete legacy.state.campaign.progress;
  for(const hero of legacy.state.campaign.heroes){delete hero.level;delete hero.experience;delete hero.recoverUntil;}
  delete legacy.state.campaign.expedition.kind;delete legacy.state.campaign.expedition.injuryRolls;delete legacy.state.campaign.expedition.recoveryRolls;
  const state=validateSave(legacy,skin);
  assert.equal(state.campaign.expedition.legacyOutcome.roll,.1);
  assert.equal(state.campaign.expedition.legacyOutcome.kind,'explore');assert.deepEqual(state.campaign.dungeonProgress,{forest:0,camp:0});
  assert.equal(state.campaign.heroes[0].equipment.weapon.itemId,'iron_sword');
});

test('previously completed tutorials stay completed when the new target is raised',()=>{
  const game=createSession(skin);const c=game.state.campaign;c.dungeonProgress={forest:60,camp:140};c.defeated=true;c.gold=skin.campaign.targetGold;
  game.campaign.depart(['kyle']);
  const old=legacySave(game.state);old.version=2;delete old.state.campaign.progress;
  old.state.campaign.departure.villageGold=1200;old.state.campaign.departure.settlement=900;delete old.state.campaign.departure.targetGold;
  for(const hero of [...old.state.campaign.heroes,...old.state.campaign.departure.companions]){delete hero.level;delete hero.experience;delete hero.recoverUntil;}
  const state=validateSave(old,skin);
  assert.equal(state.campaign.defeated,true);assert.deepEqual(state.campaign.dungeonProgress,{forest:60,camp:140});assert.equal(state.campaign.region,'next-town');
  assert.equal(state.campaign.departure.targetGold,1200);
});

function legacySave(state) {
  const saved=makeSave(state);saved.version=8;const c=saved.state.campaign;
  c.progress=c.defeated?100:0;delete c.dungeonProgress;
  if(c.expedition){const e=c.expedition;c.expedition={questId:skin.campaign.legacy.questId,kind:'explore',partyId:e.partyId,heroIds:e.heroIds,departedDay:e.departedDay,returnDay:e.returnDay,funds:e.funds,roll:.1,chance:.8,injuryRolls:e.injuryRolls,recoveryRolls:e.recoveryRolls};}
  return saved;
}

test('procurement release version 6 migrates hero stats and preserves queued merchant stock',()=>{
  const game=createSession(skin);
  assert.equal(game.campaign.startProcurement([{merchantId:'weapons',lots:1},{merchantId:'tools',lots:1}]).ok,true);
  const old=makeSave(game.state);old.version=6;const c=old.state.campaign;
  c.progress=0;delete c.dungeonProgress;delete c.parties;c.partyIds=['kyle','gares','mira'];
  for(const hero of c.heroes){hero.funds=0;for(const key of ['hp','attack','defense','pendingGrowth','jobId'])delete hero[key];}
  const resumed=createSession(skin,validateSave(old,skin));
  assert.deepEqual(resumed.state.campaign.trade,c.trade);
  assert.deepEqual(resumed.state.campaign.heroes.map(hero=>[hero.hp,hero.attack,hero.defense]),[[3,4,2],[4,2,3],[4,1,3]]);
  assert.deepEqual(validateSave(makeSave(resumed.state),skin),resumed.state);
  for(const merchant of ['weapons','tools']){
    assert.equal(resumed.state.campaign.trade.merchantId,merchant);
    for(const item of [...resumed.state.campaign.trade.incoming])assert.equal(resumed.campaign.sellBack(item.instanceId,'incoming').ok,true);
    assert.equal(resumed.campaign.finishTrade().ok,true);
  }
  assert.equal(resumed.state.campaign.trade,null);
});
