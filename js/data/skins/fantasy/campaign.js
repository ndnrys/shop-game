import dungeons from "./dungeons.json" with { type: "json" };
import jobs from "./jobs.json" with { type: "json" };
import equipmentTypes from "./equipmentTypes.json" with { type: "json" };
import { characterArtwork } from "./artwork.js";
// MVP仮設定。正式なバランスは docs/MVP-確認事項.md で確認する。
export default {
  jobs, equipmentTypes, dungeons,
  presentation: {
    characters: characterArtwork,
    home: {
      background: new URL("../../../../assets/skins/fantasy/main-ui/interior-male.png", import.meta.url).href,
    },
  },
  residents: [
    { id: "carpenter", nameKey: "residents.carpenter.name", descriptionKey: "residents.carpenter.description" },
    { id: "church", nameKey: "residents.church.name", descriptionKey: "residents.church.description" },
  ],
  usedPriceRate: .5,
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
  partySize: 3, maximumParties: 3,
  heroes: [{ id: "lina", jobId: "swordsman", level: 1, hp: 3, attack: 3, defense: 3, ability: 12 }, { id: "bran", jobId: "warrior", level: 1, hp: 3, attack: 3, defense: 3, ability: 10 }, { id: "noa", jobId: "mage", level: 1, hp: 3, attack: 3, defense: 3, ability: 8 }],
  equipmentSlots: ["weapon", "offhand", "body", "accessory"],
  itemSlots: { steel_sword: "weapon", reinforced_shield: "offhand", chain_armor: "body", charm: "accessory", iron_sword: "weapon", iron_axe: "weapon", oak_shield: "offhand", leather_armor: "body", silver_ring: "accessory" },
  gearCategories: ["weapon", "armor", "accessory"],
  gearPower: { iron_sword: 20, iron_axe: 20, oak_shield: 16, leather_armor: 22, silver_ring: 12, steel_sword: 28, reinforced_shield: 24, chain_armor: 34, charm: 18 },
  // Historical values are used only to settle expeditions dispatched by saves 1–8.
  legacy: { questId: "village-leader", reward: 20, bossReward: 250, progressSuccess: 9, progressSetback: 3, experienceSuccess: 10, experienceSetback: 6, injurySuccess: .18, injurySetback: .35, injuryBoss: .3 },
  quest: {
    map: {
      imageUrl: new URL("../../../../assets/skins/fantasy/ui/village-map.svg", import.meta.url).href,
      titleKey: "mvp.map.title", descriptionKey: "mvp.map.description",
      home: { x: 23, y: 65, labelKey: "mvp.map.village" },
    },
    minimumEquipped: 1, levelExperience: 20,
    injuryChance: .18, recoveryMin: 1, recoveryMax: 3,
  },
};
