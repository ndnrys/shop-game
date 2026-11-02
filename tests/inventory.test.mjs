import test from "node:test";
import assert from "node:assert/strict";
import { inventory, stores, startingInventory } from "./fixtures/fantasy.js";
const { canPlace, itemCells, dimensions, rotateItem, moveItem } = inventory;
const { putOnDisplay, storeFromDisplay } = stores;

const axe = () => ({ instanceId: "axe", itemId: "iron_axe", x: 0, y: 0, rotated: false });
const crystal = (x, y) => ({ instanceId: "crystal", itemId: "crystal", x, y, rotated: false });

test("holes can hold another item, occupied blade and handle cannot", () => {
  assert.equal(itemCells(axe()).length, 4);
  assert.equal(canPlace([axe()], "crystal", 1, 1, false, 8, 8), true);
  assert.equal(canPlace([axe()], "crystal", 1, 0, false, 8, 8), false);
  assert.equal(canPlace([axe()], "crystal", 0, 2, false, 8, 8), false);
  assert.equal(canPlace([crystal(1, 1)], "iron_axe", 0, 0, false, 8, 8), true);
});

test("four clockwise rotations preserve cells and dimensions", () => {
  const item = axe();
  const initial = itemCells(item);
  const orientations = new Set();
  for (let i = 0; i < 4; i += 1) {
    orientations.add(JSON.stringify(itemCells(item)));
    assert.equal(rotateItem([item], item.instanceId, 8, 8).ok, true);
    assert.equal(itemCells(item).length, 4);
  }
  assert.equal(orientations.size, 4);
  assert.deepEqual(itemCells(item), initial);
  assert.deepEqual(dimensions(item), { width: 2, height: 3 });
  assert.deepEqual(dimensions({ itemId: "iron_sword", rotated: true }), { width: 3, height: 1 });
});

test("invalid moves and blocked rotation preserve the original position", () => {
  const item = axe();
  const items = [item, crystal(1, 1)];
  const original = structuredClone(items);
  assert.equal(moveItem(items, "axe", -1, 0, 8, 8).ok, false);
  assert.equal(moveItem(items, "axe", 7, 6, 8, 8).ok, false);
  assert.deepEqual(items, original);
  assert.equal(rotateItem(items, "axe", 2, 3).ok, false);
  assert.deepEqual(items, original);
});

test("rotation relocates near edges without collisions", () => {
  const item = { ...axe(), x: 6, y: 5 };
  assert.equal(rotateItem([item], "axe", 8, 8).ok, true);
  assert.equal(canPlace([item], item.itemId, item.x, item.y, item.rotated, 8, 8, "axe"), true);
  assert.equal(item.x, 5);
});

test("shelf placement and returning to warehouse preserve interlocking items", () => {
  const state = { warehouse: { columns: 8, rows: 8, items: [axe(), crystal(1, 1)] }, shop: { columns: 5, rows: 5, displayedItems: [] } };
  assert.equal(putOnDisplay(state, "axe", 0, 0).ok, true);
  assert.equal(putOnDisplay(state, "crystal", 1, 1).ok, true);
  assert.equal(state.shop.displayedItems.length, 2);
  assert.equal(storeFromDisplay(state, "axe").ok, true);
  assert.equal(storeFromDisplay(state, "crystal").ok, true);
  assert.equal(state.warehouse.items.length, 2);
  for (const item of state.warehouse.items) assert.equal(canPlace(state.warehouse.items, item.itemId, item.x, item.y, item.rotated, 8, 8, item.instanceId), true);
});

test("starting inventory fits without overlaps", () => {
  for (const item of startingInventory) assert.equal(canPlace(startingInventory, item.itemId, item.x, item.y, item.rotated, 8, 8, item.instanceId), true);
});
