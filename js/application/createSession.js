import commonEn from "../data/locales/en.js";
import commonJa from "../data/locales/ja.js";
import { createI18n } from "../systems/i18n.js";
import { createGameState } from "../state/gameState.js";
import { createGame } from "./game.js";

const commonLocales = { ja: commonJa, en: commonEn };

// Only this composition layer knows how shared UI copy and skin data fit together.
export function createSession(skin, state = createGameState(skin)) {
  const dictionaries = {};
  for (const [locale, messages] of Object.entries(skin.locales)) {
    if (!commonLocales[locale]) throw new Error(`Missing shared locale: ${locale}`);
    const required = ["app.title", "app.homeLabel", "app.brand", "app.storeName", "warehouse.eyebrow", "stocking.eyebrow", "money.amount", "warehouse.selectedMeta"];
    for (const item of Object.values(skin.itemDefinitions)) {
      if (item.attributes !== undefined) {
        if (!item.attributes || typeof item.attributes !== 'object' || Array.isArray(item.attributes) || Object.values(item.attributes).some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error(`Invalid item attributes: ${item.id}`);
        required.push(...Object.keys(item.attributes).map(key => `attributes.${key}`));
      }
      required.push(`items.${item.id}`, `items.short.${item.id}`, `categories.${item.categoryKey}`, `materials.${item.materialKey}`);
      if (!skin.presentation[item.id]?.glyph && !skin.presentation[item.id]?.imageUrl) throw new Error(`Missing item presentation: ${item.id}`);
    }
    if (skin.campaign) {
      const config = skin.campaign;
      for (const hero of config.heroes) if (!Object.hasOwn(config.jobs, hero.jobId)) throw new Error(`Unknown initial job: ${hero.id}`);
      for (const job of Object.values(config.jobs)) {
        required.push(job.nameKey, job.traitKey);
        if (job.statBonuses !== undefined && (!job.statBonuses || typeof job.statBonuses !== 'object' || Array.isArray(job.statBonuses) || Object.entries(job.statBonuses).some(([key, value]) => !['hp','attack','defense'].includes(key) || !Number.isSafeInteger(value) || value < 0))) throw new Error('Invalid job stat bonuses');
        if (job.equippedAttributeBonus !== undefined && (!Number.isSafeInteger(job.equippedAttributeBonus) || job.equippedAttributeBonus < 0)) throw new Error('Invalid job attribute bonus');
        if (!Array.isArray(job.allowedTypes) || job.allowedTypes.some(type => !config.equipmentTypes[type])) throw new Error('Invalid job equipment types');
      }
      for (const type of Object.values(config.equipmentTypes)) {
        required.push(type.nameKey);
        if (!config.equipmentSlots.includes(type.slot)) throw new Error('Invalid equipment type slot');
      }
      for (const [id, slot] of Object.entries(config.itemSlots)) {
        const item = skin.itemDefinitions[id];
        const type = config.equipmentTypes[item?.equipmentType];
        if (!type || type.slot !== slot || (slot === 'weapon' && (![1, 2].includes(type.hands ?? item.hands) || (type.hands !== null && item.hands !== undefined && item.hands !== type.hands)))) throw new Error(`Invalid equipment type: ${id}`);
      }
    }
    if (skin.campaign) for (const customer of skin.campaign.customers) required.push(customer.dialogueKey);
    for (const resident of skin.campaign?.residents ?? []) required.push(resident.nameKey, resident.descriptionKey);
    const map = skin.campaign?.quest?.map;
    if (map) required.push(map.titleKey, map.descriptionKey, map.home.labelKey, ...map.points.map(point => point.labelKey), 'mvp.map.current', 'mvp.map.cleared', 'mvp.map.boss');
    for (const key of required) {
      if (!messages[key]) throw new Error(`Missing skin translation: ${locale}.${key}`);
    }
    dictionaries[locale] = { ...commonLocales[locale], ...messages };
  }
  const i18n = createI18n(dictionaries);
  return createGame(state, skin, i18n);
}
