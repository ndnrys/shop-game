import { effectiveHeroStats } from './heroStats.js';
import { expeditionMembers } from './health.js';

export function expeditionAttributeBonus(campaign, config, definitions, dungeonId, partyId) {
  const dungeon = config.dungeons.find(entry => entry.id === dungeonId);
  const attributes = {};
  for (const hero of expeditionMembers(campaign, partyId)) {
    for (const [key,value] of Object.entries(effectiveHeroStats(hero,config,definitions).attributes)) attributes[key] = (attributes[key] ?? 0) + value;
  }
  const effective = Object.fromEntries(Object.entries(dungeon.recommendedAttributes ?? {}).map(([key,max]) => [key,Math.min(max, attributes[key] ?? 0)]));
  return { attributes, effective, percent: Object.values(effective).reduce((sum,value) => sum + value,0) * (dungeon.attributeBonus ?? 0) };
}
