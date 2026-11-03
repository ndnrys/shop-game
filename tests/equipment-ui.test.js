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
function reset(screen = 'adventurers', testSkin = skin) {
  view?.destroy(); unsubscribe?.();
  game = createSession(testSkin);
  root = document.createElement('section'); root.dataset.screen = screen; root.className = 'campaign-view';
  fixture.replaceChildren(root);
  view = mountCampaign(root, game); unsubscribe = game.subscribe(view.render);
  // Synthetic Pointer Events do not have a native active pointer to capture.
  root.setPointerCapture = () => {}; root.hasPointerCapture = () => false;
}
function choose(item, slot) { get(`[data-equip-item="${item}"]`).click(); get(`[data-equip-slot="${slot}"]`).click(); }
function setFunds(form, amount) {
  const reset = form.querySelector('[data-funds-reset]'); if (!reset.disabled) reset.click();
  for (const increment of [1000,100,10]) while (amount >= increment) {
    const button = form.querySelector(`[data-funds-add="${increment}"]`); assert(!button.disabled,'funds button available'); button.click(); amount -= increment;
  }
  assert(amount === 0,'funds use multiples of ten');
}
function submit(funds = 0) { get('form[data-hero]').requestSubmit(); if (funds) { const form = get('form[data-party-funds]'); setFunds(form,funds); form.requestSubmit(); } }
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
  await check('four slots, no dropdown; tap equipment choices and party funds are confirmed separately', () => {
    assert(root.querySelectorAll('[data-equip-slot]').length === 4, 'four slots');
    assert(!root.querySelector('select'), 'no dropdown');
    const before = snapshot(); let notices = 0; const stop = game.subscribe(() => notices++);
    for (const [id, slot] of [['stock-001','weapon'],['stock-003','offhand'],['stock-006','body'],['stock-007','accessory']]) choose(id, slot);
    assert(snapshot() === before && notices === 0, 'draft does not save');
    assert(root.querySelectorAll('.gear-slot.is-pending').length === 4, 'four pending slots');
    submit(30); stop();
    const hero = game.state.campaign.heroes[0];
    assert(Object.keys(hero.equipment).length === 4 && game.state.campaign.parties[0].funds === 30 && notices === 2, 'separate equipment and party commits');
    assert(!root.querySelector('.gear-slot.is-pending'), 'draft cleared after commit');
    assert(JSON.stringify(validateSave(makeSave(game.state),skin)) === snapshot(), 'save round trip');
  });
  await check('funds buttons count repeated presses, preserve drafts, enforce budget and clear after confirmation', () => {
    game.state.campaign.gold = 3000; view.render();
    const before = snapshot(); const form = get('form[data-party-funds]');
    assert(!form.querySelector('input[type=number]'),'no numeric funds input');
    for (const value of [10,10,10,100,100,1000,1000]) get(`[data-funds-add="${value}"]`).click();
    assert(form.elements.funds.value === '2230','each click adds its denomination');
    assert(get('[data-funds-total]').textContent.includes('2230'),'visible running total');
    choose('stock-001','weapon'); assert(form.elements.funds.value === '2230','equipment selection preserves funds');
    assert(snapshot() === before,'funds draft does not save');
    get('[data-select-hero="bran"]').click(); assert(get('form[data-party-funds]').elements.funds.value === '2230','party funds independent of character');
    get('[data-select-hero="lina"]').click(); assert(get('form[data-party-funds]').elements.funds.value === '2230','return retains amount');
    get('form[data-party-funds]').requestSubmit();
    assert(game.state.campaign.parties[0].funds === 2230 && game.state.campaign.gold === 770,'funds committed once');
    assert(get('form[data-party-funds]').elements.funds.value === '0','counter resets on success');
    assert(get('[data-funds-add="1000"]').disabled,'over-budget increment disabled');
    get('[data-funds-add="100"]').click(); get('[data-funds-reset]').click();
    assert(get('form[data-party-funds]').elements.funds.value === '0','clear resets planned amount');
    assert(game.state.campaign.gold === 770,'clear does not spend money');
  });
  await check('plus adds up to three party frames and keeps their funds separate', () => {
    assert(root.querySelectorAll('.party-frame').length === 1,'one initial party');
    get('[data-create-party]').click(); get('[data-create-party]').click();
    assert(root.querySelectorAll('.party-frame').length === 3 && get('[data-create-party]').disabled,'three-party limit');
    assert(document.documentElement.scrollWidth <= innerWidth,'three parties fit Japanese layout');
    game.i18n.setLocale('en');view.render();assert(document.documentElement.scrollWidth <= innerWidth,'three parties fit English layout');
    game.i18n.setLocale('ja');view.render();
    for(const [partyId,amount] of [['party-1',30],['party-2',100]]) {
      const form=get(`[data-party-funds="${partyId}"]`);setFunds(form,amount);form.requestSubmit();
    }
    assert(game.state.campaign.parties.map(p=>p.funds).join() === '30,100,0','separate confirmed funds');
    assert(!root.querySelector('form[data-hero] [data-funds-add]'),'no personal funds controls');
    assert(JSON.stringify(validateSave(makeSave(game.state),skin)) === snapshot(),'multiple parties save round trip');
  });
  for(const pointerType of ['mouse','touch']) {
    await check(pointerType + ' character drag moves between parties; cancellation and outside drop do not change state', () => {
      get('[data-create-party]').click();
      function dragMember(end='pointerup',outside=false) {
        const handle=get('[data-party-drag="lina"]');handle.scrollIntoView({block:'center'});const a=handle.getBoundingClientRect();
        handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:17,isPrimary:true,pointerType,button:0,clientX:a.x+a.width/2,clientY:a.y+a.height/2}));
        const target=get('[data-party-id="party-2"][data-party-slot="0"]');target.scrollIntoView({block:'center'});const b=target.getBoundingClientRect();
        const point=outside?{x:-20,y:-20}:{x:b.x+b.width/2,y:b.y+b.height/2};
        event('pointermove',point,pointerType);assert(document.querySelector('.party-drag-preview'),'character drag preview');
        event(end,point,pointerType);assert(!document.querySelector('.party-drag-preview'),'character preview cleaned');
      }
      const before=snapshot();dragMember('pointercancel');assert(snapshot()===before,'cancel unchanged');
      dragMember('pointerup',true);assert(snapshot()===before,'outside unchanged');dragMember();
      const parties=game.state.campaign.parties;
      assert(parties[0].members[0]===null && parties[1].members[0]==='lina','member moved without duplication');
      get('[data-party-pick="noa"]').click();get('[data-party-id="party-2"][data-party-slot="0"]').click();
      assert(parties[1].members[0]==='noa' && !parties[0].members.includes('noa') && !parties.some(p=>p.members.includes('lina')),'replacement leaves displaced member waiting');
    });
  }
  await check('support dispatch uses the selected party and only its shared funds', () => {
    reset('support');game.state.campaign.phase='support';view.render();
    get('[data-create-party]').click();get('[data-party-pick="lina"]').click();get('[data-party-id="party-2"][data-party-slot="0"]').click();
    choose('stock-001','weapon');submit();
    for(const [partyId,amount] of [['party-1',30],['party-2',60]]) { const form=get(`[data-party-funds="${partyId}"]`);setFunds(form,amount);form.requestSubmit(); }
    get('[data-expedition-party="party-2"]').click();get('[data-destination="outskirts"]').click();get('[data-action="dispatch"]').click();
    const c=game.state.campaign;
    assert(c.expedition.partyId==='party-2' && c.expedition.heroIds.join()==='lina' && c.expedition.funds===60,'selected party dispatched');
    assert(c.parties[0].funds===30 && c.parties[1].funds===0,'other funds preserved');
    assert(get('[data-create-party]').disabled && [...root.querySelectorAll('[data-party-slot]')].every(node=>node.disabled),'editing locked while away');
  });
  await check('job labels, equipment types and disabled candidates follow the selected adventurer',()=>{
    assert(get('.hero-job').textContent.includes('剣士'),'Lina job shown');
    assert(get('[data-equip-item="stock-009"]').disabled && get('[data-equip-drag="stock-009"]').disabled,'swordsman cannot choose or drag axe');
    assert(get('[data-equip-item="stock-001"]').textContent.includes('片手剣'),'weapon type shown');
    get('[data-select-hero="bran"]').click();assert(get('.hero-job').textContent.includes('戦士'),'Bran job shown');
    assert(!get('[data-equip-item="stock-009"]').disabled && get('[data-equip-item="stock-001"]').disabled && get('[data-equip-item="stock-006"]').disabled,'warrior permissions');
    get('[data-select-hero="noa"]').click();assert(get('.hero-job').textContent.includes('魔法使い'),'Noa job shown');
    assert(get('[data-equip-item="stock-001"]').disabled && !get('[data-equip-item="stock-006"]').disabled && !get('[data-equip-item="stock-003"]').disabled,'mage light armor and shared shield');
  });
  await check('two-handed preview rejects shield conflict and accepts a prepared shield removal',()=>{
    const custom=structuredClone(skin);custom.itemDefinitions.iron_sword.equipmentType='two_handed_sword';reset('adventurers',custom);
    choose('stock-003','offhand');submit();const before=snapshot();choose('stock-001','weapon');
    assert(get('.gear-selection').textContent.includes('両手武器') && !root.querySelector('.gear-slot.is-pending'),'conflict explained before commit');
    assert(snapshot()===before,'invalid preview does not change game');
    get('[data-equip-remove="offhand"]').click();choose('stock-001','weapon');submit();
    const hero=game.state.campaign.heroes[0];assert(hero.equipment.weapon && !hero.equipment.offhand,'weapon replaces prepared shield');
    const after=snapshot();choose('stock-003','offhand');assert(snapshot()===after && get('.gear-selection').textContent.includes('両手武器'),'shield rejected against equipped two-handed weapon');
  });
  await check('job traits show fixed totals and mage applies one bonus per equipped attribute',()=>{
    assert(get('.hero-trait').textContent.includes('HP＋1'),'swordsman trait shown');
    assert(root.textContent.includes('HP 4・攻撃 3・防御 3'),'fixed HP included once');
    get('[data-select-hero="bran"]').click();assert(root.textContent.includes('HP 3・攻撃 3・防御 4'),'warrior defense included once');
    const custom=structuredClone(skin);custom.itemDefinitions.leather_armor.attributes={fire:1};custom.itemDefinitions.silver_ring.attributes={fire:1};
    reset('adventurers',custom);get('[data-select-hero="noa"]').click();
    assert(get('.hero-attributes').textContent.includes('なし'),'no attribute without equipment');
    choose('stock-006','body');submit();assert(get('.hero-attributes').textContent.includes('炎＋2'),'one piece plus trait');
    choose('stock-007','accessory');submit();assert(get('.hero-attributes').textContent.includes('炎＋3'),'two pieces plus one trait');
  });
  await check('replacement and removal preserve used prices and untouched slots', () => {
    game.state.warehouse.items.find(item=>item.instanceId==='stock-009').itemId='steel_sword';view.render();
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
    const custom=structuredClone(skin);custom.itemDefinitions.iron_sword.equipmentType='two_handed_sword';reset('adventurers',custom);
    get('[data-select-hero="bran"]').click();game.campaign.support('bran','stock-009',30); game.warehouse.move('stock-004',7,7);
    const items = game.state.warehouse.items;
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(game.inventory.canPlace(items,'crystal',x,y,0,8,8))items.push({instanceId:`fill-${x}-${y}`,itemId:'crystal',x,y,rotated:0});
    view.render(); const before = snapshot(); choose('stock-001','weapon'); setFunds(get('form[data-party-funds]'),20); get('form[data-hero]').requestSubmit();
    assert(snapshot() === before && game.warehouse.canUndo(),'entire state and undo unchanged');
    assert(root.querySelector('.gear-slot.is-pending'),'draft retained after rejection');
    assert(get('form[data-party-funds]').elements.funds.value === '20','failed support preserves planned funds');
    assert(get('.mvp-status').classList.contains('is-error'),'error shown');
  });
  await check('locks and support screen share the editor; English copy and layout fit', () => {
    game.campaign.support('lina','stock-001',30); game.campaign.dispatch();
    assert([...root.querySelectorAll('[data-equipment-editor] button')].every(node => node.disabled),'away locked');
    assert([...root.querySelectorAll('[data-funds-add], [data-funds-reset]')].every(node => node.disabled),'funds locked while away');
    reset('support'); assert(root.querySelectorAll('[data-equip-slot]').length === 4,'same support editor');
    game.i18n.setLocale('en'); view.render();
    assert(get('.gear-editor-hint').textContent.includes('Select warehouse equipment'),'English hint');
    assert(document.documentElement.scrollWidth <= innerWidth,'no horizontal overflow');
  });
  result.textContent = `PASS ${passed}/${passed}`;
} catch (error) { result.textContent = `FAIL after ${passed}: ${error.message}`; console.error(error); }
