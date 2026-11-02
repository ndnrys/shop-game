import test from "node:test";
import assert from "node:assert/strict";
import fantasy from "../js/data/skins/fantasy/index.js";
import { createSession } from "../js/application/createSession.js";
import { createI18n } from "../js/systems/i18n.js";

import { petFixture } from "./fixtures/pet.js";

test("unrelated product IDs use the same move, rotation, undo and transfer systems", () => {
  const game = createSession(petFixture());
  assert.equal(game.warehouse.move("treat-1", 1, 1).ok, true);
  assert.equal(game.warehouse.move("treat-1", 0, 1).ok, false);
  assert.equal(game.warehouse.undo().ok, true);
  assert.equal(game.warehouse.rotate("brush-1").ok, true);
  assert.equal(game.stocking.put("brush-1", 0, 0).ok, true);
  assert.equal(game.stocking.put("treat-1", 0, 1).ok, true);
  assert.equal(game.stocking.return("treat-1").ok, true);
  assert.equal(game.i18n.itemName("pet_brush"), "ペットブラシ");
  assert.equal(game.i18n.t("money.amount", { amount: 100 }), "100 円");
});

test("cosmetic changes do not alter prices, shapes, stock or operation results", () => {
  const skin = structuredClone(fantasy);
  skin.id = "test-reskin";
  skin.presentation.iron_axe.glyph = "🪮";
  skin.locales.ja['items.iron_axe'] = "ブラシ";
  skin.locales.ja['money.amount'] = "{amount} 円";
  const first = createSession(fantasy);
  const second = createSession(skin);
  for (const game of [first, second]) {
    game.warehouse.move('stock-004', 7, 5);
    game.warehouse.rotate('stock-009');
    game.stocking.put('stock-004', 0, 0);
  }
  assert.deepEqual(first.state.warehouse, second.state.warehouse);
  assert.deepEqual(first.state.shop, second.state.shop);
  assert.deepEqual(first.itemDefinitions, second.itemDefinitions);
  assert.notEqual(first.i18n.itemName('iron_axe'), second.i18n.itemName('iron_axe'));
});

test("simultaneous skins keep translation and catalog instances independent", () => {
  const first = createSession(fantasy);
  const second = createSession(petFixture());
  assert.equal(first.i18n.itemName('iron_axe'), '鉄の斧');
  assert.equal(second.i18n.itemName('pet_brush'), 'ペットブラシ');
  assert.equal(first.inventory.canPlace([], 'pet_brush', 0, 0, false, 8, 8), false);
  assert.equal(second.inventory.canPlace([], 'iron_axe', 0, 0, false, 8, 8), false);
});

test("state from a different skin or content version is rejected", () => {
  const state = createSession(fantasy).state;
  assert.throws(() => createSession(petFixture(), state), /do not match/);
  assert.throws(() => createSession({ ...fantasy, contentVersion: 2 }, state), /do not match/);
});

test("missing item labels or presentation are rejected rather than hidden by fallback", () => {
  const skin = petFixture();
  delete skin.locales.ja['items.pet_brush'];
  assert.throws(() => createSession(skin), /Missing skin translation/);
  const missingGlyph = petFixture();
  delete missingGlyph.presentation.pet_brush;
  assert.throws(() => createSession(missingGlyph), /Missing item presentation/);
  assert.throws(() => createI18n({ ja: { key: 'test' }, en: {} }), /Missing translation/);
});
