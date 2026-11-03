import { itemDefinitions, startingInventory } from "./catalog.js";
import en from "./en.js";
import ja from "./ja.js";
import campaign from "./campaign.js";
import { itemArtwork } from "./artwork.js";

export default {
  id: "fantasy",
  contentVersion: 1,
  campaign,
  itemDefinitions,
  stylesheet: new URL("../../../../css/skins/fantasy.css?v=single-item-draw", import.meta.url).href,
  presentation: itemArtwork,
  locales: { ja, en },
  initialState: {
    warehouse: { columns: 8, rows: 8, items: startingInventory },
    shop: { columns: 5, rows: 5, displayedItems: [] },
  },
  theme: { "--green": "#597d55", "--green-dark": "#36564b", "--cream": "#d5d7bd", "--paper": "#e5e7d0", "--ink": "#343d3d", "--muted": "#66775c", "--line": "#a5b196", "--gold": "#a48d53" },
};
