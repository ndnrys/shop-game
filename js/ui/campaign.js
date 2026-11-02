import { equipmentPower, questStage } from "../systems/expeditions.js";
import { dailyTotals } from "../systems/sales.js";
import { calendarDate } from "../systems/calendar.js";
import { itemArt } from "./itemArt.js";

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function mountCampaign(root, game) {
  const events = new AbortController();
  const { state, campaign: actions, i18n, itemDefinitions, presentation } = game;
  const c = state.campaign;
  const config = actions.config;
  const view = root.dataset.screen;
  const { t, itemName } = i18n;
  const tr = (key, params = {}) => escape(t(key, params));
  const money = amount => t('money.amount', { amount });
  const date = day => { const value = calendarDate(day, config.daysPerSeason); return t('mvp.date', { ...value, season: t(`mvp.season.${value.season}`) }); };
  const heroName = id => t(`mvp.hero.${id}`);
  const companionIds = new Set();
  let message = '';
  let error = false;
  const button = (action, label, disabled = false, attrs = '') => `<button type="button" class="mvp-button" data-action="${action}" ${disabled ? 'disabled' : ''} ${attrs}>${label}</button>`;
  const link = (id, key) => `<a class="mvp-link" href="#${id}">${tr(key)}</a>`;

  function product(item, source) {
    const definition = itemDefinitions[item.itemId];
    return `<article class="mvp-product"><div class="mvp-product-art" aria-hidden="true">${itemArt(presentation[item.itemId])}</div><div><strong>${escape(itemName(item.itemId))}</strong><p>${tr('mvp.price', { amount: money(definition.price) })}</p></div><div class="mvp-actions">${source === 'incoming' ? button('keep', tr('mvp.keep'), false, `data-id="${item.instanceId}"`) : ''}${button('sellBack', tr('mvp.sellBack', { amount: money(actions.buyback(item.itemId)) }), false, `data-id="${item.instanceId}" data-source="${source}"`)}</div></article>`;
  }

  function purchase() {
    if (c.region !== 'village') return `<p>${tr('mvp.completeHint')}</p>`;
    if (!c.trade) return `<div class="mvp-grid">${config.merchants.map(merchant => `<article class="mvp-card"><h2>${tr(`mvp.merchant.${merchant.id}`)}</h2><p>${tr('mvp.merchantTerms', { cost: money(merchant.cost), count: merchant.count })}</p>${button('buy', tr('mvp.buy'), c.gold < merchant.cost, `data-id="${merchant.id}"`)}</article>`).join('')}</div>`;
    return `<section class="mvp-card"><h2>${tr('mvp.tradeWith', { name: t(`mvp.merchant.${c.trade.merchantId}`) })}</h2><p>${tr('mvp.tradeHint')}</p>${link('warehouse', 'nav.warehouse')}<h3>${tr('mvp.incoming')}</h3><div class="mvp-products">${c.trade.incoming.map(item => product(item, 'incoming')).join('') || `<p>${tr('mvp.incomingEmpty')}</p>`}</div>${button('finishTrade', tr('mvp.finishTrade'), c.trade.incoming.length > 0)}</section><section class="mvp-card"><h2>${tr('mvp.oldStock')}</h2><p>${tr('mvp.oldStockHint')}</p><div class="mvp-products">${state.warehouse.items.map(item => product(item, 'warehouse')).join('') || tr('mvp.noStock')}</div></section>`;
  }

  function support() {
    const locked = Boolean(c.expedition || c.trade || c.region !== 'village');
    const available = state.warehouse.items.filter(item => config.itemSlots[item.itemId]);
    return `<div class="mvp-grid">${c.heroes.map(hero => `<article class="mvp-card"><h2>${escape(heroName(hero.id))}</h2><p>${tr('mvp.heroGrowth', { level: hero.level, experience: hero.experience, required: config.quest.levelExperience, ability: hero.ability })}</p><p class="hero-health">${hero.recoverUntil > c.day ? tr('mvp.heroInjured', { days: hero.recoverUntil-c.day, date: date(hero.recoverUntil) }) : tr('mvp.heroHealthy')}</p><p>${config.equipmentSlots.map(slot => `${tr(`mvp.slot.${slot}`)}: ${hero.equipment[slot] ? escape(itemName(hero.equipment[slot].itemId)) : tr('mvp.noEquipment')}`).join('<br>')}<br>${tr('mvp.gearPower', { amount: equipmentPower(hero, config) })}</p><p>${tr('mvp.funds', { amount: money(hero.funds) })}</p><form data-hero="${hero.id}"><label>${tr('mvp.gearLabel')}<select name="gear" ${locked ? 'disabled' : ''}><option value="">${tr('mvp.noGearChoice')}</option>${available.map(item => `<option value="${item.instanceId}">${tr(`mvp.slot.${config.itemSlots[item.itemId]}`)}: ${escape(itemName(item.itemId))}</option>`).join('')}</select></label><label>${tr('mvp.fundsLabel')}<input name="funds" type="number" min="0" max="${c.gold}" step="1" value="0" inputmode="numeric" ${locked ? 'disabled' : ''}></label><button class="mvp-button" type="submit" ${locked ? 'disabled' : ''}>${tr('mvp.give')}</button></form><small>${tr('mvp.equippedHint')}</small></article>`).join('')}</div><section class="mvp-card quest-card"><h2>${tr('mvp.questName')}</h2><div class="quest-progress"><strong>${tr('mvp.progress', { amount: c.progress })}</strong><progress max="100" value="${c.progress}" aria-label="${tr('mvp.progress', { amount: c.progress })}"></progress><p>${c.defeated ? tr('mvp.safe') : c.progress >= 100 ? tr('mvp.bossAppeared') : tr(`mvp.stage.${questStage(c.progress, config).key}`)}</p></div><p>${tr('mvp.questHint', { gain: config.quest.progressSuccess, setback: config.quest.progressSetback, funds: config.quest.minimumFunds })}</p><p>${tr('mvp.spentFunds')}</p>${c.defeated ? `<strong>${tr('mvp.safe')}</strong>` : c.expedition ? `<strong>${tr('mvp.away', { date: date(c.expedition.returnDay) })}</strong>` : `<strong>${tr('mvp.chance', { amount: Math.round(actions.chance() * 100) })}</strong><p>${tr('mvp.duration', { days: config.quest.duration, date: date(c.day + config.quest.duration) })}</p>${c.heroes.some(hero => hero.recoverUntil > c.day) ? `<p>${tr('mvp.recoveryWait')}</p>` : ''}${button('dispatch', tr(c.progress >= 100 ? 'mvp.dispatchBoss' : 'mvp.dispatch'), locked || c.heroes.some(hero => hero.recoverUntil > c.day))}`}</section>`;
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
    for (const entry of c.journal) {
      if (!groups.has(entry.day)) groups.set(entry.day, []);
      groups.get(entry.day).push(entry);
    }
    return `<article class="mvp-parchment">${[...groups].reverse().map(([day, entries]) => `<section><h2>${escape(date(day))}</h2><ul>${entries.map(entry => `<li>${log(entry)}</li>`).join('')}</ul></section>`).join('') || `<p>${tr('mvp.journalEmpty')}</p>`}</article>`;
  }

  function departure() {
    const quote = actions.quote([...companionIds]);
    return `<section class="mvp-card departure-card"><h2>${tr('mvp.departure')}</h2><p>${tr('mvp.departureHint')}</p><div class="companion-options">${c.heroes.map(hero => `<label><input type="checkbox" data-companion="${hero.id}" ${companionIds.has(hero.id) ? 'checked' : ''}> ${tr('mvp.companion', { name: heroName(hero.id) })} <small>${tr('mvp.ability', { amount: hero.ability })} · ${Object.values(hero.equipment).map(item => escape(itemName(item.itemId))).join('・') || tr('mvp.noEquipment')}</small></label>`).join('')}</div><div class="departure-quote"><p>${tr('mvp.settlement', { amount: money(quote.settlement) })}</p><p>${tr('mvp.baseGold', { amount: money(config.nextTownBaseGold) })}</p><p>${tr('mvp.travel', { amount: money(quote.travel) })}</p><strong>${tr('mvp.openingGold', { amount: money(quote.openingGold) })}</strong></div><p>${tr('mvp.departWarning')}</p>${button('depart', tr('mvp.depart'), Boolean(c.trade || c.expedition || quote.openingGold < 0))}</section>`;
  }

  function visitors() {
    if (!c.customerVisits.length) return '';
    return `<section class="mvp-card visitor-card"><h2>${tr('mvp.visitors')}</h2><div class="visitor-list">${c.customerVisits.map(visit => `<article><strong>${tr(`mvp.customer.${visit.customerId}`)}</strong><blockquote>${escape(t(visit.dialogueKey))}</blockquote><small>${visit.purchase ? tr('mvp.visitPurchased', { item: itemName(visit.purchase.itemId), amount: money(visit.purchase.amount) }) : tr('mvp.visitBrowsing')}</small></article>`).join('')}</div>${link('journal', 'mvp.go.journal')}</section>`;
  }

  function home() {
    if (c.region !== 'village') return `<section class="mvp-card mvp-complete"><p class="eyebrow">${tr('mvp.done')}</p><h2>${tr('mvp.complete')}</h2><p>${tr('mvp.completeHint')}</p><h3>${tr('mvp.openingGold', { amount: money(c.departure.openingGold) })}</h3><p>${tr('mvp.companions', { names: c.departure.heroIds.map(heroName).join('・') || t('mvp.none') })}</p><p>${tr('mvp.newTalent')}</p>${link('journal', 'mvp.go.journal')}</section>`;
    const totals = dailyTotals(c.today);
    const stats = [['sales', c.today.sales], ['grossProfit', totals.grossProfit], ['cost', c.today.purchasing], ['buyback', c.today.buyback], ['supportCost', c.today.support], ['reward', c.today.rewards], ['aid', c.today.aid], ['net', totals.net]];
    const steps = [ ['purchase', c.milestones.purchased], ['sale', c.milestones.sold], ['support', c.milestones.supported], ['progress', c.progress >= 100], ['quest', c.defeated], ['gold', c.gold >= config.targetGold] ];
    const guide = c.heroes.some(hero => hero.recoverUntil > c.day) && !c.defeated ? 'recovering' : !c.milestones.purchased ? 'purchase' : !c.milestones.sold ? 'sale' : !c.milestones.supported ? 'support' : c.expedition ? 'away' : !c.defeated ? 'quest' : c.gold < config.targetGold ? 'gold' : 'ready';
    return `<section class="mvp-card"><h2>${tr('mvp.business')}</h2><p>${tr('mvp.openHint')}</p>${c.trade ? `<p class="is-error">${tr('mvp.tradeBlocksOpening')}</p>${link('purchase', 'mvp.go.purchase')}` : !state.shop.displayedItems.length && !c.opened ? `<p>${tr('mvp.emptyShelfHint')}</p>${link('stocking', 'mvp.go.stocking')}` : ''}<div class="mvp-actions">${button('open', tr(c.opened ? 'mvp.closed' : 'mvp.open'), Boolean(c.opened || c.trade || !state.shop.displayedItems.length))}${button('nextDay', tr('mvp.nextDay'), Boolean(c.trade))}</div>${c.expedition ? `<p>${tr('mvp.away', { date: date(c.expedition.returnDay) })}</p>` : ''}<hr><p>${tr('mvp.reliefHint')}</p>${button('relief', tr('mvp.relief', { amount: money(config.aidAmount) }), Boolean(c.trade || c.aidDay === c.day || c.gold >= Math.min(...config.merchants.map(m => m.cost))))}</section>${visitors()}<section class="mvp-card tutorial-card"><h2>${tr('mvp.tutorial')}</h2><p class="tutorial-guide">${tr(`mvp.guide.${guide}`)}</p><ol>${steps.map(([key, complete]) => `<li class="${complete ? 'is-complete' : ''}"><span>${tr(`mvp.step.${key}`, { amount: money(config.targetGold) })}</span><small>${tr(complete ? 'mvp.done' : 'mvp.pending')}</small></li>`).join('')}</ol><div class="mvp-actions">${link('purchase','mvp.go.purchase')}${link('stocking','mvp.go.stocking')}${link('support','mvp.go.support')}</div></section><div class="mvp-stats">${stats.map(([key, amount]) => `<div><span>${tr(`mvp.${key}`)}</span><strong>${escape(money(amount))}</strong></div>`).join('')}</div>${c.defeated && c.gold >= config.targetGold ? departure() : ''}`;
  }

  function render() {
    root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${escape(date(c.day))}</p><h1>${tr(`mvp.title.${view}`)}</h1><p class="intro">${tr(`mvp.subtitle.${view}`)}</p></div><strong class="mvp-wallet">${escape(money(c.gold))}</strong></div><p class="mvp-status ${error ? 'is-error' : ''}" role="status" aria-live="polite">${escape(message)}</p>${({ home, purchase, support, journal })[view]()}`;
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
    announce(actions.support(form.dataset.hero, fields.get('gear') || null, Number(fields.get('funds'))));
  }, { signal: events.signal });
  root.addEventListener('change', event => {
    const id = event.target.dataset.companion;
    if (!id) return;
    if (event.target.checked) companionIds.add(id); else companionIds.delete(id);
    render();
  }, { signal: events.signal });
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const id = target.dataset.id;
    const operations = { buy: () => actions.startTrade(id), keep: () => actions.keep(id), sellBack: () => actions.sellBack(id, target.dataset.source), finishTrade: actions.finishTrade, open: actions.openShop, nextDay: actions.nextDay, relief: actions.relief, dispatch: actions.dispatch, depart: () => actions.depart([...companionIds]) };
    announce(operations[target.dataset.action]());
  }, { signal: events.signal });
  render();
  return { render, destroy: () => events.abort() };
}
