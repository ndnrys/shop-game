// MVP仮設定。正式なバランスは docs/MVP-確認事項.md で確認する。
export default {
  startingGold: 400, targetGold: 1200, nextTownBaseGold: 300, travelPerHero: 50,
  daysPerSeason: 5, aidAmount: 80,
  merchants: [
    { id: "weapons", categoryKeys: ["weapon"], cost: 150, count: 4, specialtyChance: .7, buyback: .1, specialtyBuyback: .15 },
    { id: "armor", categoryKeys: ["armor"], cost: 150, count: 4, specialtyChance: .7, buyback: .1, specialtyBuyback: .15 },
    { id: "tools", categoryKeys: ["medicine", "material", "food", "accessory"], cost: 150, count: 4, specialtyChance: .7, buyback: .1, specialtyBuyback: .15 },
  ],
  customers: [
    { id: "traveler", categories: ["food", "medicine"], budget: 150 },
    { id: "swordsman", categories: ["weapon"], budget: 180 },
    { id: "guard", categories: ["armor"], budget: 160 },
    { id: "explorer", categories: ["material", "accessory"], budget: 160 },
    { id: "wanderer", categories: ["weapon", "armor", "medicine", "food", "material", "accessory"], budget: 200 },
  ],
  purchaseChance: .9,
  heroes: [{ id: "lina", ability: 12 }, { id: "bran", ability: 10 }, { id: "noa", ability: 8 }],
  equipmentSlots: ["weapon", "offhand", "body", "accessory"],
  itemSlots: { iron_sword: "weapon", iron_axe: "weapon", oak_shield: "offhand", leather_armor: "body", silver_ring: "accessory" },
  gearCategories: ["weapon", "armor", "accessory"],
  gearPower: { iron_sword: 20, iron_axe: 20, oak_shield: 16, leather_armor: 22, silver_ring: 12 },
  chance: { base: .15, abilityRate: .01, gearRate: .005, fundsRate: .001, minimum: .1, maximum: .95 },
  quest: { id: "village-leader", duration: 1, minimumFunds: 30, minimumEquipped: 1, reward: 180, experience: 2 },
};
