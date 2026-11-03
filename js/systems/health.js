import { effectiveHeroStats } from './heroStats.js';

export function canExpedition(hero, day) {
  return !!hero && hero.health !== 'dead' && hero.health !== 'reviving' && hero.recoverUntil <= day;
}
export function expeditionMembers(campaign, partyId) {
  const party = campaign.parties.find(entry => entry.id === partyId);
  return (party?.members ?? []).filter(Boolean).map(id => campaign.heroes.find(hero => hero.id === id)).filter(hero => canExpedition(hero, campaign.day));
}
export function expeditionRisks(campaign, config, definitions, dungeonId, partyId) {
  const dungeon = config.dungeons.find(entry => entry.id === dungeonId);
  const party = campaign.parties.find(entry => entry.id === partyId);
  const members = expeditionMembers(campaign, partyId);
  if (!dungeon || !party || !members.length) return { reduction: 0, members: [] };
  const rules = config.danger;
  const base = dungeon.fundingBase * members.length / config.partySize;
  const reduction = rules.maximumReduction * party.funds / (party.funds + base);
  return { reduction, members: members.map(hero => {
    const { hp, defense } = effectiveHeroStats(hero, config, definitions);
    const d = dungeon.danger;
    const incident = rules.incident * d / (d + defense) * (1 - reduction);
    const deathShare = rules.death * d / (d + hp);
    const severeShare = rules.severe * d / (d + hp);
    return { heroId: hero.id, incident, deathShare, severeShare,
      death: incident * deathShare, severe: incident * severeShare, light: incident * (1 - deathShare - severeShare),
      lightDays: Math.max(1, Math.ceil(rules.lightDays * d / (d + hp))),
      severeDays: Math.max(1, Math.ceil(rules.severeDays * d / (d + hp))) };
  }) };
}
export function resolveHealth(risk, incidentRoll, severityRoll) {
  if (incidentRoll >= risk.incident) return { health: 'healthy', days: 0 };
  if (severityRoll < risk.deathShare) return { health: 'dead', days: 0 };
  if (severityRoll < risk.deathShare + risk.severeShare) return { health: 'severe', days: risk.severeDays };
  return { health: 'light', days: risk.lightDays };
}
export function reviveHero(campaign, config, heroId) {
  const hero = campaign.heroes.find(entry => entry.id === heroId);
  if (!hero || hero.health !== 'dead') return { ok: false, reason: 'health.cannotRevive' };
  if (campaign.gold < config.danger.revivalCost) return { ok: false, reason: 'mvp.error.money' };
  campaign.gold -= config.danger.revivalCost;
  campaign.today.revival += config.danger.revivalCost;
  hero.health = 'reviving';
  hero.recoverUntil = campaign.day + config.danger.revivalDays;
  return { ok: true };
}
