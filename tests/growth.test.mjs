import test from 'node:test';
import assert from 'node:assert/strict';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { makeSave, validateSave } from '../js/systems/save.js';

function leveled() {
  const game = createSession(skin);
  game.campaign.support('kyle', 'stock-001', 30);
  game.campaign.dispatch();
  const c = game.state.campaign;
  c.heroes[0].experience = skin.campaign.quest.levelExperience - 1;
  c.expedition.roll = 0;
  c.expedition.injuryRolls.fill(.999);
  game.campaign.nextDay();
  return game;
}

test('initial stats and level come from each character definition', () => {
  const custom = structuredClone(skin);
  Object.assign(custom.campaign.heroes[0], { level: 4, hp: 7, attack: 8, defense: 9 });
  const c = createSession(custom).state.campaign;
  assert.deepEqual([c.heroes[0].level, c.heroes[0].hp, c.heroes[0].attack, c.heroes[0].defense, c.heroes[0].pendingGrowth], [4,7,8,9,0]);
  assert.deepEqual(createSession(skin).state.campaign.heroes.map(h=>[h.level,h.hp,h.attack,h.defense]),[[1,3,4,2],[1,4,2,3],[1,4,1,3]]);
});

test('level up waits for an individual choice; balanced allocates exactly three points once', () => {
  const game = leveled(); const [hero, other] = game.state.campaign.heroes;
  assert.equal(hero.level, 2); assert.equal(hero.pendingGrowth, 1);
  assert.deepEqual([hero.hp,hero.attack,hero.defense],[3,4,2]);
  assert.equal(other.pendingGrowth, 0);
  let notifications = 0; game.subscribe(() => notifications++);
  assert.equal(game.campaign.grow(hero.id,'balanced').ok,true);
  assert.deepEqual([hero.hp,hero.attack,hero.defense],[4,5,3]);
  assert.equal(notifications,1);
  const snapshot = structuredClone(game.state);
  assert.equal(game.campaign.grow(hero.id,'attack').ok,false);
  assert.equal(game.campaign.grow(other.id,'hp').ok,false);
  assert.equal(game.campaign.grow('unknown','hp').ok,false);
  assert.deepEqual(game.state,snapshot); assert.equal(notifications,1);
});

test('focus adds two and randomly adds one to either other stat; reload preserves the result', () => {
  for (const focus of ['attack','defense','hp']) for (const seed of [0,100000]) {
    const game = leveled(); const c = game.state.campaign; c.seed = seed;
    assert.equal(game.campaign.grow(c.heroes[0].id,focus).ok,true);
    const hero = c.heroes[0];
    assert.equal(hero[focus],skin.campaign.heroes[0][focus]+2);
    assert.deepEqual(['hp','attack','defense'].filter(s => s !== focus).map(s => hero[s]-skin.campaign.heroes[0][s]).sort(),[0,1]);
    assert.deepEqual(validateSave(makeSave(game.state),skin),game.state);
  }
});

test('pending choices survive reload, multiple level ups and invalid choices', () => {
  const game = leveled(); const c = game.state.campaign;
  c.heroes[0].level += 2; c.heroes[0].pendingGrowth += 2;
  const saved = makeSave(game.state);
  const resumed = createSession(skin,validateSave(saved,skin));
  assert.equal(resumed.state.campaign.heroes[0].pendingGrowth,3);
  assert.equal(resumed.campaign.grow('kyle','unknown').ok,false);
  assert.deepEqual(resumed.state,saved.state);
  for (let i = 0; i < 3; i++) assert.equal(resumed.campaign.grow('kyle','balanced').ok,true);
  assert.equal(resumed.state.campaign.heroes[0].pendingGrowth,0);
  assert.deepEqual([resumed.state.campaign.heroes[0].hp,resumed.state.campaign.heroes[0].attack,resumed.state.campaign.heroes[0].defense],[6,7,5]);
});

test('version 5 retains level, ability, XP and equips while granting unallocated past levels', () => {
  const saved = makeSave(leveled().state); saved.version = 5;
  const old = saved.state.campaign.heroes[0];
  for (const key of ['hp','attack','defense','pendingGrowth']) delete old[key];
  const migrated = validateSave(saved,skin).campaign.heroes[0];
  assert.equal(migrated.level,old.level); assert.equal(migrated.ability,old.ability);
  assert.equal(migrated.experience,old.experience); assert.deepEqual(migrated.equipment,old.equipment);
  assert.deepEqual([migrated.hp,migrated.attack,migrated.defense,migrated.pendingGrowth],[3,4,2,1]);
  for (const key of ['hp','attack','defense','pendingGrowth']) {
    const bad = makeSave(leveled().state); bad.state.campaign.heroes[0][key] = -1;
    assert.throws(() => validateSave(bad,skin));
  }
});
