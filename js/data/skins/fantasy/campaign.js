import dungeons from "./dungeons.json" with { type: "json" };
import contentJobs from "./jobs.json" with { type: "json" };
import characters from "./characters.json" with { type: "json" };
import chapterContent from "./chapters.json" with { type: "json" };
import equipmentTypes from "./equipmentTypes.json" with { type: "json" };
import { characterArtwork } from "./artwork.js";
const jobs = Object.fromEntries(Object.entries(contentJobs).map(([id,job]) => [id, {
  ...job, statBonuses: job.bonuses,
  allowedTypes: contentJobs[job.baseJobId].allowedTypes,
}]));
const heroes = characters.filter(character => character.joinChapter === 0).map(character => ({
  id: character.id, nameKey: character.nameKey, jobId: character.initialJobId,
  level: character.initialLevel, ...character.initialStats, ability: 1,
}));
// Supplied sheets contain four 700 × 724 poses, left to right.
const characterPoses = { normal: 0, icon: 0, battle: 1, resting: 2, dead: 3 };
const companionArtwork = Object.fromEntries(characters.map(character => {
  const poses = Object.fromEntries(Object.entries(characterPoses).map(([pose, column]) => [pose, {
    imageUrl: new URL(`../../../../assets/skins/fantasy/characters/${character.images[pose]}`, import.meta.url).href,
    imageRegion: { x: column * 700, y: 0, width: 700, height: 724, atlasWidth: 2800, atlasHeight: 724 },
  }]));
  return [character.id, { ...poses.normal, poses }];
}));
// MVP仮設定。正式なバランスは docs/MVP-確認事項.md で確認する。
export default {
  jobs, equipmentTypes, dungeons, characters, ...chapterContent,
  legacyHeroIds: { lina: "kyle", bran: "gares", noa: "mira" },
  legacyJobIds: { swordsman: "adventurer" },
  presentation: {
    procurement: {
      assets: new URL('../../../../assets/skins/fantasy/procurement-ui/', import.meta.url).href,
      rows: { weapons: { portrait: 'weapon_merchant_portrait.png', icon: 'swords_icon.png', tone: 'red' }, armor: { portrait: 'armor_merchant_portrait.png', icon: 'armor-helmet-reference.png', crop: 'armor', tone: 'blue' }, tools: { portrait: 'items_merchant_portrait.png', icon: 'potion_icon.png', tone: 'green' } },
    },
    characters: { ...characterArtwork, ...companionArtwork },
    report: { icons: Object.fromEntries(["coin", "crates", "hammer", "handshake", "moneybag", "calendar", "clipboard", "rumor"].map(name => [name, new URL(`../../../../assets/skins/fantasy/report-ui/icon_${name}.svg`, import.meta.url).href])) },
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
    { id: "weapons", categoryKeys: ["weapon"], cost: 150, count: 1, specialtyChance: .7, buyback: .1, specialtyBuyback: .15 },
    { id: "armor", categoryKeys: ["armor"], cost: 150, count: 1, specialtyChance: .7, buyback: .1, specialtyBuyback: .15 },
    { id: "tools", categoryKeys: ["medicine", "material", "food", "accessory"], cost: 120, count: 1, specialtyChance: .7, buyback: .1, specialtyBuyback: .15 },
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
  heroes,
  equipmentSlots: ["weapon", "offhand", "body", "accessory"],
  itemSlots: { steel_sword: "weapon", reinforced_shield: "offhand", chain_armor: "body", charm: "accessory", iron_sword: "weapon", iron_axe: "weapon", oak_shield: "offhand", leather_armor: "body", silver_ring: "accessory" },
  gearCategories: ["weapon", "armor", "accessory"],
  gearPower: { iron_sword: 20, iron_axe: 20, oak_shield: 16, leather_armor: 22, silver_ring: 12, steel_sword: 28, reinforced_shield: 24, chain_armor: 34, charm: 18 },
  // Historical values are used only to settle expeditions dispatched by saves 1–8.
  legacy: { questId: "village-leader", reward: 20, bossReward: 250, progressSuccess: 9, progressSetback: 3, experienceSuccess: 10, experienceSetback: 6, injurySuccess: .18, injurySetback: .35, injuryBoss: .3 },
  danger: { incident: .4, death: .08, severe: .32, lightDays: 3, severeDays: 7, maximumReduction: .6, revivalCost: 100, revivalDays: 1 },
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
