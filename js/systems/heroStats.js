// Saved stats contain growth only. Job traits are derived, never accumulated into saves.
export function effectiveHeroStats(hero, config, definitions) {
  const job = config.jobs[hero.jobId];
  const bonuses = job.statBonuses ?? {};
  const attributes = {};
  for (const item of Object.values(hero.equipment)) {
    for (const [attribute, amount] of Object.entries(definitions[item.itemId].attributes ?? {})) {
      if (amount > 0) attributes[attribute] = (attributes[attribute] ?? 0) + amount;
    }
  }
  // Apply once per present attribute, after summing all equipped pieces.
  for (const attribute of Object.keys(attributes)) attributes[attribute] += job.equippedAttributeBonus ?? 0;
  return {
    hp: hero.hp + (bonuses.hp ?? 0),
    attack: hero.attack + (bonuses.attack ?? 0),
    defense: hero.defense + (bonuses.defense ?? 0),
    attributes: Object.fromEntries([...new Set([...Object.keys(attributes), ...Object.keys(hero.attributes ?? {})])].map(key => [key, (attributes[key] ?? 0) + (hero.attributes?.[key] ?? 0)])),
  };
}
