import { itemPrice } from "../systems/pricing.js";
import { createCampaignActions } from "./campaign.js";
import { createInventorySystem } from "../systems/inventory.js";
import { createStoreSystem, initializeShop } from "../systems/stores.js";

// Coordinates systems and successful-change notifications without depending on a UI.
// This is also the integration point for future saving; previews never pass here.
export function createGame(state, skin, i18n) {
  if (state.skinId !== skin.id || state.contentVersion !== skin.contentVersion) {
    throw new Error("Game state and skin content do not match");
  }
  initializeShop(state.shop);
  const inventory = createInventorySystem(skin.itemDefinitions);
  const { moveItem, rotateItem } = inventory;
  const { putOnDisplay, storeFromDisplay, replenish, placeFixture } = createStoreSystem(inventory);
  const listeners = new Set();
  let warehouseUndo = null;

  function commit(result) {
    if (result.ok) for (const listener of listeners) listener();
    return result;
  }

  const editable = () => state.campaign?.region !== "next-town";
  const locked = () => ({ ok: false, reason: "mvp.error.departure" });

  function moveWarehouse(instanceId, x, y) {
    if (!editable()) return locked();
    const { items, columns, rows } = state.warehouse;
    const previous = structuredClone(items);
    const result = moveItem(items, instanceId, x, y, columns, rows);
    if (result.ok) warehouseUndo = previous;
    return commit(result);
  }

  function rotateWarehouse(instanceId) {
    if (!editable()) return locked();
    const { items, columns, rows } = state.warehouse;
    const result = rotateItem(items, instanceId, columns, rows);
    if (result.ok) warehouseUndo = null;
    return commit(result);
  }

  function transfer(operation, instanceId, ...position) {
    if (!editable()) return locked();
    const result = operation(state, instanceId, ...position);
    // A warehouse snapshot must never resurrect inventory moved to the shelf.
    if (result.ok) warehouseUndo = null;
    return commit(result);
  }

  return {
    state,
    itemDefinitions: skin.itemDefinitions,
    presentation: skin.presentation,
    inventory,
    price: item => itemPrice(skin.itemDefinitions[item.itemId], item, skin.campaign?.usedPriceRate),
    i18n,
    campaign: skin.campaign ? createCampaignActions(state, skin.campaign, skin.itemDefinitions, inventory, result => {
      if (result.ok) warehouseUndo = null;
      return commit(result);
    }) : null,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    warehouse: {
      move: moveWarehouse,
      rotate: rotateWarehouse,
      canUndo: () => warehouseUndo !== null,
      undo() {
        if (!editable()) return locked();
        if (!warehouseUndo) return { ok: false };
        state.warehouse.items = warehouseUndo;
        warehouseUndo = null;
        return commit({ ok: true });
      },
    },
    stocking: {
      replenish: (id, shelf, quantity) => transfer(replenish, id, shelf, quantity),
      placeFixture: (type, x, y, id) => transfer(placeFixture, type, x, y, id),
      put: (instanceId, x, y) => transfer(putOnDisplay, instanceId, x, y),
      return: (instanceId) => transfer(storeFromDisplay, instanceId),

    },
  };
}
