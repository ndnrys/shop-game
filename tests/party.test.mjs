import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave, validateSave } from '../js/systems/save.js';

const setup = () => createSession(skin);
test('plus creates empty parties up to three, with distinct slots and funds', () => {
  const game=setup(),c=game.state.campaign;
  assert.equal(c.parties.length,1); assert.equal(c.parties[0].members.length,3);
  assert.equal(game.campaign.createParty().ok,true); assert.equal(game.campaign.createParty().ok,true);
  assert.deepEqual(c.parties.slice(1).map(p=>p.members),[[null,null,null],[null,null,null]]);
  const before=structuredClone(game.state);
  assert.equal(game.campaign.createParty().ok,false); assert.deepEqual(game.state,before);
  assert.deepEqual(validateSave(makeSave(game.state),skin),game.state);
});
test('assignment swaps within a party, moves across parties without duplicates and preserves funds', () => {
  const game=setup(),a=game.campaign,c=game.state.campaign;
  a.createParty(); a.fundParty(30,'party-1'); a.fundParty(40,'party-2');
  a.assignPartySlot('party-1',1,'kyle'); assert.deepEqual(c.parties[0].members,['gares','kyle','mira']);
  a.assignPartySlot('party-2',2,'kyle'); assert.deepEqual(c.parties[0].members,['gares',null,'mira']);
  assert.deepEqual(c.parties[1].members,[null,null,'kyle']);
  a.assignPartySlot('party-2',2,'mira'); assert.deepEqual(c.parties[0].members,['gares',null,null]);
  assert.deepEqual(c.parties[1].members,[null,null,'mira']);
  a.assignPartySlot('party-2',2,null); assert.deepEqual(c.parties[1].members,[null,null,null]);
  assert.deepEqual(c.parties.map(p=>p.funds),[30,40]);
  for(const args of [['party-1',3,'kyle'],['unknown',0,'kyle'],['party-1',0,'unknown']]) {
    const before=structuredClone(game.state);assert.equal(a.assignPartySlot(...args).ok,false);assert.deepEqual(game.state,before);
  }
});
test('funding is per party and only the departing party consumes funds', () => {
  const game=setup(),a=game.campaign,c=game.state.campaign;
  a.createParty(); a.assignPartySlot('party-2',0,'kyle'); a.support('kyle','stock-001');
  a.fundParty(30,'party-1'); a.fundParty(60,'party-2');
  assert.equal(a.attack('party-2'),4);
  assert.equal(a.dispatch(undefined,'party-2').ok,true);
  assert.equal(c.expedition.partyId,'party-2'); assert.deepEqual(c.expedition.heroIds,['kyle']); assert.equal(c.expedition.funds,60);
  assert.deepEqual(c.parties.map(p=>p.funds),[30,0]);
  const before=structuredClone(game.state);
  for(const result of [a.createParty(),a.assignPartySlot('party-1',0,'kyle'),a.fundParty(10,'party-1'),a.dispatch(undefined,'party-1')]) assert.equal(result.ok,false);
  assert.deepEqual(game.state,before);
  assert.deepEqual(validateSave(makeSave(game.state),skin),game.state);
});
test('funding errors and empty or unknown party dispatch preserve money and state', () => {
  const game=setup(),a=game.campaign;a.createParty();
  for(const amount of [-1,0,1.5,Infinity,401]) { const before=structuredClone(game.state);assert.equal(a.fundParty(amount,'party-2').ok,false);assert.deepEqual(game.state,before); }
  assert.equal(a.fundParty(10,'unknown').ok,false);
  assert.equal(a.dispatch(undefined,'party-2').reason,'mvp.error.party');
  assert.equal(a.dispatch(undefined,'unknown').reason,'mvp.error.party');
});
test('version six individual funds migrate exactly once, including pending expeditions', () => {
  const game=setup();game.campaign.support('kyle','stock-001',30);game.campaign.dispatch();
  const saved=makeSave(game.state);saved.version=6;const c=saved.state.campaign;
  c.partyIds=['kyle','gares','mira'];delete c.parties;delete c.expedition.partyId;
  c.heroes.forEach((hero,i)=>hero.funds=[0,40,20][i]);
  const state=validateSave(saved,skin);
  assert.deepEqual(state.campaign.parties,[{id:'party-1',members:['kyle','gares','mira'],funds:60}]);
  assert.equal(state.campaign.expedition.partyId,'party-1');assert.equal(state.campaign.expedition.funds,30);
  assert.ok(state.campaign.heroes.every(hero=>!Object.hasOwn(hero,'funds')));
  assert.deepEqual(validateSave(makeSave(state),skin),state);
  const bad=structuredClone(saved);bad.state.campaign.heroes[1].funds=-1;assert.throws(()=>validateSave(bad,skin));
});
test('saved parties reject duplicates, extra parties, invalid funding and expedition party IDs', () => {
  for(const mutate of [c=>c.parties[0].members=['kyle','kyle',null],c=>c.parties[0].funds=-1,c=>c.parties=Array.from({length:4},(_,i)=>({id:`party-${i+1}`,members:[null,null,null],funds:0})),c=>c.parties[0].members.push(null),c=>c.parties.push({...c.parties[0],id:'party-2'})]) {
    const saved=makeSave(setup().state);mutate(saved.state.campaign);assert.throws(()=>validateSave(saved,skin));
  }
});

test('pending expedition must belong to the party whose members departed',()=>{
  const game=setup();game.campaign.support('kyle','stock-001',30);game.campaign.dispatch();
  const saved=makeSave(game.state);saved.state.campaign.expedition.partyId='unknown';assert.throws(()=>validateSave(saved,skin));
  const other=makeSave(game.state);other.state.campaign.parties[0].members[0]=null;assert.throws(()=>validateSave(other,skin));
});
