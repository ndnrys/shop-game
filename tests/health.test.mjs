import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { resolveHealth } from '../js/systems/health.js';
import { makeSave, validateSave } from '../js/systems/save.js';
import { dailyTotals } from '../js/systems/sales.js';
const setup=()=>{const g=createSession(skin);g.campaign.support('kyle','stock-001');g.campaign.support('gares','stock-009');return g;};
test('defense lowers incidents; HP reduces severe injury, death and recovery duration',()=>{
  const g=setup(),c=g.state.campaign,h=c.heroes[0];
  const risk=()=>g.campaign.risks('forest').members[0];const base=risk();h.defense+=10;
  assert.ok(risk().incident<base.incident);h.defense-=10;h.hp+=10;const hp=risk();
  assert.equal(hp.incident,base.incident);assert.ok(hp.death<base.death&&hp.severe<base.severe&&hp.lightDays<base.lightDays&&hp.severeDays<base.severeDays);
});
test('dungeon danger and diminishing funding effect; no finite amount reaches immunity',()=>{
  const g=setup(),c=g.state.campaign,party=c.parties[0];
  const quote=id=>g.campaign.risks(id);
  assert.ok(quote('camp').members[0].death>quote('forest').members[0].death);
  party.funds=100;assert.equal(quote('forest').reduction,.3);assert.equal(quote('camp').reduction,.15);
  const low=quote('forest').reduction;party.funds=200;const high=quote('forest').reduction;party.funds=300;
  assert.ok(quote('forest').reduction-high<high-low);party.funds=1e9;assert.ok(quote('forest').reduction<.6);
  c.heroes[0].recoverUntil=4;assert.equal(quote('forest').members.length,2);assert.ok(quote('forest').reduction>.59);
});
test('health outcome boundaries are mutually exclusive and use independent individual rolls',()=>{
  const g=setup(),r=g.campaign.risks('forest').members[0];
  assert.equal(resolveHealth(r,r.incident,0).health,'healthy');
  assert.equal(resolveHealth(r,0,0).health,'dead');
  assert.equal(resolveHealth(r,0,r.deathShare).health,'severe');
  assert.equal(resolveHealth(r,0,r.deathShare+r.severeShare).health,'light');
});
test('death preserves equipment, growth and slots; remaining members alone gain progress and XP',()=>{
  const g=setup(),c=g.state.campaign,gear=structuredClone(c.heroes[0].equipment);
  g.campaign.dispatch();c.expedition.injuryRolls=[0,0,.999];c.expedition.severityRolls=[0,.1,.999];g.campaign.nextDay();
  assert.equal(c.heroes[0].health,'dead');assert.equal(c.heroes[1].health,'severe');assert.equal(c.heroes[2].health,'healthy');
  assert.deepEqual(c.heroes[0].equipment,gear);assert.equal(c.heroes[0].experience,7);assert.deepEqual(c.parties[0].members,['kyle','gares','mira']);
  g.campaign.support('mira','stock-007');assert.equal(g.campaign.dispatch().ok,true);assert.deepEqual(c.expedition.heroIds,['mira']);assert.equal(c.expedition.attackPower,1);
  c.expedition.injuryRolls=[.999];g.campaign.nextDay();assert.equal(c.heroes[0].experience,7);assert.equal(c.heroes[2].experience,8);
  assert.deepEqual(validateSave(makeSave(g.state),skin),g.state);
});
test('funds are consumed exactly once, survive pending saves, reset for next trip and failed dispatch keeps them',()=>{
  const g=setup(),c=g.state.campaign;g.campaign.fundParty(100);const gold=c.gold;g.campaign.dispatch();
  assert.equal(c.parties[0].funds,0);assert.equal(c.expedition.funds,100);assert.equal(c.gold,gold);
  const saved=validateSave(makeSave(g.state),skin),resumed=createSession(skin,saved);g.campaign.nextDay();resumed.campaign.nextDay();assert.deepEqual(resumed.state,g.state);
  c.heroes.forEach(h=>{h.health='dead';h.recoverUntil=0;});g.campaign.fundParty(10);const before=structuredClone(g.state);
  assert.equal(g.campaign.dispatch().reason,'health.noMembers');assert.deepEqual(g.state,before);
});
test('revival charges once, appears in cash accounting and recovers on the next day with gear intact',()=>{
  const g=setup(),c=g.state.campaign,h=c.heroes[0];h.health='dead';const gear=structuredClone(h.equipment),gold=c.gold;
  assert.equal(g.campaign.revive('kyle').ok,true);assert.equal(c.gold,gold-100);assert.equal(h.health,'reviving');assert.equal(h.recoverUntil,2);
  assert.equal(dailyTotals(c.today).net,-100);assert.equal(g.campaign.revive('kyle').ok,false);
  const resumed=createSession(skin,validateSave(makeSave(g.state),skin));resumed.campaign.nextDay();
  assert.equal(resumed.state.campaign.heroes[0].health,'healthy');assert.deepEqual(resumed.state.campaign.heroes[0].equipment,gear);
  assert.ok(resumed.campaign.members().some(member=>member.id==='kyle'));
});
test('all-dead party can earn aid and pay for revival; insufficient money does not mutate',()=>{
  const g=setup(),c=g.state.campaign;c.gold=0;c.heroes.forEach(h=>h.health='dead');
  const before=structuredClone(g.state);assert.equal(g.campaign.revive('kyle').ok,false);assert.deepEqual(g.state,before);
  g.campaign.relief();g.campaign.nextDay();g.campaign.relief();assert.equal(c.gold,160);assert.equal(g.campaign.revive('kyle').ok,true);
  g.campaign.nextDay();assert.equal(g.campaign.dispatch().ok,true);assert.deepEqual(c.expedition.heroIds,['kyle']);
});
test('save rejects unknown health, impossible timers, participant injection and forged risk snapshots',()=>{
  for(const mutate of [c=>c.heroes[0].health='unknown',c=>{c.heroes[0].health='dead';c.heroes[0].recoverUntil=3;},c=>{c.heroes[0].health='reviving';c.heroes[0].recoverUntil=0;},c=>c.expedition.risks[0].incident=1,c=>c.expedition.severityRolls[0]=1]){
    const g=setup();g.campaign.dispatch();const saved=makeSave(g.state);mutate(saved.state.campaign);assert.throws(()=>validateSave(saved,skin));
  }
});
test('version 9 pending expedition preserves its old risk, RNG and retained funds without adding death',()=>{
  const g=setup();g.campaign.fundParty(30);g.campaign.dispatch();const old=makeSave(g.state);old.version=9;const c=old.state.campaign;
  c.parties[0].funds=30;delete c.expedition.risks;delete c.expedition.severityRolls;delete c.today.revival;for(const h of c.heroes)delete h.health;
  c.expedition.injuryRolls=[0,0,0];c.expedition.recoveryRolls=[0,0,0];const seed=c.seed;
  const migrated=validateSave(old,skin);assert.equal(migrated.campaign.seed,seed);assert.equal(migrated.campaign.expedition.legacyRisk,true);
  const resumed=createSession(skin,validateSave(makeSave(migrated),skin));resumed.campaign.nextDay();
  assert.ok(resumed.state.campaign.heroes.every(h=>h.health==='light'));assert.equal(resumed.state.campaign.parties[0].funds,30);
});
