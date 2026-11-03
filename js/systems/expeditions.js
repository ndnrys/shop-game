import { chapterOverview } from './chapters.js';
import { expeditionAttributeBonus } from './attributes.js';
import { expeditionMembers, expeditionRisks, resolveHealth } from './health.js';
import { random } from './random.js';
import { advanceDungeon, partyAttack } from './dungeons.js';

export function equipmentPower(hero, config) {
  return Object.values(hero.equipment ?? {}).reduce((sum, item) => sum + (config.gearPower[item.itemId] ?? 0), 0);
}

export function planExpedition(campaign, config, definitions, dungeonId, partyId) {
  const dungeon = config.dungeons.find(entry => entry.id === dungeonId);
  const party = campaign.parties.find(entry => entry.id === partyId);
  const heroIds = expeditionMembers(campaign, partyId).map(hero => hero.id);
  return {
    dungeonId, partyId, heroIds,
    departedDay: campaign.day, returnDay: campaign.day + dungeon.duration,
    attackPower: partyAttack(campaign, config, definitions, partyId), funds: party.funds,
    experienceBonusPercent: expeditionAttributeBonus(campaign, config, definitions, dungeonId, partyId).percent,
    risks: expeditionRisks(campaign, config, definitions, dungeonId, partyId).members,
    severityRolls: heroIds.map(() => random(campaign)),
    injuryRolls: heroIds.map(() => random(campaign)),
    recoveryRolls: heroIds.map(() => random(campaign)),
  };
}

export function resolveExpedition(campaign, config) {
  const expedition = campaign.expedition;
  const dungeon = config.dungeons.find(entry => entry.id === expedition.dungeonId);
  const events = [];
  let experience, injuryChance;
  if (expedition.legacyOutcome) {
    const legacy = expedition.legacyOutcome;
    const gain = config.dungeons.reduce((sum, entry) => sum + legacy.targetProgress[entry.id] - campaign.dungeonProgress[entry.id], 0);
    for (const entry of config.dungeons) {
      const clearedBefore = campaign.dungeonProgress[entry.id] === entry.requiredProgress;
      campaign.dungeonProgress[entry.id] = legacy.targetProgress[entry.id];
      if (!clearedBefore && campaign.dungeonProgress[entry.id] === entry.requiredProgress) events.push({ type: 'dungeonClear', details: { dungeonId: entry.id } });
    }
    campaign.gold += legacy.reward;
    campaign.today.rewards += legacy.reward;
    experience = legacy.experience;
    injuryChance = legacy.injuryChance;
    events.unshift({ type: 'legacyDungeonReturn', details: { dungeonId: dungeon.id, partyId: expedition.partyId, gain, experience, amount: legacy.reward } });
  } else {
    const result = advanceDungeon(campaign, config, dungeon.id, expedition.attackPower);
    if (!result.ok) throw new Error('Pending expedition dungeon is unavailable');
    experience = Math.floor(result.gain * (100 + (expedition.experienceBonusPercent ?? 0)) / 100);
    injuryChance = config.quest.injuryChance;
    events.push({ type: 'dungeonReturn', details: { dungeonId: dungeon.id, partyId: expedition.partyId, gain: result.gain, progress: result.progress, required: dungeon.requiredProgress, experience } });
    if (result.cleared) events.push({ type: 'dungeonClear', details: { dungeonId: dungeon.id } });
  }
  if (!campaign.defeated && chapterOverview(campaign, config).cleared) {
    campaign.defeated = true;
    events.push({ type: 'villageSecured', details: {} });
  }
  for (const [index, id] of expedition.heroIds.entries()) {
    const hero = campaign.heroes.find(entry => entry.id === id);
    hero.experience += experience;
    while (hero.experience >= config.quest.levelExperience) {
      hero.experience -= config.quest.levelExperience;
      hero.level += 1;
      hero.pendingGrowth += 1;
      events.push({ type: 'levelUp', details: { heroId: hero.id, level: hero.level } });
    }
    if (expedition.risks) {
      const outcome = resolveHealth(expedition.risks[index], expedition.injuryRolls[index], expedition.severityRolls[index]);
      hero.health = outcome.health;
      hero.recoverUntil = outcome.days ? campaign.day + outcome.days : 0;
      if (outcome.health === 'dead') events.push({ type: 'death', details: { heroId: hero.id } });
      else if (outcome.days) events.push({ type: 'wound', details: { heroId: hero.id, severity: outcome.health, days: outcome.days, returnDay: hero.recoverUntil } });
    } else if (expedition.injuryRolls[index] < injuryChance) {
      const days = config.quest.recoveryMin + Math.floor(expedition.recoveryRolls[index] * (config.quest.recoveryMax - config.quest.recoveryMin + 1));
      hero.health = 'light';
      hero.recoverUntil = campaign.day + days;
      events.push({ type: 'injury', details: { heroId: hero.id, days, returnDay: hero.recoverUntil } });
    }
  }
  campaign.expedition = null;
  return events;
}

export function departureQuote(campaign, config, heroIds) {
  const unique = new Set(heroIds);
  const valid = unique.size === heroIds.length && heroIds.every(id => campaign.heroes.some(hero => hero.id === id));
  const travel = config.travelPerHero * heroIds.length;
  return { valid, travel, openingGold: config.nextTownBaseGold - travel, settlement: campaign.gold - config.nextTownBaseGold };
}
