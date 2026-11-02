import { equipmentPower, questStage } from "../systems/expeditions.js";
import { dailyTotals } from "../systems/sales.js";
import { calendarDate } from "../systems/calendar.js";
import { itemArt } from "./itemArt.js";

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function mountCampaign(root, game) {
  const events = new AbortController();
  const { state, campaign: actions, i18n, presentation } = game;
  const c = state.campaign;
  const config = actions.config;
  const view = root.dataset.screen;
  const { t, itemName } = i18n;
  const tr = (key, params = {}) => escape(t(key, params));
  const itemLabel = item => item.used ? t('item.usedName', { name: itemName(item.itemId) }) : itemName(item.itemId);
  const money = amount => t('money.amount', { amount });
  const date = day => { const value = calendarDate(day, config.daysPerSeason); return t('mvp.date', { ...value, season: t(`mvp.season.${value.season}`) }); };
  const heroName = id => t(`mvp.hero.${id}`);
  const companionIds = new Set();
  let selectedHeroId = c.heroes[0]?.id;
  let destination = '';
  let destinationDay = c.day;
  const amounts = new Map();
  let message = '';
  let error = false;
  const button = (action, label, disabled = false, attrs = '') => `<button type="button" class="mvp-button" data-action="${action}" ${disabled ? 'disabled' : ''} ${attrs}>${label}</button>`;
  const link = (id, key) => `<a class="mvp-link" href="#${id}">${tr(key)}</a>`;

  function actor(id, className = '') {
    const artwork = config.presentation?.characters?.[id];
    if (!artwork) return '';
    return `<span class="scene-actor ${className}" aria-hidden="true">${itemArt(typeof artwork === 'string' ? { imageUrl: artwork } : artwork)}</span>`;
  }

  function product(item, source) {
    return `<article class="mvp-product"><div class="mvp-product-art" aria-hidden="true">${itemArt(presentation[item.itemId])}</div><div><strong>${escape(itemLabel(item))}</strong><p>${tr('mvp.price', { amount: money(game.price(item)) })}</p></div><div class="mvp-actions">${source === 'incoming' ? button('keep', tr('mvp.keep'), false, `data-id="${item.instanceId}"`) : ''}${button('sellBack', tr('mvp.sellBack', { amount: money(actions.buyback(item)) }), false, `data-id="${item.instanceId}" data-source="${source}"`)}</div></article>`;
  }

  function purchase() {
    if (c.region !== 'village') return `<p>${tr('mvp.completeHint')}</p>`;
    if (!c.trade) return `<div class="mvp-grid">${config.merchants.map(merchant => {
      const amount = amounts.get(merchant.id) ?? merchant.cost;
      const quote = actions.deliveryQuote(merchant.id, amount);
      return `<article class="mvp-card merchant-card">${actor(merchant.id)}<h2>${tr(`mvp.merchant.${merchant.id}`)}</h2><p>${tr('mvp.merchantTerms', { cost: money(merchant.cost), count: merchant.count })}</p><label>${tr('routine.payment')}<input type="number" data-merchant-amount="${merchant.id}" min="${merchant.cost}" max="${Math.min(c.gold, Math.floor(1000 / merchant.count) * merchant.cost)}" step="${merchant.cost}" value="${amount}" inputmode="numeric"></label><p data-quote="${merchant.id}" aria-live="polite">${tr(quote.valid ? 'routine.delivery' : 'routine.invalidAmount', { count: quote.count, amount: money(amount) })}</p>${button('buy', tr('mvp.buy'), c.gold < merchant.cost, `data-id="${merchant.id}"`)}</article>`;
    }).join('')}</div><section class="mvp-card"><p>${tr('mvp.reliefHint')}</p>${button('relief', tr('mvp.relief', { amount: money(config.aidAmount) }), c.aidDay === c.day || c.gold >= Math.min(...config.merchants.map(m => m.cost)))}</section>`;
    return `<section class="mvp-card"><h2>${tr('mvp.tradeWith', { name: t(`mvp.merchant.${c.trade.merchantId}`) })}</h2><p>${tr('mvp.tradeHint')}</p>${link('warehouse', 'nav.warehouse')}<h3>${tr('mvp.incoming')}</h3><div class="mvp-products">${c.trade.incoming.map(item => product(item, 'incoming')).join('') || `<p>${tr('mvp.incomingEmpty')}</p>`}</div>${button('finishTrade', tr('mvp.finishTrade'), c.trade.incoming.length > 0)}</section><section class="mvp-card"><h2>${tr('mvp.oldStock')}</h2><p>${tr('mvp.oldStockHint')}</p><div class="mvp-products">${state.warehouse.items.map(item => product(item, 'warehouse')).join('') || tr('mvp.noStock')}</div></section>`;
  }

  function questMap() {
    const map = config.quest.map;
    if (!map) return '';
    const current = questStage(c.progress, config).key;
    const marker = (point, home = false) => {
      const active = !home && point.stage === current;
      const selectable = active && !c.defeated && !c.expedition && view === 'support';
      const status = c.defeated ? 'mvp.map.cleared' : c.progress >= 100 ? 'mvp.map.boss' : 'mvp.map.current';
      return `<li class="quest-map-node ${home ? 'is-home' : ''} ${active ? 'is-current' : ''}" style="--map-x:${point.x}%;--map-y:${point.y}%" ${active ? 'aria-current="step"' : ''}><span class="quest-map-pin" aria-hidden="true"></span><span>${selectable ? `<button type="button" data-destination="${current}" aria-pressed="${destination === current}">${tr(point.labelKey)}</button>` : tr(point.labelKey)}${active ? `<small>${tr(status)}</small>` : ''}</span></li>`;
    };
    return `<figure class="quest-map"><figcaption>${tr(map.titleKey)}</figcaption><div class="quest-map-art"><img src="${escape(map.imageUrl)}" alt="${tr(map.descriptionKey)}"><ol>${marker(map.home, true)}${map.points.map(point => marker(point)).join('')}</ol></div></figure>`;
  }

  function gearControls(hero, locked) {
    return `<fieldset class="support-gear"><legend>${tr('mvp.gearLabel')}</legend>${config.equipmentSlots.map(slot => {
      const available = state.warehouse.items.filter(item => config.itemSlots[item.itemId] === slot);
      return `<div class="support-slot"><label class="support-slot-check"><input type="checkbox" data-gear-toggle="${slot}" aria-label="${tr('support.changeSlot', { slot: t(`mvp.slot.${slot}`) })}" ${locked ? 'disabled' : ''}><span>${tr(`mvp.slot.${slot}`)}</span></label><select name="gear_${slot}" data-gear-slot="${slot}" aria-label="${tr('support.chooseSlot', { slot: t(`mvp.slot.${slot}`) })}" disabled><option value="" disabled selected>${tr('support.choose')}</option>${hero.equipment[slot] ? `<option value="return" data-return>${tr('support.remove')}</option>` : ''}${available.map(item => `<option value="${escape(item.instanceId)}">${escape(itemLabel(item))} · ${escape(money(game.price(item)))}</option>`).join('')}</select></div>`;
    }).join('')}</fieldset>`;
  }

  function support() {
    const locked = Boolean(c.expedition || c.trade || c.region !== 'village');
    const adventureTab = view === 'adventurers';
    return `<section class="mvp-card party-settings"><h2>${tr('routine.party')}</h2><p>${tr('routine.partyHint')}</p><div class="companion-options">${c.heroes.map(hero => `<label><input type="checkbox" data-party="${hero.id}" ${c.partyIds.includes(hero.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}>${escape(heroName(hero.id))}</label>`).join('')}</div></section><section class="party-roster" aria-label="${tr('mvp.roster')}">${c.heroes.map(hero => `<button type="button" data-select-hero="${hero.id}" aria-pressed="${selectedHeroId === hero.id}">${actor(hero.id)}<span>${escape(heroName(hero.id))}<small>${tr('mvp.roster.status', { level: hero.level, status: t(hero.recoverUntil > c.day ? 'mvp.roster.injured' : 'mvp.roster.ready') })}</small></span></button>`).join('')}</section><div class="support-layout"><div class="mvp-grid hero-detail">${c.heroes.filter(hero => hero.id === selectedHeroId).map(hero => `<article class="mvp-card"><header class="hero-heading">${actor(hero.id)}<h2>${escape(heroName(hero.id))}</h2></header><p>${tr('mvp.heroGrowth', { level: hero.level, experience: hero.experience, required: config.quest.levelExperience, ability: hero.ability })}</p><p class="hero-health">${hero.recoverUntil > c.day ? tr('mvp.heroInjured', { days: hero.recoverUntil-c.day, date: date(hero.recoverUntil) }) : tr('mvp.heroHealthy')}</p><ul class="hero-equipment">${config.equipmentSlots.map(slot => `<li><span class="hero-equipment-art" aria-hidden="true">${hero.equipment[slot] ? itemArt(presentation[hero.equipment[slot].itemId]) : '<span class="equipment-empty">—</span>'}</span><span><small>${tr(`mvp.slot.${slot}`)}</small>${hero.equipment[slot] ? escape(itemName(hero.equipment[slot].itemId)) : tr('mvp.noEquipment')}</span></li>`).join('')}</ul><p>${tr('mvp.gearPower', { amount: equipmentPower(hero, config) })}</p><p>${tr('mvp.funds', { amount: money(hero.funds) })}</p><form data-hero="${hero.id}">${gearControls(hero, locked)}<label>${tr('mvp.fundsLabel')}<input name="funds" type="number" min="0" max="${c.gold}" step="1" value="0" inputmode="numeric" ${locked ? 'disabled' : ''}></label><button class="mvp-button" type="submit" ${locked ? 'disabled' : ''}>${tr('mvp.give')}</button></form><small>${tr('mvp.equippedHint', { percent: (config.usedPriceRate ?? 1) * 100 })}</small>${hero.giftedEquipment.length ? button('recoverArchived', tr('support.recoverArchived', { count: hero.giftedEquipment.length }), locked, `data-id="${hero.id}"`) : ''}</article>`).join('')}</div><section class="mvp-card quest-card"><h2>${tr('mvp.questName')}</h2>${adventureTab ? '' : config.quest.map ? questMap() : button('selectDestination', tr('mvp.questName'), Boolean(c.expedition || c.defeated))}<div class="quest-progress"><strong>${tr('mvp.progress', { amount: c.progress })}</strong><progress max="100" value="${c.progress}" aria-label="${tr('mvp.progress', { amount: c.progress })}"></progress><p>${c.defeated ? tr('mvp.safe') : c.progress >= 100 ? tr('mvp.bossAppeared') : tr(`mvp.stage.${questStage(c.progress, config).key}`)}</p></div><p>${tr('mvp.questHint', { gain: config.quest.progressSuccess, setback: config.quest.progressSetback, funds: config.quest.minimumFunds })}</p><p>${tr('mvp.spentFunds')}</p>${c.defeated ? `<strong>${tr('mvp.safe')}</strong>` : c.expedition ? `<strong>${tr('mvp.away', { date: date(c.expedition.returnDay) })}</strong>` : `<strong>${tr('mvp.chance', { amount: Math.round(actions.chance() * 100) })}</strong><p>${tr('mvp.duration', { days: config.quest.duration, date: date(c.day + config.quest.duration) })}</p>${c.heroes.some(hero => hero.recoverUntil > c.day) ? `<p>${tr('mvp.recoveryWait')}</p>` : ''}${adventureTab ? `<p>${tr('routine.departInSupport')}</p>` : `${button('dispatch', tr(c.progress >= 100 ? 'mvp.dispatchBoss' : 'mvp.dispatch'), locked || !destination || !c.partyIds.length || c.heroes.some(hero => c.partyIds.includes(hero.id) && hero.recoverUntil > c.day))}`}`}</section></div>`;
  }

  function log(entry) {
    const details = { ...entry.details };
    if ('amount' in details) details.amount = money(details.amount);
    if (details.heroId) details.hero = heroName(details.heroId);
    details.item = details.itemId ? itemName(details.itemId) : t('mvp.none');
    if (details.merchantId) details.merchant = t(`mvp.merchant.${details.merchantId}`);
    if (details.customerId) details.customer = t(`mvp.customer.${details.customerId}`);
    if (details.dialogueKey) details.line = t(details.dialogueKey);
    if (details.returnDay) details.date = date(details.returnDay);
    if (entry.type === 'dispatch') details.kind = t(details.kind === 'boss' ? 'mvp.kind.boss' : 'mvp.kind.explore');
    if (entry.type === 'exploration') details.result = t(details.success ? 'mvp.explorationGood' : 'mvp.explorationSetback');
    if (entry.type === 'summary') for (const key of ['sales','cogs','purchasing','buyback','support','rewards','aid','net']) details[key] = money(details[key] ?? 0);
    return tr(`mvp.log.${entry.type}`, details);
  }

  function journal() {
    const groups = new Map();
    for (const entry of c.journal.filter(entry => entry.type !== 'visit')) {
      if (!groups.has(entry.day)) groups.set(entry.day, []);
      groups.get(entry.day).push(entry);
    }
    return `<article class="mvp-parchment">${[...groups].reverse().map(([day, entries]) => `<section><h2>${escape(date(day))}</h2><ul>${entries.map(entry => `<li>${log(entry)}</li>`).join('')}</ul></section>`).join('') || `<p>${tr('mvp.journalEmpty')}</p>`}</article>`;
  }

  function departure() {
    const quote = actions.quote([...companionIds]);
    return `<section class="mvp-card departure-card"><h2>${tr('mvp.departure')}</h2><p>${tr('mvp.departureHint')}</p><div class="companion-options">${c.heroes.map(hero => `<label><input type="checkbox" data-companion="${hero.id}" ${companionIds.has(hero.id) ? 'checked' : ''}> ${tr('mvp.companion', { name: heroName(hero.id) })} <small>${tr('mvp.ability', { amount: hero.ability })} · ${Object.values(hero.equipment).map(item => escape(itemLabel(item))).join('・') || tr('mvp.noEquipment')}</small></label>`).join('')}</div><div class="departure-quote"><p>${tr('mvp.settlement', { amount: money(quote.settlement) })}</p><p>${tr('mvp.baseGold', { amount: money(config.nextTownBaseGold) })}</p><p>${tr('mvp.travel', { amount: money(quote.travel) })}</p><strong>${tr('mvp.openingGold', { amount: money(quote.openingGold) })}</strong></div><p>${tr('mvp.departWarning')}</p>${button('depart', tr('mvp.depart'), Boolean(c.trade || c.expedition || quote.openingGold < 0))}</section>`;
  }

  function visitors() {
    if (!c.customerVisits.length) return '';
    return `<section class="mvp-card visitor-card"><h2>${tr('mvp.visitors')}</h2><div class="visitor-list">${c.customerVisits.map(visit => `<article class="visitor-scene">${actor(visit.customerId)}<div class="visitor-dialogue"><blockquote class="speech-bubble"><cite>${tr(`mvp.customer.${visit.customerId}`)}</cite><p>${escape(t(visit.dialogueKey))}</p></blockquote><small>${visit.purchase ? tr('mvp.visitPurchased', { item: itemName(visit.purchase.itemId), amount: money(visit.purchase.amount) }) : tr('mvp.visitBrowsing')}</small></div></article>`).join('')}</div>${link('journal', 'mvp.go.journal')}</section>`;
  }

  function home() {
    if (c.region !== 'village') return `<section class="mvp-card mvp-complete"><p class="eyebrow">${tr('mvp.done')}</p><h2>${tr('mvp.complete')}</h2><p>${tr('mvp.completeHint')}</p><h3>${tr('mvp.openingGold', { amount: money(c.departure.openingGold) })}</h3><p>${tr('mvp.companions', { names: c.departure.heroIds.map(heroName).join('・') || t('mvp.none') })}</p><p>${tr('mvp.newTalent')}</p>${link('journal', 'mvp.go.journal')}</section>`;
    const stats = () => {
      const totals = dailyTotals(c.today);
      return `<div class="mvp-stats">${[['sales',c.today.sales],['grossProfit',totals.grossProfit],['cost',c.today.purchasing],['buyback',c.today.buyback],['supportCost',c.today.support],['reward',c.today.rewards],['aid',c.today.aid],['net',totals.net]].map(([key,amount]) => `<div><span>${tr(`mvp.${key}`)}</span><strong>${escape(money(amount))}</strong></div>`).join('')}</div>`;
    };
    if (c.phase === 'report') {
      const entries = c.journal.filter(entry => (entry.day === c.day - 1 && entry.type === 'summary') || (entry.day === c.day && ['exploration','bossSuccess','bossFailure','levelUp','injury','recovered'].includes(entry.type)));
      return `<section class="mvp-card"><h2>${tr('routine.phase.report')}</h2>${entries.length ? `<ul>${entries.map(entry => `<li>${log(entry)}</li>`).join('')}</ul>` : `<p>${tr('routine.firstReport')}</p>`}</section>${c.defeated && c.gold >= config.targetGold ? departure() : ''}`;
    }
    if (c.phase === 'opening') return `<section class="mvp-card"><h2>${tr('routine.phase.opening')}</h2><p>${tr('routine.openReview', { count: state.shop.displayedItems.length })}</p>${!state.shop.displayedItems.length ? `<p>${tr('routine.emptyShop')}</p>` : ''}${button('open', tr('routine.open'), Boolean(c.trade || c.opened))}${c.expedition ? `<p>${tr('mvp.away', { date: date(c.expedition.returnDay) })}</p>` : ''}</section>`;
    if (c.phase === 'sales') return `${visitors()}<section class="mvp-card">${button('salesDone', tr('routine.salesDone'))}</section>`;
    if (c.phase === 'end') return `${stats()}<section class="mvp-card"><h2>${tr('routine.phase.end')}</h2>${button('nextDay', tr('mvp.nextDay'))}</section>`;
    return '';
  }

  function residents() {
    return `<div class="mvp-grid">${(config.residents ?? []).map(resident => `<section class="mvp-card"><h2>${tr(resident.nameKey)}</h2><p>${tr(resident.descriptionKey)}</p><small>${tr('routine.comingSoon')}</small></section>`).join('')}</div>`;
  }

  function render() {
    if (destinationDay !== c.day) { destination = ''; destinationDay = c.day; }
    root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${escape(date(c.day))}</p><h1>${tr(`mvp.title.${view}`)}</h1><p class="intro">${tr(`mvp.subtitle.${view}`)}</p></div><strong class="mvp-wallet">${escape(money(c.gold))}</strong></div><p class="mvp-status ${error ? 'is-error' : ''}" role="status" aria-live="polite">${escape(message)}</p>${({ home, purchase, support, journal, adventurers: support, residents })[view]()}`;
  }
  function announce(result) {
    error = !result.ok;
    message = t(result.ok ? 'mvp.ok' : result.reason);
    render();
  }
  root.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target.closest('form[data-hero]');
    if (!form) return;
    const fields = new FormData(form);
    const changes = {};
    for (const toggle of form.querySelectorAll('[data-gear-toggle]:checked')) {
      const slot = toggle.dataset.gearToggle;
      const select = form.elements[`gear_${slot}`];
      if (select.selectedOptions[0]?.hasAttribute('data-return')) changes[slot] = null;
      else {
        if (!select.value) { announce({ ok: false, reason: 'mvp.error.equipment' }); return; }
        changes[slot] = select.value;
      }
    }
    announce(actions.support(form.dataset.hero, changes, Number(fields.get('funds'))));
  }, { signal: events.signal });
  root.addEventListener('change', event => {
    const slot = event.target.dataset.gearToggle;
    if (slot) {
      const select = event.target.closest('form').elements[`gear_${slot}`];
      select.disabled = !event.target.checked;
      return;
    }
    const partyId = event.target.dataset.party;
    if (partyId) {
      const ids = new Set(c.partyIds);
      if (event.target.checked) ids.add(partyId); else ids.delete(partyId);
      announce(actions.setParty([...ids]));
      return;
    }
    const id = event.target.dataset.companion;
    if (!id) return;
    if (event.target.checked) companionIds.add(id); else companionIds.delete(id);
    render();
  }, { signal: events.signal });
  root.addEventListener('input', event => {
    const id = event.target.dataset.merchantAmount;
    if (!id) return;
    const amount = Number(event.target.value);
    amounts.set(id, amount);
    const quote = actions.deliveryQuote(id, amount);
    root.querySelector(`[data-quote="${id}"]`).textContent = t(quote.valid ? 'routine.delivery' : 'routine.invalidAmount', { count: quote.count, amount: money(amount) });
  }, { signal: events.signal });
  root.addEventListener('click', event => {
    if (event.target.closest('[data-action=selectDestination]')) { destination = questStage(c.progress, config).key; render(); return; }
    const point = event.target.closest('[data-destination]');
    if (point) { destination = point.dataset.destination; render(); return; }
    const selection = event.target.closest('[data-select-hero]');
    if (selection) { selectedHeroId = selection.dataset.selectHero; render(); root.querySelector(`[data-select-hero="${selectedHeroId}"]`)?.focus({ preventScroll: true }); return; }
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const id = target.dataset.id;
    const operations = { recoverArchived: () => actions.recoverArchivedEquipment(id), buy: () => actions.startTrade(id, amounts.get(id)), keep: () => actions.keep(id), sellBack: () => actions.sellBack(id, target.dataset.source), finishTrade: actions.finishTrade, open: actions.openShop, nextDay: actions.nextDay, relief: actions.relief, salesDone: actions.advancePhase, dispatch: () => view === 'support' && c.phase === 'support' && destination ? actions.dispatch() : ({ ok: false, reason: 'mvp.error.phase' }), depart: () => actions.depart([...companionIds]) };
    announce(operations[target.dataset.action]());
  }, { signal: events.signal });
  render();
  return { render, destroy: () => events.abort() };
}
