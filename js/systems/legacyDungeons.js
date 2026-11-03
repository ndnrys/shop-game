import { partyAttack, nextDungeon } from './dungeons.js';

// Preserve relative progress from the retired percentage campaign. An undefeated
// leader at 100% still needs a real return; completed villages remain completed.
export function legacyProgressMap(progress, defeated, config) {
  const total = config.dungeons.reduce((sum, dungeon) => sum + dungeon.requiredProgress, 0);
  let remaining = defeated ? total : Math.min(total - 1, Math.floor(Math.min(100, progress) * total / 100));
  return Object.fromEntries(config.dungeons.map(dungeon => {
    const amount = Math.min(dungeon.requiredProgress, remaining);
    remaining -= amount;
    return [dungeon.id, amount];
  }));
}

export function legacyExpeditionOutcome(sourceProgress, kind, roll, chance, config) {
  const rules = config.legacy;
  const success = roll < chance;
  const boss = kind === 'boss';
  return {
    sourceProgress, kind, roll, chance,
    targetProgress: legacyProgressMap(sourceProgress + (boss ? 0 : success ? rules.progressSuccess : rules.progressSetback), boss && success, config),
    reward: boss ? (success ? rules.bossReward : 0) : (success ? rules.reward : 0),
    experience: success ? rules.experienceSuccess : rules.experienceSetback,
    injuryChance: boss ? rules.injuryBoss : success ? rules.injurySuccess : rules.injurySetback,
  };
}

export function migrateLegacyDungeons(campaign, config, definitions) {
  if (!campaign.dungeonProgress) {
    if (!Number.isSafeInteger(campaign.progress) || campaign.progress < 0 || campaign.progress > 100 || (campaign.defeated && campaign.progress !== 100)) throw new Error('Invalid legacy progress');
    campaign.dungeonProgress = legacyProgressMap(campaign.progress, campaign.defeated, config);
  }
  const old = campaign.expedition;
  if (old && !old.dungeonId) {
    if (campaign.defeated || old.questId !== config.legacy.questId || !['explore','boss'].includes(old.kind) || (old.kind === 'boss') !== (campaign.progress === 100) || !Number.isFinite(old.roll) || old.roll < 0 || old.roll >= 1 || !Number.isFinite(old.chance) || old.chance < 0 || old.chance > 1) throw new Error('Invalid legacy expedition');
    const dungeon = nextDungeon(campaign, config);
    campaign.expedition = {
      dungeonId: dungeon.id, partyId: old.partyId, heroIds: old.heroIds,
      departedDay: old.departedDay, returnDay: old.returnDay,
      attackPower: partyAttack(campaign, config, definitions, old.partyId), funds: old.funds,
      injuryRolls: old.injuryRolls, recoveryRolls: old.recoveryRolls,
      legacyOutcome: legacyExpeditionOutcome(campaign.progress, old.kind, old.roll, old.chance, config),
    };
  }
  delete campaign.progress;
}
