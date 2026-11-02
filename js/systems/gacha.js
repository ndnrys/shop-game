import { random } from "./random.js";

export function buybackPrice(definition, merchant) {
  const rate = merchant.categoryKeys.includes(definition.categoryKey) ? merchant.specialtyBuyback : merchant.buyback;
  return Math.floor(definition.price * rate);
}

export function drawDelivery(campaign, definitions, merchant) {
  const all = Object.values(definitions);
  const specialized = all.filter(item => merchant.categoryKeys.includes(item.categoryKey));
  const others = all.filter(item => !merchant.categoryKeys.includes(item.categoryKey));
  return Array.from({ length: merchant.count }, (_, index) => {
    const preferred = random(campaign) < merchant.specialtyChance ? specialized : others;
    const pool = preferred.length ? preferred : all;
    const definition = pool[Math.floor(random(campaign) * pool.length)];
    return { instanceId: `delivery-${campaign.nextItemId++}`, itemId: definition.id, purchaseCost: Math.floor(merchant.cost / merchant.count) + (index < merchant.cost % merchant.count ? 1 : 0), x: 0, y: 0, rotated: 0 };
  });
}
