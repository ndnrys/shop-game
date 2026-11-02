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
  assert.equal(validateSave(makeSave(state),skin).campaign.trade.incoming.length,4);
});
test('saved missions retain their result across restart',()=>{
  const game=createSession(skin);game.campaign.support('lina','stock-001',30);game.campaign.dispatch();
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
  game.campaign.support('lina','stock-001',30);game.campaign.dispatch();c.expedition.roll=0;game.campaign.nextDay();c.gold=1200;
  game.campaign.depart(['lina']);
  const resumed=createSession(skin,validateSave(makeSave(game.state),skin));
  assert.equal(resumed.state.campaign.departure.companions[0].equipment.itemId,'iron_sword');
  assert.equal(resumed.warehouse.move('stock-004',7,7).ok,false);
  assert.equal(resumed.campaign.startTrade('weapons').ok,false);
});
