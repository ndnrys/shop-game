import { itemDefinitions, startingInventory } from "./catalog.js";
import ja from "./ja.js";
import campaign from "./campaign.js";

export default {
  id: "fantasy",
  contentVersion: 1,
  campaign,
  itemDefinitions,
  stylesheet: new URL("../../../../css/skins/fantasy.css", import.meta.url).href,
  presentation: Object.fromEntries(Object.keys(itemDefinitions).map(id => [id, {
    imageUrl: new URL(`../../../../assets/skins/fantasy/items/${id}.svg`, import.meta.url).href,
  }])),
  locales: { ja },
  initialState: {
    warehouse: { columns: 8, rows: 8, items: startingInventory },
    shop: { columns: 5, rows: 5, displayedItems: [] },
  },
  theme: { "--green": "#59694a", "--green-dark": "#374a35", "--cream": "#d9c49a", "--paper": "#ebd8ae", "--ink": "#3e3028", "--muted": "#746046", "--line": "#b79a6c", "--gold": "#a77c35" },
};
