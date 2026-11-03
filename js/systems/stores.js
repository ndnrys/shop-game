import { fixtureDefinitions, initializeShop } from "../data/shopFixtures.js";
export { initializeShop };
export function fixtureBonus(shop, shelfId) {
  const shelf = shop.fixtures?.find(f => f.id === shelfId);
  if (!shelf) return 0;
  return fixtureDefinitions[shelf.type].bonus + shop.fixtures.filter(f => Math.abs(f.x-shelf.x)+Math.abs(f.y-shelf.y) === 1).reduce((sum,f) => sum + fixtureDefinitions[f.type].adjacentBonus, 0);
}
export function createStoreSystem({ findOpenPosition }) {
  const fail = reason => ({ ok:false, reason });
  function placeFixture(state, type, x, y, id = null) {
    initializeShop(state.shop);
    const shop = state.shop;
    if (!fixtureDefinitions[type] || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= shop.columns || y >= shop.rows || shop.fixtures.some(f => f.id !== id && f.x === x && f.y === y)) return fail("stocking.shelfPositionInvalid");
    if (id) {
      const fixture = shop.fixtures.find(f => f.id === id);
      if (!fixture) return fail("stocking.shelfPositionInvalid");
      Object.assign(fixture, { x, y });
    } else {
      let serial = 1;
      while (shop.fixtures.some(f => f.id === `fixture-${serial}`)) serial++;
      shop.fixtures.push({ id:`fixture-${serial}`, type, x, y });
    }
    return { ok:true };
  }
  function replenish({warehouse, shop}, instanceId, shelfId, quantity = 1) {
    const shelf = shop.fixtures.find(f => f.id === shelfId);
    const source = warehouse.items.find(i => i.instanceId === instanceId);
    if (!source) return fail("stocking.itemMissing");
    if (!shelf || !Number.isSafeInteger(quantity) || quantity < 1) return fail("shelves.invalidQuantity");
    const matching = warehouse.items.filter(i => i.itemId === source.itemId && Boolean(i.used) === Boolean(source.used) && i.material === source.material && i.rarity === source.rarity).sort((a,b) => Number(b === source)-Number(a === source));
    if (quantity > matching.length || shop.displayedItems.filter(i => i.shelfId === shelfId).length + quantity > fixtureDefinitions[shelf.type].capacity) return fail("shelves.capacityError");
    const ids = new Set(matching.slice(0, quantity).map(i => i.instanceId));
    warehouse.items = warehouse.items.filter(i => !ids.has(i.instanceId));
    shop.displayedItems.push(...matching.slice(0,quantity).map(i => ({...i, shelfId, sourcePosition:{x:i.x,y:i.y}})));
    return {ok:true};
  }
  function putOnDisplay(state, instanceId, x, y) {
    if (!state.warehouse.items.some(i => i.instanceId === instanceId)) return fail("stocking.itemMissing");
    initializeShop(state.shop);
    let shelf = state.shop.fixtures.find(f => f.x === x && f.y === y);
    if (!shelf) {
      const result = placeFixture(state, "normal", x, y);
      if (!result.ok) return result;
      shelf = state.shop.fixtures.at(-1);
    }
    return replenish(state, instanceId, shelf.id);
  }
  function storeFromDisplay({warehouse, shop}, instanceId) {
    const item = shop.displayedItems.find(i => i.instanceId === instanceId);
    if (!item) return fail("stocking.displayItemMissing");
    const preferred = item.sourcePosition ?? item;
    const position = findOpenPosition(warehouse.items,item,preferred.x,preferred.y,warehouse.columns,warehouse.rows);
    if (!position) return fail("stocking.warehouseFull");
    shop.displayedItems.splice(shop.displayedItems.indexOf(item),1);
    const {shelfId,sourcePosition,...stored} = item;
    warehouse.items.push({...stored,...position});
    return {ok:true};
  }
  return {putOnDisplay,storeFromDisplay,replenish,placeFixture};
}
