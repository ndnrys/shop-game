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
  theme: { "--green": "#a5b894", "--green-dark": "#d4c39b", "--cream": "#10191e", "--paper": "#18252b", "--ink": "#e4e5db", "--muted": "#9eafad", "--line": "#2c3d42", "--gold": "#d6b97e" },
};
