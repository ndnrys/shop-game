import { createSession } from "../js/application/createSession.js";
import { petFixture } from "./fixtures/pet.js";
import { applyTranslations } from "../js/ui/i18n.js";
import { createGameState, createGame } from "./fixtures/fantasy.js";
import { mountScreens } from "../js/ui/app.js";
import { mountWarehouse } from "../js/ui/warehouse.js";
import { mountStocking } from "../js/ui/stocking.js";

const fixture = document.querySelector("#fixture");
const results = document.querySelector("#test-results");
const template = new DOMParser().parseFromString(await (await fetch("../index.html")).text(), "text/html").querySelector("main");
const features = [{ id: "warehouse", mount: mountWarehouse }, { id: "stocking", mount: mountStocking }];
let app;
let game;
let passed = 0;
function assert(condition, message) { if (!condition) throw new Error(message); }
function reset(enabled = features, skin = null) {
  app?.destroy();
  fixture.replaceChildren(template.cloneNode(true));
  game = skin ? createSession(skin) : createGame(createGameState());
  app = mountScreens(fixture, game, enabled);
}
function get(selector) { return fixture.querySelector(selector); }
function item(id) { return game.state.warehouse.items.find(item => item.instanceId === id); }
function select(id) { get(`#warehouse-board [data-instance-id="${id}"]`).click(); }
function clickCell(board, x, y) {
  const cell = get(`${board} .board-cell[aria-label="${x + 1}列 ${y + 1}行"]`);
  cell.scrollIntoView({ block: 'center' });
  const rect = cell.getBoundingClientRect();
  cell.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
}
async function check(name, fn) {
  await fn();
  passed += 1;
  const line = document.createElement("li");
  line.textContent = `PASS ${name}`;
  results.append(line);
}

try {
  await check("warehouse works when stocking is not registered", () => {
    reset([features[0]]);
    assert(get('#stocking-screen').hidden, 'stocking panel must be hidden');
    assert(get('a[href="#stocking"]').hidden, 'stocking navigation must be hidden');
    select('stock-004');
    clickCell('#warehouse-board', 7, 7);
    assert(item('stock-004').x === 7 && item('stock-004').y === 7, 'warehouse move');
    get('#undo-button').click();
    assert(item('stock-004').x === 6 && item('stock-004').y === 0, 'undo');
  });
  await check("stocking works when warehouse screen is not registered", () => {
    reset([features[1]]);
    get('.shelf-cell').click();
    get('.shelf-toolbar button:nth-child(2)').click();
    get('.stock-card[data-instance-id="stock-009"] button').click();
    get('.stock-card[data-instance-id="stock-004"] button').click();
    assert(game.state.shop.displayedItems.length === 2, 'shelf stock without shape constraints');
    const row=[...fixture.querySelectorAll('.shelf-stock-row')].find(r=>r.textContent.includes('魔晶石'));
    row.querySelector('button').click();
    assert(item('stock-004'), 'return to warehouse data without warehouse screen');
  });
  await check("destroy and remount does not duplicate handlers", () => {
    reset([features[0]]);
    app.destroy();
    const state = JSON.stringify(game.state);
    select('stock-004');
    clickCell('#warehouse-board', 7, 7);
    assert(JSON.stringify(game.state) === state, 'detached UI must not mutate state');
    app = mountScreens(fixture, game, [features[0]]);
    select('stock-009');
    get('#rotate-button').click();
    assert(item('stock-009').rotated === 1, 'exactly one rotation after remount');
  });
  await check("invalid placement leaves item in original position", () => {
    reset([features[0]]);
    select('stock-009');
    const before = JSON.stringify(game.state);
    clickCell('#warehouse-board', 7, 7);
    assert(JSON.stringify(game.state) === before, 'out-of-bounds placement must be rejected');
    clickCell('#warehouse-board', 1, 0);
    assert(JSON.stringify(game.state) === before, 'overlapping placement must be rejected');
  });
  await check("shape holes expose the board for hit testing", () => {
    reset([features[0]]);
    const cell = get('#warehouse-board .board-cell[aria-label="8列 6行"]');
    cell.scrollIntoView({ block: 'center' });
    const rect = cell.getBoundingClientRect();
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    assert(target === cell, 'hole must not capture pointer input');
    select('stock-004');
    clickCell('#warehouse-board', 7, 5);
    assert(item('stock-004').x === 7 && item('stock-004').y === 5, 'move into hole');
  });
  await check("different skin renders product icons, copy and prices through the same screens", () => {
    reset(features, petFixture());
    applyTranslations(fixture, game.i18n);
    assert(get('.brand').textContent === 'PET SHOP', 'skin branding');
    assert(get('[data-i18n="app.storeName"]').textContent === 'ペットグッズショップ', 'skin store name');
    assert(get('#warehouse-board [data-instance-id="brush-1"]').textContent.includes('🪮'), 'skin glyph');
    get('a[href="#stocking"]').click();
    get('.shelf-cell').click();
    get('.shelf-toolbar button:nth-child(2)').click();
    get('.stock-card[data-instance-id="brush-1"] button').click();
    assert(game.state.shop.displayedItems.length === 1, 'place product from unrelated catalog');
    assert(get('#stocking-selection').textContent.includes('ペットブラシ'), 'skin product label');
    assert(get('#stocking-selection').textContent.includes('100 円'), 'skin currency');
    get('.shelf-stock-row button').click();
    assert(game.state.warehouse.items.length === 2, 'return product');
    get('a[href="#warehouse"]').click();
  });
  await check("skin images render without changes to inventory calculations", () => {
    const skin = petFixture();
    skin.presentation.pet_brush = { imageUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" };
    reset(features, skin);
    const image = get('#warehouse-board [data-instance-id="brush-1"] img');
    assert(image && image.alt === '', 'decorative product image');
    assert(game.inventory.itemCells(game.state.warehouse.items[0]).length === 4, 'unchanged shape');
  });
  await check("hidden screens render only when opened", () => {
    app?.destroy();
    fixture.replaceChildren(template.cloneNode(true));
    game = createGame(createGameState());
    const calls = { warehouse: 0, stocking: 0 };
    app = mountScreens(fixture, game, Object.keys(calls).map(id => ({ id, mount: () => ({ render() { calls[id] += 1; }, destroy() {} }) })));
    get('a[href="#warehouse"]').click();
    const before = calls.stocking;
    game.warehouse.move('stock-004', 7, 7);
    assert(calls.stocking === before, 'hidden screen should not redraw after every operation');
    get('a[href="#stocking"]').click();
    assert(calls.stocking > before, 'opening a screen refreshes its data');
  });
  await check('PNG artwork fits the complete footprint and follows item rotation', () => {
    reset([features[0]]);
    const axe = get('[data-instance-id="stock-009"]');
    const overlay = axe.querySelector('.shape-art');
    assert(overlay && overlay.querySelector('svg.item-art image'), 'shared PNG is rendered over the footprint');
    assert(getComputedStyle(overlay).pointerEvents === 'none', 'art must not intercept holes');
    assert(overlay.getBoundingClientRect().width > axe.querySelector('.shape-cell').getBoundingClientRect().width, 'art uses more than first occupied cell');
    const initial = axe.querySelector('svg.item-art').getAttribute('viewBox').split(' ').map(Number);
    assert(game.warehouse.rotate('stock-009').ok, 'rotation succeeds');
    const rotated = get('[data-instance-id="stock-009"] svg.item-art');
    const box = rotated.getAttribute('viewBox').split(' ').map(Number);
    assert(box[2] === initial[3] && box[3] === initial[2], 'rotated image frame swaps dimensions');
    assert(rotated.querySelector('g').getAttribute('transform').includes('rotate(90)'), 'image follows placement rotation');
  });
  for (const pointerType of ['mouse', 'touch']) {
    await check(`${pointerType} pointer drag: preview, commit, invalid drop and cancellation`, async () => {
      reset([features[0]]);
      const board = get('#warehouse-board');
      // Synthetic pointers have no native capture session. Only capture is stubbed;
      // real event handlers, long-press timer, preview and game commands run normally.
      board.setPointerCapture = () => {};
      async function dragTo(x, y, cancel = false) {
        const current = item('stock-009');
        const target = board.querySelector('[data-instance-id="stock-009"] .shape-cell');
        target.scrollIntoView({ block: 'center' });
        const rect = target.getBoundingClientRect();
        const start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const boardRect = board.getBoundingClientRect();
        const end = { x: boardRect.x + (x + .5) * boardRect.width / 8, y: boardRect.y + (y + .5) * boardRect.height / 8 };
        const initial = JSON.stringify(game.state);
        function send(type, point, element = board) {
          element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: point.x, clientY: point.y }));
        }
        send('pointerdown', start, target);
        await new Promise(resolve => setTimeout(resolve, 120));
        send('pointermove', { x: start.x + 6, y: start.y });
        send('pointermove', end);
        assert(board.querySelector('.placement-preview'), 'preview must be rendered');
        assert(JSON.stringify(game.state) === initial, 'preview must not change committed state');
        send(cancel ? 'pointercancel' : 'pointerup', end);
        assert(!board.querySelector('.placement-preview'), 'preview must be cleared');
        return { initial, current };
      }
      await dragTo(6, 5);
      assert(item('stock-009').y === 5, 'valid drop commits');
      const invalid = await dragTo(8, 7);
      assert(JSON.stringify(game.state) === invalid.initial, 'invalid drop preserves original position');
      const cancelled = await dragTo(5, 5, true);
      assert(JSON.stringify(game.state) === cancelled.initial, 'cancelled drop preserves original position');
    });
  }
  app.destroy();
  document.querySelector('#test-status').textContent = `PASS ${passed}/${passed}`;
} catch (error) {
  document.querySelector('#test-status').textContent = `FAIL after ${passed} checks: ${error.message}`;
  console.error(error);
}
