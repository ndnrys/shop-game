import { equipmentItemError, equipmentLoadoutError } from "../systems/equipment.js";
import { itemArt } from './itemArt.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Temporary selection and equipment drafts belong to this mounted editor only.
export function mountEquipmentEditor(root, game) {
  const events = new AbortController();
  const { state, campaign: actions, i18n, presentation } = game;
  const config = actions.config;
  const t = (key, values) => escape(i18n.t(key, values));
  let heroId, source, locked = true, selected = null, draft = {}, message = '';
  let pointer = null;
  let scrollFrame = null;
  const win = root.ownerDocument.defaultView;
  const hero = () => state.campaign.heroes.find(entry => entry.id === heroId);
  const available = () => state.warehouse.items.filter(item => config.equipmentSlots.includes(config.itemSlots[item.itemId]));
  const find = id => available().find(item => item.instanceId === id);
  const label = item => item.used ? i18n.t('item.usedName', { name: i18n.itemName(item.itemId) }) : i18n.itemName(item.itemId);
  const busy = () => locked || Boolean(state.campaign.expedition || state.campaign.trade || state.campaign.region !== 'village');
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: events.signal });

  function cancelDrag() {
    if (scrollFrame !== null) win.cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
    const old = pointer;
    pointer = null;
    old?.ghost?.remove();
    if (old && root.hasPointerCapture?.(old.id)) root.releasePointerCapture(old.id);
    root.querySelectorAll('.gear-drop-target').forEach(node => node.classList.remove('gear-drop-target'));
  }

  function autoScroll() {
    if (!pointer?.ghost) return;
    const y = pointer.currentY;
    const distance = y < 80 ? -14 : y > win.innerHeight - 80 ? 14 : 0;
    if (distance) win.scrollBy(0, distance);
    scrollFrame = win.requestAnimationFrame(autoScroll);
  }

  function contents() {
    const person = hero();
    if (!person) return '';
    return `<p class="gear-editor-hint">${t('equipment.hint')}</p><ul class="gear-slots">${config.equipmentSlots.map(slot => {
      const changed = Object.hasOwn(draft, slot);
      const item = changed ? find(draft[slot]) : person.equipment[slot];
      const name = item ? label(item) : i18n.t('mvp.noEquipment');
      return `<li class="gear-slot ${changed ? 'is-pending' : ''}"><button type="button" class="gear-slot-target" data-equip-slot="${slot}" aria-label="${t('equipment.slot', { slot: i18n.t('mvp.slot.' + slot), item: name })}" ${busy() ? 'disabled' : ''}><span class="hero-equipment-art" aria-hidden="true">${item ? itemArt(presentation[item.itemId]) : '—'}</span><span><small>${t('mvp.slot.' + slot)}</small><strong>${escape(name)}</strong>${changed ? `<small class="gear-pending">${t('equipment.pending')}</small>` : ''}</span></button><button type="button" class="gear-remove" data-equip-remove="${slot}" aria-label="${t('equipment.removeSlot', { slot: i18n.t('mvp.slot.' + slot) })}" ${busy() || !item ? 'disabled' : ''}>${t('equipment.remove')}</button></li>`;
    }).join('')}</ul><div class="gear-selection" role="status" aria-live="polite">${escape(message || (selected && find(selected) ? i18n.t('equipment.selected', { item: label(find(selected)), slot: i18n.t('mvp.slot.' + config.itemSlots[find(selected).itemId]) }) : i18n.t('equipment.selectHint')))}</div><h3>${t('equipment.candidates')}</h3><div class="gear-candidates">${available().map(item => {
      const assigned = Object.values(draft).includes(item.instanceId);
      const reason = equipmentItemError(person, item.itemId, config, game.itemDefinitions);
      const type = config.equipmentTypes[game.itemDefinitions[item.itemId].equipmentType];
      return `<div class="gear-candidate ${selected === item.instanceId ? 'is-selected' : ''} ${assigned ? 'is-assigned' : ''}"><button type="button" class="gear-select" data-equip-item="${escape(item.instanceId)}" aria-pressed="${selected === item.instanceId}" ${busy() || reason ? 'disabled' : ''}><span class="hero-equipment-art" aria-hidden="true">${itemArt(presentation[item.itemId])}</span><span><strong>${escape(label(item))}</strong><small>${t(type.nameKey)} · ${escape(i18n.t('money.amount', { amount: game.price(item) }))}</small>${assigned ? `<small>${t('equipment.pending')}</small>` : ''}${reason ? `<small class="gear-restriction">${t(reason)}</small>` : ''}</span></button><button type="button" class="gear-drag-handle" data-equip-drag="${escape(item.instanceId)}" aria-label="${t('equipment.drag', { item: label(item) })}" ${busy() || reason ? 'disabled' : ''}><span aria-hidden="true">↕</span></button></div>`;
    }).join('') || `<p>${t('equipment.empty')}</p>`}</div><button type="button" class="mvp-button gear-reset" data-equip-reset ${busy() || (!selected && !Object.keys(draft).length) ? 'disabled' : ''}>${t('equipment.reset')}</button>`;
  }

  function refresh() {
    const host = root.querySelector('[data-equipment-editor]');
    if (host) host.innerHTML = contents();
  }

  function select(id) {
    if (busy() || !find(id) || equipmentItemError(hero(), find(id).itemId, config, game.itemDefinitions)) return;
    selected = selected === id ? null : id;
    message = '';
    refresh();
  }

  function stage(slot, id) {
    if (busy()) return;
    const item = find(id);
    if (!item || config.itemSlots[item.itemId] !== slot) {
      message = i18n.t('equipment.wrongSlot');
    } else {
      const planned = { ...hero().equipment };
      for (const [key, value] of Object.entries({ ...draft, [slot]: id })) {
        if (value === null) delete planned[key]; else planned[key] = find(value);
      }
      const reason = equipmentLoadoutError(hero(), planned, config, game.itemDefinitions);
      if (reason) message = i18n.t(reason);
      else { draft[slot] = id; selected = null; message = i18n.t('equipment.staged'); }
    }
    refresh();
  }

  listen(root, 'click', event => {
    const target = event.target.closest('[data-equip-item], [data-equip-slot], [data-equip-remove], [data-equip-reset]');
    if (!target || target.disabled || busy()) return;
    if (target.hasAttribute('data-equip-item')) select(target.dataset.equipItem);
    else if (target.hasAttribute('data-equip-slot')) {
      if (selected) stage(target.dataset.equipSlot, selected);
    } else if (target.hasAttribute('data-equip-remove')) {
      const slot = target.dataset.equipRemove;
      if (hero().equipment[slot]) draft[slot] = null;
      else delete draft[slot];
      selected = null;
      message = i18n.t('equipment.staged');
      refresh();
    } else {
      selected = null; draft = {}; message = ''; refresh();
    }
  });

  listen(root, 'pointerdown', event => {
    const target = event.target.closest('[data-equip-drag]');
    if (!target || target.disabled || busy() || pointer || !event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, itemId: target.dataset.equipDrag, x: event.clientX, y: event.clientY, ghost: null };
    root.setPointerCapture(event.pointerId);
  });
  listen(root, 'pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (!pointer.ghost && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return;
    if (!pointer.ghost) {
      const item = find(pointer.itemId);
      if (!item || busy()) { cancelDrag(); return; }
      const ghost = root.ownerDocument.createElement('div');
      ghost.className = 'gear-drag-preview'; ghost.setAttribute('aria-hidden', 'true');
      ghost.textContent = label(item); root.ownerDocument.body.append(ghost); pointer.ghost = ghost;
    }
    event.preventDefault();
    pointer.currentY = event.clientY;
    if (scrollFrame === null) scrollFrame = win.requestAnimationFrame(autoScroll);
    pointer.ghost.style.left = `${event.clientX + 12}px`;
    pointer.ghost.style.top = `${event.clientY + 12}px`;
    root.querySelectorAll('.gear-drop-target').forEach(node => node.classList.remove('gear-drop-target'));
    const target = root.ownerDocument.elementFromPoint(event.clientX, event.clientY)?.closest('[data-equip-slot]');
    const item = find(pointer.itemId);
    if (target && root.contains(target) && config.itemSlots[item?.itemId] === target.dataset.equipSlot) target.classList.add('gear-drop-target');
  });
  listen(root, 'pointerup', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const { itemId, ghost } = pointer;
    const target = root.ownerDocument.elementFromPoint(event.clientX, event.clientY)?.closest('[data-equip-slot]');
    cancelDrag();
    if (ghost) {
      if (target && root.contains(target)) stage(target.dataset.equipSlot, itemId);
    } else select(itemId);
  });
  for (const type of ['pointercancel', 'lostpointercapture']) listen(root, type, event => {
    if (event.pointerId === pointer?.id) cancelDrag();
  });
  listen(root, 'keydown', event => {
    if (event.key === 'Escape') { cancelDrag(); selected = null; message = ''; refresh(); }
  });
  listen(root.ownerDocument.defaultView, 'blur', cancelDrag);

  return {
    render(person, isLocked) {
      cancelDrag();
      // Reset stale drafts after commits or external inventory changes, without saving UI state.
      const signature = JSON.stringify([person.id, person.equipment, state.warehouse.items]);
      if (source !== signature || isLocked) { draft = {}; selected = null; message = ''; }
      source = signature; heroId = person.id; locked = isLocked;
      return `<div class="equipment-editor" data-equipment-editor>${contents()}</div>`;
    },
    changes: () => ({ ...draft }),
    destroy() { cancelDrag(); events.abort(); },
  };
}
