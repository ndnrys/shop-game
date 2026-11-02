import skin from "../../js/data/skins/fantasy/index.js";
import { createSession } from "../../js/application/createSession.js";
import { createGameState as createState } from "../../js/state/gameState.js";
import { createInventorySystem } from "../../js/systems/inventory.js";
import { createStoreSystem } from "../../js/systems/stores.js";

export { skin };
export const createGameState = () => createState(skin);
export const createGame = (state) => createSession(skin, state);
export const inventory = createInventorySystem(skin.itemDefinitions);
export const stores = createStoreSystem(inventory);
export const { itemDefinitions } = skin;
export const startingInventory = skin.initialState.warehouse.items;
export const ja = skin.locales.ja;
