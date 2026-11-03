import { effectiveHeroStats } from './heroStats.js';

export function dungeonStatus(campaign, config, id) {
  const dungeon = config.dungeons.find(entry => entry.id === id);
  if (!dungeon) return null;
  const progress = campaign.dungeonProgress[id];
  return {
    id, progress, required: dungeon.requiredProgress,
    cleared: progress >= dungeon.requiredProgress,
    unlocked: dungeon.requires.every(requiredId => {
      const required = config.dungeons.find(entry => entry.id === requiredId);
      return required && campaign.dungeonProgress[requiredId] >= required.requiredProgress;
    }),
  };
}

export function nextDungeon(campaign, config) {
  return config.dungeons.find(dungeon => {
    const status = dungeonStatus(campaign, config, dungeon.id);
    return status.unlocked && !status.cleared;
  });
}

export function partyAttack(campaign, config, definitions, partyId) {
  const party = campaign.parties.find(entry => entry.id === partyId);
  return (party?.members ?? []).filter(Boolean).reduce((sum, id) => {
    const hero = campaign.heroes.find(entry => entry.id === id);
    return sum + effectiveHeroStats(hero, config, definitions).attack;
  }, 0);
}

export function advanceDungeon(campaign, config, id, amount) {
  const status = dungeonStatus(campaign, config, id);
  if (!status || !status.unlocked || status.cleared) return { ok: false, reason: 'dungeon.unavailable' };
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, reason: 'dungeon.invalidProgress' };
  const gain = Math.min(amount, status.required - status.progress);
  campaign.dungeonProgress[id] += gain;
  return { ok: true, gain, progress: campaign.dungeonProgress[id], cleared: campaign.dungeonProgress[id] === status.required };
}

export function allDungeonsCleared(campaign, config) {
  return config.dungeons.length > 0 && config.dungeons.every(dungeon => dungeonStatus(campaign, config, dungeon.id).cleared);
}
