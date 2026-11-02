import { characterArtwork } from "./artwork.js";
// MVP仮設定。正式なバランスは docs/MVP-確認事項.md で確認する。
export default {
  presentation: {
    characters: characterArtwork,
  },
  residents: [
    { id: "carpenter", nameKey: "residents.carpenter.name", descriptionKey: "residents.carpenter.description" },
    { id: "church", nameKey: "residents.church.name", descriptionKey: "residents.church.description" },
  ],
  startingGold: 400, targetGold: 3500, nextTownBaseGold: 300, travelPerHero: 50,
  daysPerSeason: 5, aidAmount: 80,
  merchants: [
    { id: "weapons", categoryKeys: ["weapon"], cost: 150, count: 4, specialtyChance: .7, buyback: .1, specialtyBuyback: .15 },
    { id: "armor", categoryKeys: ["armor"], cost: 150, count: 4, specialtyChance: .7, buyback: .1, specialtyBuyback: .15 },
    { id: "tools", categoryKeys: ["medicine", "material", "food", "accessory"], cost: 120, count: 4, specialtyChance: .7, buyback: .1, specialtyBuyback: .15 },
  ],
  customers: [
    { id: "traveler", dialogueKey: "mvp.line.traveler", categories: ["food", "medicine"], budget: 170 },
    { id: "swordsman", dialogueKey: "mvp.line.swordsman", categories: ["weapon"], budget: 230 },
    { id: "guard", dialogueKey: "mvp.line.guard", categories: ["armor"], budget: 250 },
    { id: "explorer", dialogueKey: "mvp.line.explorer", categories: ["material", "accessory"], budget: 250 },
    { id: "wanderer", dialogueKey: "mvp.line.wanderer", categories: ["weapon", "armor", "medicine", "food", "material", "accessory"], budget: 280 },
  ],
  purchaseChance: .9,
  heroes: [{ id: "lina", ability: 12 }, { id: "bran", ability: 10 }, { id: "noa", ability: 8 }],
  equipmentSlots: ["weapon", "offhand", "body", "accessory"],
  itemSlots: { steel_sword: "weapon", reinforced_shield: "offhand", chain_armor: "body", charm: "accessory", iron_sword: "weapon", iron_axe: "weapon", oak_shield: "offhand", leather_armor: "body", silver_ring: "accessory" },
  gearCategories: ["weapon", "armor", "accessory"],
  gearPower: { iron_sword: 20, iron_axe: 20, oak_shield: 16, leather_armor: 22, silver_ring: 12, steel_sword: 28, reinforced_shield: 24, chain_armor: 34, charm: 18 },
  chance: { base: .2, abilityRate: .008, gearRate: .002, fundsRate: .001, minimum: .1, maximum: .95 },
  quest: {
    map: {
      imageUrl: new URL("../../../../assets/skins/fantasy/ui/village-map.svg", import.meta.url).href,
      titleKey: "mvp.map.title", descriptionKey: "mvp.map.description",
      home: { x: 23, y: 65, labelKey: "mvp.map.village" },
      points: [
        { stage: "outskirts", x: 32, y: 52, labelKey: "mvp.map.outskirts" },
        { stage: "camp", x: 51, y: 43, labelKey: "mvp.map.camp" },
        { stage: "stronghold", x: 75, y: 31, labelKey: "mvp.map.stronghold" },
      ],
    },
    id: "village-leader", duration: 1, minimumFunds: 30, minimumEquipped: 1,
    reward: 20, bossReward: 250, progressSuccess: 9, progressSetback: 3,
    experienceSuccess: 10, experienceSetback: 6, levelExperience: 20, abilityPerLevel: 1,
    injurySuccess: .18, injurySetback: .35, injuryBoss: .3, recoveryMin: 1, recoveryMax: 3,
    bossPenalty: .12,
    stages: [{ from: 0, key: "outskirts", penalty: 0 }, { from: 40, key: "camp", penalty: .02 }, { from: 80, key: "stronghold", penalty: .04 }],
  },
};
