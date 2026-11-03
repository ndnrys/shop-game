import { itemArt } from './itemArt.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function mountPartyEditor(root, game, announce) {
  const events = new AbortController();
  const { state, campaign: actions, i18n } = game;
  let selected = null, pointer = null, launchPartyId = null, renderFunds = () => "", canSelect = false;
  let scrollFrame = null;
  const win = root.ownerDocument.defaultView;
  const t = (key, values) => escape(i18n.t(key, values));
  const name = id => i18n.t(`mvp.hero.${id}`);
  const busy = () => Boolean(state.campaign.expedition || state.campaign.trade || state.campaign.region !== 'village');
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: events.signal });
  const art = id => {
    const value = actions.config.presentation?.characters?.[id];
    return value ? itemArt(typeof value === 'string' ? { imageUrl: value } : value) : '';
  };

  function cancelDrag() {
    if (scrollFrame !== null) win.cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
    const old = pointer; pointer = null; old?.ghost?.remove();
    if (old && root.hasPointerCapture?.(old.id)) root.releasePointerCapture(old.id);
    root.querySelectorAll('.party-drop-target').forEach(node => node.classList.remove('party-drop-target'));
  }

  function autoScroll() {
    if (!pointer?.ghost) return;
    const y = pointer.currentY;
    if (y < 80) win.scrollBy(0, -14);
    else if (y > win.innerHeight - 80) win.scrollBy(0, 14);
    scrollFrame = win.requestAnimationFrame(autoScroll);
  }

  function contents() {
    const c = state.campaign;
    return `<p>${t('party.hint')}</p><div class="party-frames">${c.parties.map((party, partyIndex) => `<section class="party-frame"><header><h3>${t('party.name', { number: partyIndex + 1 })}</h3>${canSelect ? `<button type="button" class="mvp-button" data-expedition-party="${party.id}" aria-pressed="${launchPartyId === party.id}" ${busy() ? 'disabled' : ''}>${t(launchPartyId === party.id ? 'party.departSelected' : 'party.selectDeparture')}</button>` : ''}</header><ul class="party-slots">${party.members.map((id, index) => `<li><button type="button" class="party-slot" data-party-id="${party.id}" data-party-slot="${index}" ${busy() ? 'disabled' : ''} aria-label="${t('party.slot', { party: partyIndex + 1, index: index + 1, name: id ? name(id) : i18n.t('party.empty') })}"><span class="party-slot-art" aria-hidden="true">${id ? art(id) : '＋'}</span><strong>${id ? escape(name(id)) : t('party.empty')}</strong><small>${t('party.slotNumber', { index: index + 1 })}</small></button><button type="button" class="party-remove" data-party-id="${party.id}" data-party-remove="${index}" ${busy() || !id ? 'disabled' : ''} aria-label="${t('party.removeSlot', { party: partyIndex + 1, index: index + 1 })}">${t('party.remove')}</button></li>`).join('')}</ul>${renderFunds(party)}</section>`).join('')}</div><button type="button" class="mvp-button party-add" data-create-party ${busy() || c.parties.length >= actions.config.maximumParties ? 'disabled' : ''}>${t('party.add')}</button><p class="party-selection" role="status" aria-live="polite">${selected ? t('party.selected', { name: name(selected) }) : t('party.selectHint')}</p><h3>${t('party.characters')}</h3><div class="party-candidates">${c.heroes.map(hero => `<article class="party-candidate ${selected === hero.id ? 'is-selected' : ''}"><button type="button" class="party-pick" data-party-pick="${hero.id}" aria-pressed="${selected === hero.id}" ${busy() ? 'disabled' : ''}><span class="party-character-art" aria-hidden="true">${art(hero.id)}</span><strong>${escape(name(hero.id))}</strong><small>${t('mvp.roster.status', { level: hero.level, status: i18n.t(hero.recoverUntil > c.day ? 'mvp.roster.injured' : 'mvp.roster.ready') })}</small><small>${c.parties.some(party => party.members.includes(hero.id)) ? t('party.assigned') : t('party.waiting')}</small></button><button type="button" class="party-drag-handle" data-party-drag="${hero.id}" ${busy() ? 'disabled' : ''} aria-label="${t('party.drag', { name: name(hero.id) })}"><span aria-hidden="true">↕</span></button><button type="button" class="party-details" data-select-hero="${hero.id}" aria-label="${t('party.detailsFor', { name: name(hero.id) })}">${t('party.details')}</button></article>`).join('')}</div>`;
  }
  function refresh() { const host = root.querySelector('[data-party-editor]'); if (host) host.innerHTML = contents(); }
  function select(id) { if (busy()) return; selected = selected === id ? null : id; refresh(); }
  function assign(partyId, index, id) {
    if (busy()) return;
    selected = null;
    announce(actions.assignPartySlot(partyId, index, id));
  }
  listen(root, 'click', event => {
    const target = event.target.closest('[data-party-pick], [data-party-slot], [data-party-remove], [data-create-party]');
    if (!target || target.disabled || busy()) return;
    if (target.hasAttribute('data-create-party')) announce(actions.createParty());
    else if (target.hasAttribute('data-party-pick')) select(target.dataset.partyPick);
    else if (target.hasAttribute('data-party-remove')) assign(target.dataset.partyId, Number(target.dataset.partyRemove), null);
    else if (selected) assign(target.dataset.partyId, Number(target.dataset.partySlot), selected);
  });
  listen(root, 'pointerdown', event => {
    const target = event.target.closest('[data-party-drag]');
    if (!target || target.disabled || busy() || pointer || !event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, heroId: target.dataset.partyDrag, x: event.clientX, y: event.clientY, ghost: null };
    root.setPointerCapture(event.pointerId);
  });
  listen(root, 'pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (!pointer.ghost && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return;
    if (busy()) { cancelDrag(); return; }
    if (!pointer.ghost) {
      pointer.ghost = root.ownerDocument.createElement('div'); pointer.ghost.className = 'party-drag-preview gear-drag-preview';
      pointer.ghost.setAttribute('aria-hidden', 'true'); pointer.ghost.textContent = name(pointer.heroId); root.ownerDocument.body.append(pointer.ghost);
    }
    event.preventDefault(); pointer.currentY = event.clientY;
    if (scrollFrame === null) scrollFrame = win.requestAnimationFrame(autoScroll);
    pointer.ghost.style.left = `${event.clientX + 12}px`; pointer.ghost.style.top = `${event.clientY + 12}px`;
    root.querySelectorAll('.party-drop-target').forEach(node => node.classList.remove('party-drop-target'));
    const target = root.ownerDocument.elementFromPoint(event.clientX, event.clientY)?.closest('[data-party-slot]');
    if (target && root.contains(target)) target.classList.add('party-drop-target');
  });
  listen(root, 'pointerup', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const { heroId, ghost } = pointer;
    const target = root.ownerDocument.elementFromPoint(event.clientX, event.clientY)?.closest('[data-party-slot]'); cancelDrag();
    if (ghost) { if (target && root.contains(target)) assign(target.dataset.partyId, Number(target.dataset.partySlot), heroId); }
    else select(heroId);
  });
  for (const type of ['pointercancel','lostpointercapture']) listen(root, type, event => { if (event.pointerId === pointer?.id) cancelDrag(); });
  listen(root, 'keydown', event => { if (event.key === 'Escape') { cancelDrag(); selected = null; refresh(); } });
  listen(root.ownerDocument.defaultView, 'blur', cancelDrag);
  return {
    render(partyId, fundsRenderer, allowSelection) { launchPartyId = partyId; renderFunds = fundsRenderer; canSelect = allowSelection; cancelDrag(); if (busy()) selected = null; return `<div data-party-editor>${contents()}</div>`; },
    destroy() { cancelDrag(); events.abort(); },
  };
}
