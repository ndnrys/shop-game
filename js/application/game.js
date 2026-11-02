import { createCampaignActions } from "./campaign.js";
import { createInventorySystem } from "../systems/inventory.js";
import { createStoreSystem } from "../systems/stores.js";

// Coordinates systems and successful-change notifications without depending on a UI.
// This is also the integration point for future saving; previews never pass here.
export function createGame(state, skin, i18n) {
  if (state.skinId !== skin.id || state.contentVersion !== skin.contentVersion) {
    throw new Error("Game state and skin content do not match");
  }
  const inventory = createInventorySystem(skin.itemDefinitions);
  const { moveItem, rotateItem } = inventory;
  const { putOnDisplay, storeFromDisplay } = createStoreSystem(inventory);
  const listeners = new Set();
  let warehouseUndo = null;

  function commit(result) {
    if (result.ok) for (const listener of listeners) listener();
    return result;
  }

  function moveWarehouse(instanceId, x, y) {
    const { items, columns, rows } = state.warehouse;
    const previous = structuredClone(items);
    const result = moveItem(items, instanceId, x, y, columns, rows);
    if (result.ok) warehouseUndo = previous;
    return commit(result);
  }

  function rotateWarehouse(instanceId) {
    const { items, columns, rows } = state.warehouse;
    const result = rotateItem(items, instanceId, columns, rows);
    if (result.ok) warehouseUndo = null;
    return commit(result);
  }

  function transfer(operation, instanceId, ...position) {
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
        if (!warehouseUndo) return { ok: false };
        state.warehouse.items = warehouseUndo;
        warehouseUndo = null;
        return commit({ ok: true });
      },
    },
    stocking: {
      put: (instanceId, x, y) => transfer(putOnDisplay, instanceId, x, y),
      return: (instanceId) => transfer(storeFromDisplay, instanceId),
      move(instanceId, x, y) {
        const { displayedItems, columns, rows } = state.shop;
        return commit(moveItem(displayedItems, instanceId, x, y, columns, rows));
      },
      rotate(instanceId) {
        const { displayedItems, columns, rows } = state.shop;
        return commit(rotateItem(displayedItems, instanceId, columns, rows));
      },
    },
  };
}
