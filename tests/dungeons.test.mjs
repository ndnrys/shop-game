import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { advanceDungeon } from '../js/systems/dungeons.js';
import { makeSave, validateSave } from '../js/systems/save.js';

const setup=()=>{const game=createSession(skin);game.campaign.support('kyle','stock-001');return game;};
test('200 required progress with 12 attack clears on the seventeenth return',()=>{
  const config={dungeons:[{id:'example',requiredProgress:200,requires:[]}]},c={dungeonProgress:{example:0}};
  for(let i=0;i<16;i++)assert.equal(advanceDungeon(c,config,'example',12).cleared,false);
  assert.deepEqual(advanceDungeon(c,config,'example',12),{ok:true,gain:8,progress:200,cleared:true});
  assert.equal(advanceDungeon(c,config,'example',12).ok,false);
});
test('zero funds permit expedition, actual progress grants XP to each member, no reward or success roll',()=>{
  const game=setup(),c=game.state.campaign,gold=c.gold;
  assert.equal(game.campaign.dispatch('forest').ok,true);assert.equal(c.expedition.attackPower,7);
  assert.equal(c.expedition.roll,undefined);assert.equal(c.expedition.chance,undefined);
  c.expedition.injuryRolls=[.999,.999,.999];game.campaign.nextDay();
  assert.equal(c.gold,gold);assert.equal(c.parties[0].funds,0);assert.equal(c.dungeonProgress.forest,7);
  assert.ok(c.heroes.every(hero=>hero.experience===7));
});
test('attack is snapshotted at dispatch and leveling grants pending individual choices',()=>{
  const game=setup(),c=game.state.campaign;c.heroes.forEach(h=>h.experience=18);
  game.campaign.dispatch();assert.equal(c.expedition.attackPower,7);
  // Growth choices are locked while away; the recorded departure power survives saving.
  assert.equal(game.campaign.grow('kyle','attack').ok,false);
  assert.equal(validateSave(makeSave(game.state),skin).campaign.expedition.attackPower,7);
  c.expedition.injuryRolls=[.999,.999,.999];game.campaign.nextDay();
  assert.equal(c.dungeonProgress.forest,7);assert.ok(c.heroes.every(h=>h.level===2&&h.pendingGrowth===1&&h.experience===5));
});
test('save rejects locked progress, overflows, inconsistent completion and invalid attack snapshots',()=>{
  for(const change of [c=>c.dungeonProgress.camp=1,c=>c.dungeonProgress.forest=61,c=>c.dungeonProgress.extra=0,c=>c.defeated=true,c=>c.expedition.attackPower=0,c=>c.expedition.dungeonId='camp']){
    const game=setup();game.campaign.dispatch();const saved=makeSave(game.state);change(saved.state.campaign);assert.throws(()=>validateSave(saved,skin));
  }
});
function oldSave(progress=0,boss=false,roll=.1){
  const game=setup();game.campaign.dispatch();const saved=makeSave(game.state);saved.version=8;
  const c=saved.state.campaign,e=c.expedition;c.progress=progress;delete c.dungeonProgress;
  c.expedition={questId:skin.campaign.legacy.questId,kind:boss?'boss':'explore',partyId:e.partyId,heroIds:e.heroIds,departedDay:e.departedDay,returnDay:e.returnDay,funds:e.funds,roll,chance:.8,injuryRolls:[.999,.999,.999],recoveryRolls:e.recoveryRolls};return saved;
}
test('legacy progress and pending outcomes migrate without rerolling and settle only once',()=>{
  const saved=oldSave(50),state=validateSave(saved,skin),seed=state.campaign.seed;
  assert.deepEqual(state.campaign.dungeonProgress,{forest:60,camp:40});
  assert.equal(seed,saved.state.campaign.seed);
  const game=createSession(skin,validateSave(makeSave(state),skin)),c=game.state.campaign,gold=c.gold;
  game.campaign.nextDay();assert.deepEqual(c.dungeonProgress,{forest:60,camp:58});
  assert.equal(c.gold,gold+20);assert.ok(c.heroes.every(h=>h.experience===10));
  const resumed=createSession(skin,validateSave(makeSave(game.state),skin));resumed.campaign.nextDay();assert.equal(resumed.state.campaign.gold,gold+20);
});
test('legacy pending boss keeps its original result while removing the extra boss stage',()=>{
  for(const [roll,cleared,reward] of [[.1,true,250],[.99,false,0]]){
    const game=createSession(skin,validateSave(oldSave(100,true,roll),skin)),c=game.state.campaign,gold=c.gold;
    assert.deepEqual(c.dungeonProgress,{forest:60,camp:139});game.campaign.nextDay();
    assert.equal(c.defeated,cleared);assert.equal(c.dungeonProgress.camp,cleared?140:139);assert.equal(c.gold,gold+reward);
    assert.deepEqual(validateSave(makeSave(game.state),skin),game.state);
  }
});
test('forged legacy outcomes and mismatched old stages are rejected',()=>{
  const saved=oldSave();saved.state.campaign.expedition.kind='boss';assert.throws(()=>validateSave(saved,skin));
  const migrated=makeSave(validateSave(oldSave(),skin));migrated.state.campaign.expedition.legacyOutcome.reward=999;assert.throws(()=>validateSave(migrated,skin));
});
