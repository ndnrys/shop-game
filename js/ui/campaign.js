import { mountPartyEditor } from "./partyEditor.js";
import { mountEquipmentEditor } from "./equipmentEditor.js";
import { growthChoices } from "../systems/growth.js";
import { dailyTotals } from "../systems/sales.js";
import { calendarDate } from "../systems/calendar.js";
import { itemArt } from "./itemArt.js";

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function mountCampaign(root, game) {
  const events = new AbortController();
  const { state, campaign: actions, i18n, presentation } = game;
  const c = state.campaign;
  const equipmentEditor = mountEquipmentEditor(root, game);
  const partyEditor = mountPartyEditor(root, game, announce);
  const config = actions.config;
  const view = root.dataset.screen;
  const { t, itemName } = i18n;
  const tr = (key, params = {}) => escape(t(key, params));
  const itemLabel = item => item.used ? t('item.usedName', { name: itemName(item.itemId) }) : itemName(item.itemId);
  const money = amount => t('money.amount', { amount });
  const date = day => { const value = calendarDate(day, config.daysPerSeason); return t('mvp.date', { ...value, season: t(`mvp.season.${value.season}`) }); };
  const heroName = id => t(`mvp.hero.${id}`);
  const companionIds = new Set();
  let selectedPartyId = c.parties[0].id;
  const currentParty = () => c.parties.find(party => party.id === selectedPartyId);
  let selectedHeroId = c.heroes[0]?.id;
  let destination = '';
  let destinationDay = c.day;
  const amounts = new Map();
  const procurementLots = new Map();
  const pendingFunds = new Map();
  let message = '';
  let error = false;
  let reportPage = 'accounts';
  let reportDay = c.day;
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

  const procurementSelections = () => config.merchants.map(merchant => ({ merchantId: merchant.id, lots: procurementLots.get(merchant.id) ?? 0 })).filter(selection => selection.lots > 0);
  function procurement() {
    const art = config.presentation?.procurement;
    const quote = actions.procurementQuote(procurementSelections());
    const affordable = quote.valid && quote.amount <= c.gold;
    const control = (merchant, name) => {
      const lots = procurementLots.get(merchant.id) ?? 0;
      const more = procurementSelections().filter(selection => selection.merchantId !== merchant.id).concat({ merchantId: merchant.id, lots: lots + 1 });
      const next = actions.procurementQuote(more);
      return `<div class="procurement-counter"><button type="button" data-procurement-change="-1" data-id="${escape(merchant.id)}" aria-label="${tr('procurement.minus', { name })}" ${lots === 0 ? 'disabled' : ''}>−</button><output aria-label="${escape(name)}">${lots}</output><button type="button" data-procurement-change="1" data-id="${escape(merchant.id)}" aria-label="${tr('procurement.plus', { name })}" ${!next.valid || next.amount > c.gold ? 'disabled' : ''}>+</button></div>`;
    };
    return `<div class="procurement-selection"><div class="procurement-merchants">${config.merchants.map(merchant => {
      const name = t('mvp.merchant.' + merchant.id);
      const rowArt = art?.rows?.[merchant.id];
      return `<section class="procurement-row">${rowArt ? `<img class="procurement-portrait" src="${escape(art.assets + rowArt.portrait)}" alt="">` : ''}<h2 class="${rowArt?.icon ? 'procurement-label-icon' : ''}" ${rowArt?.label ? `style="background-image:url('${escape(art.assets + rowArt.label)}')"` : ''}>${rowArt?.icon ? `<img src="${escape(art.assets + rowArt.icon)}" alt="">` : ''}${escape(name)}</h2>${control(merchant, name)}<small>${tr('procurement.terms', { amount: money(merchant.cost), count: merchant.count })}</small></section>`;
    }).join('')}<section class="procurement-row procurement-villager">${art ? `<img class="procurement-villager-art" src="${escape(art.assets + 'villager_portrait.png')}" alt="">` : ''}<h2>${tr('procurement.villager')}</h2><button type="button" class="procurement-video" disabled>${tr('procurement.video')}</button><small>${tr('procurement.videoPending')}</small></section></div><section class="procurement-summary" aria-live="polite"><p><span>${tr('procurement.totalLots')}</span><strong>${tr('procurement.lots', { count: quote.lots })}</strong></p><p><span>${tr('procurement.totalCost')}</span><strong>${escape(money(quote.amount.toLocaleString(i18n.getLocale())))}</strong></p></section><div class="procurement-actions"><button type="button" data-action="procurementBack">${tr('procurement.back')}</button><button type="button" data-action="procurementConfirm" ${!affordable ? 'disabled' : ''}>${tr('procurement.confirm')}</button></div><button type="button" class="procurement-skip" data-action="procurementSkip">${tr('procurement.skip')}</button>${c.gold < Math.min(...config.merchants.map(merchant => merchant.cost)) ? button('relief', tr('mvp.relief', { amount: money(config.aidAmount) }), c.aidDay === c.day) : ''}<p class="procurement-message ${error ? 'is-error' : ''}" role="status">${escape(message)}</p></div>`;
  }

  function purchase() {
    if (c.region !== 'village') return `<p>${tr('mvp.completeHint')}</p>`;
    if (!c.trade) return procurement();
    return `<section class="mvp-card"><h2>${tr('mvp.tradeWith', { name: t(`mvp.merchant.${c.trade.merchantId}`) })}</h2><p>${tr('mvp.tradeHint')}</p>${c.trade.pending?.length ? `<p>${tr('procurement.remaining', { count: c.trade.pending.length })}</p>` : ''}${link('warehouse', 'nav.warehouse')}<h3>${tr('mvp.incoming')}</h3><div class="mvp-products">${c.trade.incoming.map(item => product(item, 'incoming')).join('') || `<p>${tr('mvp.incomingEmpty')}</p>`}</div>${button('finishTrade', tr('mvp.finishTrade'), c.trade.incoming.length > 0)}</section><section class="mvp-card"><h2>${tr('mvp.oldStock')}</h2><p>${tr('mvp.oldStockHint')}</p><div class="mvp-products">${state.warehouse.items.map(item => product(item, 'warehouse')).join('') || tr('mvp.noStock')}</div></section>`;
  }

  function dungeonName(id) { return t(config.dungeons.find(dungeon => dungeon.id === id).nameKey); }
  function dungeonLabel(dungeon) {
    const status = actions.dungeonStatus(dungeon.id);
    return status.cleared ? t('dungeon.cleared') : status.unlocked ? t('dungeon.available') : t('dungeon.locked', { names: dungeon.requires.map(dungeonName).join(t('dungeon.separator')) });
  }
  function questMap() {
    const map = config.quest.map;
    if (!map) return '';
    const marker = dungeon => {
      const status = actions.dungeonStatus(dungeon.id);
      const selectable = status.unlocked && !status.cleared && !c.expedition && !c.trade && view === 'support';
      return `<li class="quest-map-node ${destination === dungeon.id ? 'is-current' : ''}" style="--map-x:${dungeon.map.x}%;--map-y:${dungeon.map.y}%"><span class="quest-map-pin" aria-hidden="true"></span><span>${selectable ? `<button type="button" data-destination="${dungeon.id}" aria-pressed="${destination === dungeon.id}">${tr(dungeon.nameKey)}</button>` : tr(dungeon.nameKey)}<small>${escape(dungeonLabel(dungeon))}</small></span></li>`;
    };
    return `<figure class="quest-map"><figcaption>${tr(map.titleKey)}</figcaption><div class="quest-map-art"><img src="${escape(map.imageUrl)}" alt="${tr(map.descriptionKey)}"><ol><li class="quest-map-node is-home" style="--map-x:${map.home.x}%;--map-y:${map.home.y}%"><span class="quest-map-pin" aria-hidden="true"></span><span>${tr(map.home.labelKey)}</span></li>${config.dungeons.filter(dungeon => dungeon.map).map(marker).join('')}</ol></div></figure>`;
  }
  function dungeonPanel(adventureTab, locked) {
    const activeId = c.expedition?.dungeonId ?? (destination || actions.nextDungeon());
    const dungeon = config.dungeons.find(entry => entry.id === activeId);
    const gain = dungeon ? Math.min(actions.attack(selectedPartyId), dungeon.requiredProgress - c.dungeonProgress[dungeon.id]) : 0;
    const participants = actions.members(selectedPartyId);
    const equipped = participants.filter(hero => Object.keys(hero.equipment).length).length;
    const risks = dungeon ? actions.risks(dungeon.id, selectedPartyId) : null;
    return `<section class="mvp-card quest-card"><h2>${tr('dungeon.title')}</h2>${adventureTab ? '' : questMap()}<div class="dungeon-list">${config.dungeons.map(entry => {
      const status = actions.dungeonStatus(entry.id);
      return `<article class="dungeon-card" data-dungeon="${entry.id}"><h3>${tr(entry.nameKey)}</h3><p>${tr('dungeon.progress', { progress: status.progress, required: status.required })}</p><progress max="${status.required}" value="${status.progress}" aria-label="${tr('dungeon.progressLabel', { name: t(entry.nameKey), progress: status.progress, required: status.required })}"></progress><p>${escape(dungeonLabel(entry))}</p>${adventureTab ? '' : `<button type="button" class="mvp-button" data-destination="${entry.id}" aria-pressed="${destination === entry.id}" ${locked || !status.unlocked || status.cleared ? 'disabled' : ''}>${tr('dungeon.select', { name: t(entry.nameKey) })}</button>`}</article>`;
    }).join('')}</div><p>${tr('dungeon.rules', { equipped: config.quest.minimumEquipped })}</p><p>${tr('dungeon.fundsNote')}</p>${c.defeated ? `<strong>${tr('mvp.safe')}</strong>` : c.expedition ? `<strong>${tr('dungeon.away', { name: dungeonName(c.expedition.dungeonId), date: date(c.expedition.returnDay) })}</strong>${c.expedition.legacyOutcome ? `<p>${tr('dungeon.legacyPending')}</p>` : ''}` : `<p class="dungeon-preview">${tr('dungeon.preview', { attack: actions.attack(selectedPartyId), gain })}</p>${dungeon ? `<p>${tr('mvp.duration', { days: dungeon.duration, date: date(c.day + dungeon.duration) })}</p>` : ''}${participants.length < currentParty().members.filter(Boolean).length ? `<p>${tr('health.remainingMembers')}</p>` : ''}${risks ? riskPanel(risks, dungeon) : ''}${adventureTab ? `<p>${tr('routine.departInSupport')}</p>` : button('dispatch', tr('dungeon.dispatch'), locked || c.phase !== 'support' || !destination || !participants.length || equipped < config.quest.minimumEquipped)}`}</section>`;
  }

  function healthLabel(hero) {
    if (hero.health === 'dead') return tr('health.dead');
    if (hero.recoverUntil > c.day) return tr('health.rest', { state: t('health.' + (hero.health === 'reviving' ? 'reviving' : hero.health === 'severe' ? 'severe' : 'light')), days: hero.recoverUntil - c.day });
    return tr('mvp.heroHealthy');
  }
  function riskPanel(risks, dungeon) {
    const percent = value => (value * 100).toFixed(1);
    return `<div class="risk-preview"><p>${tr('health.riskSummary', { danger: dungeon.danger, count: risks.members.length, funds: money(currentParty().funds), reduction: percent(risks.reduction) })}</p><ul>${risks.members.map(risk => `<li>${tr('health.riskHero', { name: heroName(risk.heroId), light: percent(risk.light), severe: percent(risk.severe), death: percent(risk.death), lightDays: risk.lightDays, severeDays: risk.severeDays })}</li>`).join('')}</ul></div>`;
  }

  function fundsControls(partyId, locked) {
    const amount = pendingFunds.get(partyId) ?? 0;
    return `<fieldset class="support-funds"><legend>${tr('mvp.fundsLabel')}</legend><input name="funds" type="hidden" value="${amount}"><output class="funds-total" data-funds-total aria-live="polite">${tr('funds.total', { amount: money(amount) })}</output><div class="funds-buttons">${[10, 100, 1000].map(increment => `<button type="button" class="mvp-button" data-funds-add="${increment}" ${locked || amount + increment > c.gold ? 'disabled' : ''}>${tr('funds.add', { amount: increment })}</button>`).join('')}<button type="button" class="mvp-button" data-funds-reset ${locked || !amount ? 'disabled' : ''}>${tr('funds.reset')}</button></div></fieldset>`;
  }

  function updateFunds(form) {
    const amount = pendingFunds.get(form.dataset.partyFunds) ?? 0;
    form.elements.funds.value = amount;
    form.querySelector('[data-funds-total]').textContent = t('funds.total', { amount: money(amount) });
    for (const node of form.querySelectorAll('[data-funds-add]')) node.disabled = amount + Number(node.dataset.fundsAdd) > c.gold;
    form.querySelector('[data-funds-reset]').disabled = amount === 0;
  }

  function growthControls(hero, locked) {
    const stats = actions.heroStats(hero.id);
    const attributes = Object.entries(stats.attributes).map(([key, amount]) => t('job.attributeValue', { attribute: t('attributes.' + key), amount })).join(t('job.attributeSeparator'));
    return `<p>${tr('growth.stats', stats)}</p><p class="hero-attributes">${attributes ? tr('job.attributes', { values: attributes }) : tr('job.noAttributes')}</p>${hero.pendingGrowth ? `<section aria-label="${tr('growth.pending', { count: hero.pendingGrowth })}"><p>${tr('growth.pending', { count: hero.pendingGrowth })}</p><p>${tr('growth.hint')}</p><div class="companion-options">${growthChoices.map(choice => button('grow', tr('growth.' + choice), locked, `data-id="${hero.id}" data-choice="${choice}"`)).join('')}</div></section>` : ''}`;
  }

  function support() {
    const locked = Boolean(c.expedition || c.trade || c.region !== 'village');
    const adventureTab = view === 'adventurers';
    return `<section class="mvp-card party-settings"><h2>${tr('party.title')}</h2>${partyEditor.render(selectedPartyId, party => `<p class="party-funds">${tr('party.funds', { amount: money(party.funds) })}</p><form data-party-funds="${party.id}">${fundsControls(party.id, locked)}<button class="mvp-button" type="submit" ${locked ? 'disabled' : ''}>${tr('party.giveFunds')}</button></form>`, !adventureTab)}</section><div class="support-layout"><div class="mvp-grid hero-detail">${c.heroes.filter(hero => hero.id === selectedHeroId).map(hero => `<article class="mvp-card"><header class="hero-heading">${actor(hero.id)}<h2>${escape(heroName(hero.id))}</h2></header><p class="hero-job">${tr('equipment.job', { job: t(config.jobs[hero.jobId].nameKey) })}</p><p class="hero-trait">${tr('job.trait', { trait: t(config.jobs[hero.jobId].traitKey) })}</p><p>${tr('dungeon.heroGrowth', { level: hero.level, experience: hero.experience, required: config.quest.levelExperience })}</p>${growthControls(hero, locked)}<p class="hero-health">${healthLabel(hero)}</p><form data-hero="${hero.id}">${equipmentEditor.render(hero, locked)}<button class="mvp-button" type="submit" ${locked ? 'disabled' : ''}>${tr('mvp.give')}</button></form><small>${tr('mvp.equippedHint', { percent: (config.usedPriceRate ?? 1) * 100 })}</small>${hero.giftedEquipment.length ? button('recoverArchived', tr('support.recoverArchived', { count: hero.giftedEquipment.length }), locked, `data-id="${hero.id}"`) : ''}</article>`).join('')}</div>${dungeonPanel(adventureTab, locked)}</div>`;
  }

  function log(entry) {
    const details = { ...entry.details };
    if (details.severity) details.severity = t('health.' + details.severity);
    if (details.dungeonId) details.dungeon = dungeonName(details.dungeonId);
    if (entry.type === 'levelUp' && details.ability === undefined) return tr('dungeon.log.levelUp', { ...details, hero: heroName(details.heroId) });
    if ('amount' in details) details.amount = money(details.amount);
    if (details.partyId) details.party = t('party.name', { number: c.parties.findIndex(party => party.id === details.partyId) + 1 });
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

  function report() {
    if (reportDay !== c.day) { reportPage = 'accounts'; reportDay = c.day; }
    const icons = config.presentation?.report?.icons;
    const icon = name => icons?.[name] ? `<img src="${escape(icons[name])}" alt="">` : '';
    const summary = c.journal.find(entry => entry.day === c.day - 1 && entry.type === 'summary');
    const totals = summary?.details ?? {};
    const row = (key, amount, art, total = false) => `<div class="report-row ${total ? 'report-total' : ''}">${icon(art)}<span>${tr('report.' + key)}</span><strong class="${amount < 0 ? 'is-negative' : total && amount > 0 ? 'is-positive' : ''}">${escape(money((amount > 0 && total ? '+' : '') + (amount || 0).toLocaleString(i18n.getLocale())))}</strong></div>`;
    const returns = c.journal.filter(entry => entry.day === c.day && ['wound','death','revival','revived','dungeonReturn','dungeonClear','villageSecured','legacyDungeonReturn','exploration','bossSuccess','bossFailure','levelUp','injury','recovered'].includes(entry.type));
    return `<article class="business-report"><h1 class="report-heading">${icon('clipboard')}<span>${tr('report.title')}</span></h1><div class="report-paper"><div class="report-date">${icon('calendar')}<strong>${escape(date(c.day))}</strong><small>${tr('report.previous')}</small></div>${reportPage === 'accounts' ? `${!summary ? `<p class="report-empty">${tr('report.first')}</p>` : ''}<section class="report-ledger" aria-label="${tr('report.accounts')}">${row('sales', totals.sales ?? 0, 'coin')}${row('purchasing', -(totals.purchasing ?? 0), 'crates')}<div class="report-row">${icon('hammer')}<span>${tr('report.residents')}</span><small>${tr('report.unrecorded')}</small></div>${row('support', -(totals.support ?? 0), 'handshake')}${totals.revival ? row('revival', -totals.revival, 'handshake') : ''}${['buyback','rewards','aid'].filter(key => totals[key]).map(key => row(key, totals[key], 'coin')).join('')}${row('net', totals.net ?? 0, 'moneybag', true)}</section><section class="report-rumors"><h2>${icon('rumor')}<span>${tr('report.rumors')}</span></h2><p>${tr('report.noRumors')}</p></section>` : `<section class="report-return"><h2>${tr('report.returns')}</h2>${returns.length ? `<ul>${returns.map(entry => `<li>${log(entry)}</li>`).join('')}</ul>` : `<p>${tr('report.noReturns')}</p>`}${c.defeated && c.gold >= config.targetGold ? departure() : ''}</section>`}<button type="button" class="report-next" data-action="reportNext">${tr(reportPage === 'accounts' ? 'report.next' : 'report.start')}<span aria-hidden="true">›</span></button></div><nav class="report-progress" aria-label="${tr('report.title')}">${['accounts','returns'].map(page => `<button type="button" data-action="reportTab" data-id="${page}" ${reportPage === page ? 'aria-current="step"' : ''}><span aria-hidden="true"></span>${tr('report.' + page)}</button>`).join('')}</nav></article>`;
  }

  function home() {
    if (c.region !== 'village') return `<section class="mvp-card mvp-complete"><p class="eyebrow">${tr('mvp.done')}</p><h2>${tr('mvp.complete')}</h2><p>${tr('mvp.completeHint')}</p><h3>${tr('mvp.openingGold', { amount: money(c.departure.openingGold) })}</h3><p>${tr('mvp.companions', { names: c.departure.heroIds.map(heroName).join('・') || t('mvp.none') })}</p><p>${tr('mvp.newTalent')}</p>${link('journal', 'mvp.go.journal')}</section>`;
    const stats = () => {
      const totals = dailyTotals(c.today);
      return `<div class="mvp-stats">${[['sales',c.today.sales],['grossProfit',totals.grossProfit],['cost',c.today.purchasing],['buyback',c.today.buyback],['supportCost',c.today.support],['health.revivalCost',c.today.revival],['reward',c.today.rewards],['aid',c.today.aid],['net',totals.net]].map(([key,amount]) => `<div><span>${tr(`mvp.${key}`)}</span><strong>${escape(money(amount))}</strong></div>`).join('')}</div>`;
    };
    if (c.phase === 'report') return report();
    if (c.phase === 'opening') return `<section class="mvp-card"><h2>${tr('routine.phase.opening')}</h2><p>${tr('routine.openReview', { count: state.shop.displayedItems.length })}</p>${!state.shop.displayedItems.length ? `<p>${tr('routine.emptyShop')}</p>` : ''}${button('open', tr('routine.open'), Boolean(c.trade || c.opened))}${c.expedition ? `<p>${tr('mvp.away', { date: date(c.expedition.returnDay) })}</p>` : ''}</section>`;
    if (c.phase === 'sales') return `${visitors()}<section class="mvp-card">${button('salesDone', tr('routine.salesDone'))}</section>`;
    if (c.phase === 'end') return `${stats()}<section class="mvp-card"><h2>${tr('routine.phase.end')}</h2>${button('nextDay', tr('mvp.nextDay'))}</section>`;
    return '';
  }

  function residents() {
    return `<section class="mvp-card church"><h2>${tr('health.church')}</h2><p>${tr('health.revivalTerms', { amount: money(config.danger.revivalCost), days: config.danger.revivalDays })}</p>${c.heroes.map(hero => `<article><h3>${escape(heroName(hero.id))}</h3><p>${healthLabel(hero)}</p>${hero.health === 'dead' ? button('revive', tr('health.revive'), Boolean(c.trade || c.region !== 'village' || c.gold < config.danger.revivalCost), `data-id="${hero.id}"`) : ''}</article>`).join('')}</section>` + `<div class="mvp-grid">${(config.residents ?? []).filter(resident => resident.id !== 'church').map(resident => `<section class="mvp-card"><h2>${tr(resident.nameKey)}</h2><p>${tr(resident.descriptionKey)}</p><small>${tr('routine.comingSoon')}</small></section>`).join('')}</div>`;
  }

  function render() {
    if (destinationDay !== c.day) { destination = ''; destinationDay = c.day; }
    if (view === 'purchase' && !c.trade && c.region === 'village') { root.innerHTML = procurement(); return; }
    if (view === 'home' && c.phase === 'report' && c.region === 'village') { root.innerHTML = report(); return; }
    root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${escape(date(c.day))}</p><h1>${tr(`mvp.title.${view}`)}</h1><p class="intro">${tr(`mvp.subtitle.${view}`)}</p></div><strong class="mvp-wallet">${escape(money(c.gold))}</strong></div><p class="mvp-status ${error ? 'is-error' : ''}" role="status" aria-live="polite">${escape(message)}</p>${({ home, purchase, support, journal, adventurers: support, residents })[view]()}`;
  }
  function announce(result) {
    error = !result.ok;
    message = result.ok ? '' : t(result.reason);
    render();
  }
  root.addEventListener('submit', event => {
    event.preventDefault();
    const partyForm = event.target.closest('form[data-party-funds]');
    if (partyForm) {
      const result = actions.fundParty(pendingFunds.get(partyForm.dataset.partyFunds) ?? 0, partyForm.dataset.partyFunds);
      if (result.ok) pendingFunds.delete(partyForm.dataset.partyFunds);
      announce(result);
      return;
    }
    const form = event.target.closest('form[data-hero]');
    if (!form) return;
    const changes = equipmentEditor.changes();
    const result = actions.support(form.dataset.hero, changes);
    announce(result);
  }, { signal: events.signal });
  root.addEventListener('change', event => {
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
    const quantity = event.target.closest('[data-procurement-change]');
    if (quantity && !quantity.disabled) {
      const id = quantity.dataset.id;
      const previous = procurementLots.get(id) ?? 0;
      procurementLots.set(id, Math.max(0, previous + Number(quantity.dataset.procurementChange)));
      render();
      root.querySelector(`[data-procurement-change="${quantity.dataset.procurementChange}"][data-id="${id}"]`)?.focus({ preventScroll: true });
      return;
    }
    const fundsButton = event.target.closest('[data-funds-add], [data-funds-reset]');
    if (fundsButton) {
      const form = fundsButton.closest('form[data-party-funds]');
      if (!form || fundsButton.disabled || c.expedition || c.trade || c.region !== 'village') return;
      const increment = Number(fundsButton.dataset.fundsAdd);
      const amount = pendingFunds.get(form.dataset.partyFunds) ?? 0;
      if (fundsButton.hasAttribute('data-funds-reset')) pendingFunds.delete(form.dataset.partyFunds);
      else {
        if (![10, 100, 1000].includes(increment) || amount + increment > c.gold) return;
        pendingFunds.set(form.dataset.partyFunds, amount + increment);
      }
      updateFunds(form);
      return;
    }

    const point = event.target.closest('[data-destination]');
    if (point) {
      const status = actions.dungeonStatus(point.dataset.destination);
      if (!point.disabled && status?.unlocked && !status.cleared && !c.expedition) { destination = point.dataset.destination; render(); }
      return;
    }
    const partySelection = event.target.closest('[data-expedition-party]');
    if (partySelection) {
      if (!partySelection.disabled && c.parties.some(party => party.id === partySelection.dataset.expeditionParty)) { selectedPartyId = partySelection.dataset.expeditionParty; render(); }
      return;
    }
    const selection = event.target.closest('[data-select-hero]');
    if (selection) { selectedHeroId = selection.dataset.selectHero; render(); root.querySelector(`[data-select-hero="${selectedHeroId}"]`)?.focus({ preventScroll: true }); return; }
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    if (target.dataset.action === 'procurementSkip') {
      const result = actions.advancePhase();
      if (result.ok) procurementLots.clear();
      announce(result); return;
    }
    if (target.dataset.action === 'procurementBack') { announce(actions.previousPhase()); return; }
    if (target.dataset.action === 'procurementConfirm') {
      const result = actions.startProcurement(procurementSelections());
      if (result.ok) procurementLots.clear();
      announce(result); return;
    }
    if (target.dataset.action === 'reportTab') { reportPage = target.dataset.id; render(); return; }
    if (target.dataset.action === 'reportNext') {
      if (reportPage === 'accounts') { reportPage = 'returns'; render(); }
      else announce(actions.advancePhase());
      return;
    }
    const id = target.dataset.id;
    const operations = { revive: () => actions.revive(id), grow: () => actions.grow(id, target.dataset.choice), recoverArchived: () => actions.recoverArchivedEquipment(id), buy: () => actions.startTrade(id, amounts.get(id)), keep: () => actions.keep(id), sellBack: () => actions.sellBack(id, target.dataset.source), finishTrade: actions.finishTrade, open: actions.openShop, nextDay: actions.nextDay, relief: actions.relief, salesDone: actions.advancePhase, dispatch: () => view === 'support' && c.phase === 'support' && destination ? actions.dispatch(destination, selectedPartyId) : ({ ok: false, reason: 'mvp.error.phase' }), depart: () => actions.depart([...companionIds]) };
    announce(operations[target.dataset.action]());
  }, { signal: events.signal });
  render();
  return { render, destroy: () => { partyEditor.destroy(); equipmentEditor.destroy(); events.abort(); } };
}
