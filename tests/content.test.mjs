import test from 'node:test';
import assert from 'node:assert/strict';
import legacy from './fixtures/legacy-content-v11.json' with {type:'json'};
import skin from '../js/data/skins/fantasy/index.js';
import {createSession} from '../js/application/createSession.js';
import {makeSave,validateSave} from '../js/systems/save.js';

test('MVP loads the approved village roster, 27 profiles, 21 jobs and product scope without activating incomplete chapters',()=>{
 const g=createSession(skin),c=g.state.campaign;
 assert.deepEqual(c.heroes.map(h=>[h.id,h.jobId,h.hp,h.attack,h.defense,h.attributes]),[['kyle','adventurer',3,4,2,{}],['gares','warrior',4,2,3,{}],['mira','mage',4,1,3,{fire:1}]]);
 assert.equal(skin.campaign.characters.length,27);assert.equal(Object.keys(skin.campaign.jobs).length,21);
 assert.deepEqual(skin.campaign.releaseProfiles.mvp,['prologue']);assert.deepEqual(skin.campaign.releaseProfiles.product,['prologue','chapter_1','chapter_2']);
 assert.equal(c.chapterId,'prologue');assert.equal(g.campaign.chapter().releaseEnd,true);
 assert.equal(skin.campaign.chapters[1].dungeonIds,null);const incomplete=structuredClone(skin);incomplete.campaign.activeRelease='product';assert.throws(()=>createSession(incomplete),/not configured/);assert.deepEqual(validateSave(makeSave(g.state),skin),g.state);
 const unsupported=makeSave(g.state);unsupported.state.campaign.chapterId='chapter_1';assert.throws(()=>validateSave(unsupported,skin));
});
test('actual v11 save migrates identifiers, gear, party, growth, journal and pending rolls without losing ownership',()=>{
 const s=validateSave(legacy.pending,skin),old=legacy.pending.state.campaign,c=s.campaign;
 assert.deepEqual(c.heroes.map(h=>h.id),['kyle','gares','mira']);assert.equal(c.heroes[0].jobId,'adventurer');
 assert.deepEqual([c.heroes[0].hp,c.heroes[0].attack,c.heroes[0].defense,c.heroes[0].pendingGrowth],[5,6,7,1]);
 assert.deepEqual(c.expedition.heroIds,['kyle','gares','mira']);assert.deepEqual(c.expedition.injuryRolls,old.expedition.injuryRolls);assert.equal(c.seed,old.seed);assert.equal(c.gold,old.gold);
 assert.deepEqual(c.parties[0].members,['kyle','gares','mira']);assert.ok(c.journal.some(e=>e.details.heroId==='kyle'));
 assert.equal(c.heroes[1].equipment.weapon.itemId,'iron_axe');assert.equal(c.heroes[1].equipment.offhand,undefined);assert.equal(c.heroes[1].giftedEquipment[0].itemId,'oak_shield');
 const g=createSession(skin,validateSave(makeSave(s),skin));g.campaign.nextDay();assert.equal(g.state.campaign.dungeonProgress.forest,old.expedition.attackPower);
 assert.deepEqual(validateSave(makeSave(g.state),skin),g.state);
});
test('completed legacy departure remains completed with the same companions and money',()=>{
 const s=validateSave(legacy.departure,skin);assert.equal(s.campaign.region,'next-town');assert.equal(s.campaign.departure.companions[0].id,'kyle');
 assert.equal(s.campaign.gold,legacy.departure.state.campaign.gold);assert.deepEqual(validateSave(makeSave(s),skin),s);
});
test('native and equipped attributes cap each recommended type and floor XP after applying the combined bonus',()=>{
 const s=structuredClone(skin);const forest=s.campaign.dungeons[0];forest.recommendedAttributes={fire:3,wind:2};forest.attributeBonus=3;
 const g=createSession(s),c=g.state.campaign;c.heroes[0].attributes={fire:2,wind:3,water:2};c.heroes[2].attributes={};c.heroes[0].attack=6;
 assert.equal(g.campaign.support('kyle','stock-001').ok,true);
 const quote=g.campaign.attributes('forest');assert.deepEqual(quote.effective,{fire:2,wind:2});assert.equal(quote.percent,12);
 assert.equal(g.campaign.dispatch().ok,true);assert.equal(c.expedition.attackPower,9);assert.equal(c.expedition.experienceBonusPercent,12);
 c.expedition.injuryRolls.fill(.999);const resumed=createSession(s,validateSave(makeSave(g.state),s));resumed.campaign.nextDay();
 assert.equal(resumed.state.campaign.dungeonProgress.forest,9);assert.ok(resumed.state.campaign.heroes.every(h=>h.experience===10));
});
test('resting members contribute neither attack nor attributes; capping progress also caps base XP',()=>{
 const s=structuredClone(skin);s.campaign.dungeons[0].recommendedAttributes={fire:3};s.campaign.dungeons[0].attributeBonus=3;
 const g=createSession(s),c=g.state.campaign;c.heroes[2].recoverUntil=4;c.heroes[2].health='light';g.campaign.support('kyle','stock-001');
 assert.equal(g.campaign.attributes('forest').percent,0);c.dungeonProgress.forest=59;g.campaign.dispatch();c.expedition.injuryRolls.fill(.999);g.campaign.nextDay();
 assert.equal(c.heroes[0].experience,1);assert.equal(c.heroes[2].experience,0);assert.equal(g.campaign.chapter().cleared,false);
});
test('the final dungeon reaching 100 percent defeats the named enemy without an extra boss battle or gold requirement',()=>{
 const g=createSession(skin),c=g.state.campaign;c.dungeonProgress={forest:60,camp:139};c.gold=0;g.campaign.support('kyle','stock-001');g.campaign.dispatch('camp');c.expedition.injuryRolls.fill(.999);g.campaign.nextDay();
 assert.equal(c.defeated,true);assert.equal(g.campaign.chapter().percent,100);assert.equal(g.campaign.chapter().cleared,true);assert.equal(c.gold,0);
 assert.equal(g.i18n.t(g.campaign.chapter().chapter.enemy.nameKey),'襲撃隊長 ガド');assert.equal(g.campaign.dispatch().ok,false);assert.deepEqual(validateSave(makeSave(g.state),skin),g.state);
});

test('changing initial definitions never overwrites previously saved native stats or level',()=>{
 const g=createSession(skin),saved=makeSave(g.state),changed=structuredClone(skin);
 Object.assign(changed.campaign.heroes[0],{level:9,hp:50,attack:40,attributes:{water:3}});
 const restored=validateSave(saved,changed).campaign.heroes[0];assert.equal(restored.level,1);assert.equal(restored.hp,3);assert.equal(restored.attack,4);assert.deepEqual(restored.attributes,{});
 const other=createSession(skin);g.state.campaign.heroes[2].attributes.fire=9;assert.equal(other.state.campaign.heroes[2].attributes.fire,1);assert.equal(skin.campaign.heroes[2].attributes.fire,1);
});

test('chapter completion follows its configured target rather than unrelated dungeon records',()=>{
 const custom=structuredClone(skin);custom.campaign.dungeons.push({...custom.campaign.dungeons[0],id:'unrelated',requires:[]});
 const g=createSession(custom),c=g.state.campaign;c.dungeonProgress.forest=60;c.dungeonProgress.camp=139;g.campaign.support('kyle','stock-001');g.campaign.dispatch('camp');c.expedition.injuryRolls.fill(.999);g.campaign.nextDay();
 assert.equal(c.dungeonProgress.unrelated,0);assert.equal(c.defeated,true);assert.deepEqual(validateSave(makeSave(g.state),custom),g.state);
});
