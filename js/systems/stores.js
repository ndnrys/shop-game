export function createStoreSystem({ canPlace, findOpenPosition }) {
  function putOnDisplay({ warehouse, shop }, instanceId, x, y) {
    const index = warehouse.items.findIndex((item) => item.instanceId === instanceId);
    if (index < 0) return { ok: false, reason: "stocking.itemMissing" };
    const item = warehouse.items[index];
    if (!canPlace(shop.displayedItems, item.itemId, x, y, item.rotated, shop.columns, shop.rows)) {
      return { ok: false, reason: "stocking.shelfPositionInvalid" };
    }
    const sourcePosition = { x: item.x, y: item.y };
    const [stockItem] = warehouse.items.splice(index, 1);
    shop.displayedItems.push({ ...stockItem, x, y, sourcePosition });
    return { ok: true };
  }

  function storeFromDisplay({ warehouse, shop }, instanceId) {
    const index = shop.displayedItems.findIndex((item) => item.instanceId === instanceId);
    if (index < 0) return { ok: false, reason: "stocking.displayItemMissing" };
    const item = shop.displayedItems[index];
    const preferred = item.sourcePosition ?? { x: 0, y: 0 };
    const position = findOpenPosition(
      warehouse.items,
      item,
      preferred.x,
      preferred.y,
      warehouse.columns,
      warehouse.rows,
    );
    if (!position) return { ok: false, reason: "stocking.warehouseFull" };

    shop.displayedItems.splice(index, 1);
    const { sourcePosition, ...storedItem } = item;
    warehouse.items.push({ ...storedItem, ...position });
    return { ok: true };
  }

  return { putOnDisplay, storeFromDisplay };
}
