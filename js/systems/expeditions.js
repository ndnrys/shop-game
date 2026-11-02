import { random } from "./random.js";

export function equipmentPower(hero, config) {
  return Object.values(hero.equipment ?? {}).reduce((sum, item) => sum + (config.gearPower[item.itemId] ?? 0), 0);
}

export function questStage(progress, config) {
  return config.quest.stages.findLast(stage => progress >= stage.from);
}

export function successChance(heroes, config, funds, progress = 0, kind = 'explore') {
  const ability = heroes.reduce((sum, hero) => sum + hero.ability, 0);
  const gear = heroes.reduce((sum, hero) => sum + equipmentPower(hero, config), 0);
  const rules = config.chance;
  const penalty = kind === 'boss' ? config.quest.bossPenalty : questStage(progress, config).penalty;
  return Math.min(rules.maximum, Math.max(rules.minimum, rules.base + ability * rules.abilityRate + gear * rules.gearRate + funds * rules.fundsRate - penalty));
}

export function planExpedition(campaign, config, kind) {
  const heroes = campaign.heroes.filter(hero => (campaign.partyIds ?? campaign.heroes.map(entry => entry.id)).includes(hero.id));
  const funds = heroes.reduce((sum, hero) => sum + hero.funds, 0);
  return {
    kind, questId: config.quest.id, heroIds: heroes.map(hero => hero.id),
    departedDay: campaign.day, returnDay: campaign.day + Math.max(1, config.quest.duration),
    chance: successChance(heroes, config, funds, campaign.progress, kind),
    roll: random(campaign), funds,
    injuryRolls: heroes.map(() => random(campaign)),
    recoveryRolls: heroes.map(() => random(campaign)),
  };
}

export function resolveExpedition(campaign, config) {
  const expedition = campaign.expedition;
  const success = expedition.roll < expedition.chance;
  const boss = expedition.kind === 'boss';
  const events = [];
  const gained = boss ? 0 : Math.min(100 - campaign.progress, success ? config.quest.progressSuccess : config.quest.progressSetback);
  campaign.progress += gained;
  const reward = boss ? (success ? config.quest.bossReward : 0) : (success ? config.quest.reward : 0);
  campaign.gold += reward;
  campaign.today.rewards += reward;
  if (boss && success) campaign.defeated = true;
  events.push({ type: boss ? (success ? 'bossSuccess' : 'bossFailure') : 'exploration', details: { questId: expedition.questId, amount: reward, gain: gained, progress: campaign.progress, success } });
  const injuryChance = boss ? config.quest.injuryBoss : success ? config.quest.injurySuccess : config.quest.injurySetback;
  for (const [index, id] of expedition.heroIds.entries()) {
    const hero = campaign.heroes.find(entry => entry.id === id);
    hero.experience += success ? config.quest.experienceSuccess : config.quest.experienceSetback;
    while (hero.experience >= config.quest.levelExperience) {
      hero.experience -= config.quest.levelExperience;
      hero.level += 1;
      hero.ability += config.quest.abilityPerLevel;
      events.push({ type: 'levelUp', details: { heroId: hero.id, level: hero.level, ability: hero.ability } });
    }
    if (expedition.injuryRolls[index] < injuryChance) {
      const days = config.quest.recoveryMin + Math.floor(expedition.recoveryRolls[index] * (config.quest.recoveryMax - config.quest.recoveryMin + 1));
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
