import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, createGame, itemDefinitions, stores, ja } from "./fixtures/fantasy.js";
const { putOnDisplay } = stores;

const crystalId = "stock-004";

test("independent game states contain no UI selection or undo snapshots", () => {
  const first = createGameState();
  const second = createGameState();
  first.warehouse.items.pop();
  assert.equal(second.warehouse.items.length, first.warehouse.items.length + 1);
  assert.equal('selectedInstanceId' in first, false);
  assert.equal('selectedInstanceId' in first.shop, false);
  assert.equal('undoSnapshot' in first, false);
  assert.deepEqual(JSON.parse(JSON.stringify(second)), second);
});

test("only successful commits notify; unsubscribing detaches a consumer", () => {
  const game = createGame(createGameState());
  let notifications = 0;
  const unsubscribe = game.subscribe(() => { notifications += 1; });
  assert.equal(game.warehouse.move(crystalId, 7, 7).ok, true);
  assert.equal(game.warehouse.move(crystalId, -1, 0).ok, false);
  assert.equal(notifications, 1);
  unsubscribe();
  game.warehouse.undo();
  assert.equal(notifications, 1);
});

test("a failed operation preserves undo; undo restores the previous placement", () => {
  const game = createGame(createGameState());
  const initial = structuredClone(game.state);
  game.warehouse.move(crystalId, 7, 7);
  game.warehouse.move(crystalId, 0, 0);
  assert.equal(game.warehouse.canUndo(), true);
  assert.equal(game.warehouse.undo().ok, true);
  assert.deepEqual(game.state, initial);
  assert.equal(game.warehouse.canUndo(), false);
});

test("transferring to shelf invalidates warehouse undo and cannot duplicate items", () => {
  const game = createGame(createGameState());
  game.warehouse.move(crystalId, 7, 7);
  assert.equal(game.stocking.put(crystalId, 0, 0).ok, true);
  assert.equal(game.warehouse.canUndo(), false);
  assert.equal(game.warehouse.undo().ok, false);
  assert.equal(game.state.warehouse.items.some(item => item.instanceId === crystalId), false);
  assert.equal(game.state.shop.displayedItems.length, 1);
  assert.equal(game.stocking.return(crystalId).ok, true);
  assert.equal(game.state.warehouse.items.filter(item => item.instanceId === crystalId).length, 1);
});

test("failed transfer preserves game data and undo", () => {
  const game = createGame(createGameState());
  game.warehouse.move(crystalId, 7, 7);
  const before = structuredClone(game.state);
  assert.equal(game.stocking.put(crystalId, 5, 5).ok, false);
  assert.deepEqual(game.state, before);
  assert.equal(game.warehouse.canUndo(), true);
});

test("systems do not alter UI-owned properties even if supplied by a caller", () => {
  const state = createGameState();
  state.selectedInstanceId = crystalId;
  state.undoSnapshot = ['ui-owned'];
  assert.equal(putOnDisplay(state, crystalId, 0, 0).ok, true);
  assert.equal(state.selectedInstanceId, crystalId);
  assert.deepEqual(state.undoSnapshot, ['ui-owned']);
});

test("locale selection works without DOM and observers can unsubscribe", () => {
  const { setLocale, onLocaleChange, itemName } = createGame().i18n;
  let changes = 0;
  const unsubscribe = onLocaleChange(() => { changes += 1; });
  assert.equal(setLocale('unsupported'), false);
  assert.equal(setLocale('ja'), true);
  assert.equal(itemName('iron_axe'), '鉄の斧');
  unsubscribe();
  setLocale('ja');
  assert.equal(changes, 1);
});

test("item display names, categories and materials are defined in locale data", () => {
  for (const item of Object.values(itemDefinitions)) {
    for (const key of [`items.${item.id}`, `items.short.${item.id}`, `categories.${item.categoryKey}`, `materials.${item.materialKey}`]) assert.ok(ja[key], key);
    assert.equal('name' in item, false);
    assert.equal('material' in item, false);
  }
});

test("UI modules can be imported without a document before mounting", async () => {
  const { mountWarehouse } = await import('../js/ui/warehouse.js');
  const { mountStocking } = await import('../js/ui/stocking.js');
  const { mountScreens } = await import('../js/ui/app.js');
  assert.equal(typeof mountWarehouse, 'function');
  assert.equal(typeof mountStocking, 'function');
  assert.equal(typeof mountScreens, 'function');
});
