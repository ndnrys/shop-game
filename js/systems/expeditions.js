export function equipmentPower(hero, config) {
  return Object.values(hero.equipment ?? {}).reduce((sum, item) => sum + (config.gearPower[item.itemId] ?? 0), 0);
}

export function successChance(heroes, config, funds) {
  const ability = heroes.reduce((sum, hero) => sum + hero.ability, 0);
  const gear = heroes.reduce((sum, hero) => sum + equipmentPower(hero, config), 0);
  const rules = config.chance;
  return Math.min(rules.maximum, Math.max(rules.minimum, rules.base + ability * rules.abilityRate + gear * rules.gearRate + funds * rules.fundsRate));
}

export function departureQuote(campaign, config, heroIds) {
  const unique = new Set(heroIds);
  const valid = unique.size === heroIds.length && heroIds.every(id => campaign.heroes.some(hero => hero.id === id));
  const travel = config.travelPerHero * heroIds.length;
  return { valid, travel, openingGold: config.nextTownBaseGold - travel, settlement: campaign.gold - config.nextTownBaseGold };
}
