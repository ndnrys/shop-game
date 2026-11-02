import commonJa from "../data/locales/ja.js";
import { createI18n } from "../systems/i18n.js";
import { createGameState } from "../state/gameState.js";
import { createGame } from "./game.js";

const commonLocales = { ja: commonJa };

// Only this composition layer knows how shared UI copy and skin data fit together.
export function createSession(skin, state = createGameState(skin)) {
  const dictionaries = {};
  for (const [locale, messages] of Object.entries(skin.locales)) {
    if (!commonLocales[locale]) throw new Error(`Missing shared locale: ${locale}`);
    const required = ["app.title", "app.homeLabel", "app.brand", "app.storeName", "warehouse.eyebrow", "stocking.eyebrow", "money.amount", "warehouse.selectedMeta"];
    for (const item of Object.values(skin.itemDefinitions)) {
      required.push(`items.${item.id}`, `items.short.${item.id}`, `categories.${item.categoryKey}`, `materials.${item.materialKey}`);
      if (!skin.presentation[item.id]?.glyph && !skin.presentation[item.id]?.imageUrl) throw new Error(`Missing item presentation: ${item.id}`);
    }
    for (const key of required) {
      if (!messages[key]) throw new Error(`Missing skin translation: ${locale}.${key}`);
    }
    dictionaries[locale] = { ...commonLocales[locale], ...messages };
  }
  const i18n = createI18n(dictionaries);
  return createGame(state, skin, i18n);
}
