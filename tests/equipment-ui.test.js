import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { mountCampaign } from '../js/ui/campaign.js';
import { makeSave, validateSave } from '../js/systems/save.js';

const fixture = document.querySelector('#fixture');
const result = document.querySelector('#result');
let game, view, root, unsubscribe, passed = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const get = selector => { const node = root.querySelector(selector); assert(node, selector); return node; };
const snapshot = () => JSON.stringify(game.state);
function reset(screen = 'adventurers') {
  view?.destroy(); unsubscribe?.();
  game = createSession(skin);
  root = document.createElement('section'); root.dataset.screen = screen; root.className = 'campaign-view';
  fixture.replaceChildren(root);
  view = mountCampaign(root, game); unsubscribe = game.subscribe(view.render);
  // Synthetic Pointer Events do not have a native active pointer to capture.
  root.setPointerCapture = () => {}; root.hasPointerCapture = () => false;
}
function choose(item, slot) { get(`[data-equip-item="${item}"]`).click(); get(`[data-equip-slot="${slot}"]`).click(); }
function submit(funds = 0) { const form = get('form[data-hero]'); form.elements.funds.value = funds; form.requestSubmit(); }
function event(type, point, pointerType = 'mouse') {
  root.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 17, isPrimary: true, pointerType, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: point.x, clientY: point.y }));
}
function drag(item, slot, pointerType = 'mouse', end = 'pointerup') {
  const handle = get(`[data-equip-drag="${item}"]`); handle.scrollIntoView({ block: 'center' });
  const a = handle.getBoundingClientRect();
  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, pointerId:17, isPrimary:true, pointerType, button:0, clientX:a.x+a.width/2, clientY:a.y+a.height/2 }));
  const target = get(`[data-equip-slot="${slot}"]`); target.scrollIntoView({ block:'center' });
  const b = target.getBoundingClientRect(); const point = { x:b.x+b.width/2, y:b.y+b.height/2 };
  event('pointermove', point, pointerType);
  assert(document.querySelector('.gear-drag-preview'), 'drag preview appears');
  event(end, point, pointerType);
  assert(!document.querySelector('.gear-drag-preview'), 'drag preview removed');
}
async function check(name, fn) {
  reset(); await fn(); passed++;
  const row = document.createElement('li'); row.textContent = 'PASS ' + name; document.querySelector('#checks').append(row);
}
try {
  await check('four slots, no dropdown; tap choices are temporary and commit with funds', () => {
    assert(root.querySelectorAll('[data-equip-slot]').length === 4, 'four slots');
    assert(!root.querySelector('select'), 'no dropdown');
    const before = snapshot(); let notices = 0; const stop = game.subscribe(() => notices++);
    for (const [id, slot] of [['stock-001','weapon'],['stock-003','offhand'],['stock-006','body'],['stock-007','accessory']]) choose(id, slot);
    assert(snapshot() === before && notices === 0, 'draft does not save');
    assert(root.querySelectorAll('.gear-slot.is-pending').length === 4, 'four pending slots');
    submit(30); stop();
    const hero = game.state.campaign.heroes[0];
    assert(Object.keys(hero.equipment).length === 4 && hero.funds === 30 && notices === 1, 'one atomic commit');
    assert(!root.querySelector('.gear-slot.is-pending'), 'draft cleared after commit');
    assert(JSON.stringify(validateSave(makeSave(game.state),skin)) === snapshot(), 'save round trip');
  });
  await check('replacement and removal preserve used prices and untouched slots', () => {
    choose('stock-001','weapon'); choose('stock-003','offhand'); submit();
    choose('stock-009','weapon'); submit();
    const sword = game.state.warehouse.items.find(item => item.instanceId === 'stock-001');
    assert(sword.used && game.price(sword) === 50, 'old sword returned at half price');
    get('[data-equip-remove="weapon"]').click(); submit();
    const hero = game.state.campaign.heroes[0];
    assert(!hero.equipment.weapon && hero.equipment.offhand, 'only requested slot removed');
  });
  for (const pointerType of ['mouse','touch']) {
    await check(pointerType + ' pointer drag stages and commits matching equipment', () => {
      const before = snapshot(); drag('stock-001','weapon',pointerType);
      assert(snapshot() === before && get('.gear-slot.is-pending'), 'drag is a draft');
      submit(); assert(game.state.campaign.heroes[0].equipment.weapon.instanceId === 'stock-001', 'drag committed');
    });
    await check(pointerType + ' wrong slot and cancellation preserve state', () => {
      const before = snapshot(); drag('stock-001','offhand',pointerType);
      assert(!root.querySelector('.gear-slot.is-pending') && snapshot() === before, 'wrong slot rejected');
      assert(get('.gear-selection').textContent.includes('部位'), 'wrong-slot explanation');
      drag('stock-001','weapon',pointerType,'pointercancel');
      assert(!root.querySelector('.gear-slot.is-pending') && snapshot() === before, 'cancelled drag unchanged');
    });
  }
  await check('outside drop, lost capture and destroy remove transient drag state', () => {
    const before = snapshot(); const handle = get('[data-equip-drag="stock-001"]');
    const start = () => handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:17,isPrimary:true,button:0,clientX:10,clientY:10}));
    start(); event('pointermove',{x:1,y:1}); event('pointerup',{x:1,y:1});
    assert(!root.querySelector('.gear-slot.is-pending') && snapshot() === before,'outside drop ignored');
    start(); event('pointermove',{x:1,y:1}); event('lostpointercapture',{x:1,y:1});
    assert(!document.querySelector('.gear-drag-preview'),'capture loss cleaned');
    start(); event('pointermove',{x:1,y:1}); view.destroy();
    assert(!document.querySelector('.gear-drag-preview'),'destroy cleaned');
    get('[data-equip-item="stock-001"]').click(); assert(snapshot() === before,'destroyed handlers inactive');
  });
  await check('wrong-slot tap, discard, hero switch, and invalidated inventory never save drafts', () => {
    const before = snapshot(); choose('stock-001','offhand');
    assert(!root.querySelector('.gear-slot.is-pending') && snapshot() === before,'wrong tap refused');
    choose('stock-001','weapon'); get('[data-equip-remove="weapon"]').click();
    assert(!root.querySelector('.gear-slot.is-pending') && snapshot() === before,'remove uncommitted gear cancels that draft');
    choose('stock-001','weapon'); get('[data-equip-reset]').click();
    assert(!root.querySelector('.gear-slot.is-pending') && snapshot() === before,'discard temporary');
    choose('stock-001','weapon'); get('[data-select-hero="bran"]').click();
    assert(!root.querySelector('.gear-slot.is-pending'),'hero switch resets');
    choose('stock-001','weapon'); game.stocking.put('stock-001',0,0);
    assert(!root.querySelector('.gear-slot.is-pending'),'external inventory change resets draft');
  });
  await check('full warehouse refuses entire support, preserves undo and leaves draft for correction', () => {
    game.campaign.support('lina','stock-009',30); game.warehouse.move('stock-004',7,7);
    const items = game.state.warehouse.items;
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(game.inventory.canPlace(items,'crystal',x,y,0,8,8))items.push({instanceId:`fill-${x}-${y}`,itemId:'crystal',x,y,rotated:0});
    view.render(); const before = snapshot(); choose('stock-001','weapon'); submit(25);
    assert(snapshot() === before && game.warehouse.canUndo(),'entire state and undo unchanged');
    assert(root.querySelector('.gear-slot.is-pending'),'draft retained after rejection');
    assert(get('.mvp-status').classList.contains('is-error'),'error shown');
  });
  await check('locks and support screen share the editor; English copy and layout fit', () => {
    game.campaign.support('lina','stock-001',30); game.campaign.dispatch();
    assert([...root.querySelectorAll('[data-equipment-editor] button')].every(node => node.disabled),'away locked');
    reset('support'); assert(root.querySelectorAll('[data-equip-slot]').length === 4,'same support editor');
    game.i18n.setLocale('en'); view.render();
    assert(get('.gear-editor-hint').textContent.includes('Select warehouse equipment'),'English hint');
    assert(document.documentElement.scrollWidth <= innerWidth,'no horizontal overflow');
  });
  result.textContent = `PASS ${passed}/${passed}`;
} catch (error) { result.textContent = `FAIL after ${passed}: ${error.message}`; console.error(error); }
