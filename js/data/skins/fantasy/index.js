import { itemDefinitions, startingInventory } from "./catalog.js";
import ja from "./ja.js";
import campaign from "./campaign.js";

export default {
  id: "fantasy",
  contentVersion: 1,
  campaign,
  itemDefinitions,
  presentation: {
  "iron_axe": {
    "glyph": "🪓"
  },
  "iron_sword": {
    "glyph": "⚔"
  },
  "potion": {
    "glyph": "⚗"
  },
  "oak_shield": {
    "glyph": "◈"
  },
  "crystal": {
    "glyph": "✦"
  },
  "herb_bundle": {
    "glyph": "❋"
  },
  "leather_armor": {
    "glyph": "⬟"
  },
  "silver_ring": {
    "glyph": "◯"
  },
  "bread": {
    "glyph": "◒"
  }
},
  locales: { ja },
  initialState: {
    warehouse: { columns: 8, rows: 8, items: startingInventory },
    shop: { columns: 5, rows: 5, displayedItems: [] },
  },
  theme: { "--green": "#526b4c", "--green-dark": "#3e563d", "--cream": "#f4efe3", "--paper": "#fffdf7", "--ink": "#2d352d" },
};
