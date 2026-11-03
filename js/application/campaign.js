import { exchangeEquipment } from "../systems/equipment.js";
import { itemPrice } from "../systems/pricing.js";
import { buybackPrice, drawDelivery, deliveryQuote } from "../systems/gacha.js";
import { sellToCustomers, dailyTotals } from "../systems/sales.js";
import { successChance, departureQuote, planExpedition, resolveExpedition } from "../systems/expeditions.js";
import { addJournal } from "../systems/journal.js";

export function createCampaignActions(state, config, definitions, inventory, commit) {
  const c = state.campaign;
  c.phase ??= c.opened ? "sales" : c.trade ? "purchase" : "report";
  c.partyIds ??= c.heroes.map(hero => hero.id);
  const party = () => c.heroes.filter(hero => c.partyIds.includes(hero.id));
  const fail = reason => ({ ok: false, reason: `mvp.error.${reason}` });
  const ready = () => c.region === "village" && !c.trade;
  const merchant = () => config.merchants.find(entry => entry.id === c.trade?.merchantId);
  function storePosition(items, item) {
    for (const rotated of [item.rotated, 0, 1, 2, 3]) {
      const position = inventory.findOpenPosition(items, { ...item, rotated }, 0, 0, state.warehouse.columns, state.warehouse.rows);
      if (position) return { x: position.x, y: position.y, rotated };
    }
    return null;
  }
  function procurementQuote(selections) {
    if (!Array.isArray(selections) || !selections.length || selections.length > config.merchants.length) return { valid: false, amount: 0, count: 0, lots: 0 };
    const ids = new Set();
    let amount = 0, count = 0, lots = 0;
    for (const selection of selections) {
      const seller = config.merchants.find(entry => entry.id === selection?.merchantId);
      if (!seller || ids.has(seller.id) || !Number.isSafeInteger(selection.lots) || selection.lots <= 0) return { valid: false, amount: 0, count: 0, lots: 0 };
      ids.add(seller.id);
      const quote = deliveryQuote(seller, seller.cost * selection.lots);
      if (!quote.valid) return { valid: false, amount: 0, count: 0, lots: 0 };
      amount += quote.amount; count += quote.count; lots += selection.lots;
    }
    return { valid: Number.isSafeInteger(amount) && count <= 1000, amount, count, lots };
  }
  function startProcurement(selections) {
    if (!ready()) return fail('trade');
    const quote = procurementQuote(selections);
    if (!quote.valid || c.gold < quote.amount) return fail('money');
    const trades = selections.map(selection => {
      const seller = config.merchants.find(entry => entry.id === selection.merchantId);
      const amount = seller.cost * selection.lots;
      const count = seller.count * selection.lots;
      const incoming = drawDelivery(c, definitions, { ...seller, cost: amount, count });
      addJournal(state, 'purchase', { merchantId: seller.id, amount, count });
      return { merchantId: seller.id, incoming };
    });
    c.gold -= quote.amount;
    c.today.purchasing += quote.amount;
    c.trade = { ...trades[0], pending: trades.slice(1) };
    c.milestones.purchased = true;
    return commit({ ok: true });
  }
  return {
    config,
    procurementQuote,
    startProcurement,
    quote: ids => departureQuote(c, config, ids),
    chance: () => successChance(party(), config, party().reduce((sum, hero) => sum + hero.funds, 0), c.progress, c.progress >= 100 ? "boss" : "explore"),
    buyback: value => {
      const item = typeof value === 'string' ? { itemId: value } : value;
      return merchant() ? buybackPrice(definitions[item.itemId], merchant(), itemPrice(definitions[item.itemId], item, config.usedPriceRate)) : 0;
    },
    deliveryQuote: (id, amount) => deliveryQuote(config.merchants.find(entry => entry.id === id), amount),
    advancePhase() {
      if (!ready()) return fail("trade");
      const phases = ["report", "purchase", "warehouse", "stocking", "support", "opening", "sales", "end"];
      const index = phases.indexOf(c.phase);
      if (index < 0 || index >= phases.length - 1 || c.phase === "opening") return fail("phase");
      c.phase = phases[index + 1];
      return commit({ ok: true });
    },
    previousPhase() {
      if (!ready() || c.opened) return fail("phase");
      const phases = ["report", "purchase", "warehouse", "stocking", "support", "opening"];
      const index = phases.indexOf(c.phase);
      if (index <= 0) return fail("phase");
      c.phase = phases[index - 1];
      return commit({ ok: true });
    },
    setParty(ids) {
      if (!ready() || c.expedition) return fail("away");
      if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !c.heroes.some(hero => hero.id === id))) return fail("party");
      c.partyIds = [...ids];
      return commit({ ok: true });
    },
    startTrade(id, amount) {
      const seller = config.merchants.find(entry => entry.id === id);
      if (!ready() || !seller) return fail("trade");
      const quote = deliveryQuote(seller, amount ?? seller.cost);
      if (!quote.valid || c.gold < quote.amount) return fail("money");
      c.gold -= quote.amount;
      c.today.purchasing += quote.amount;
      c.trade = { merchantId: id, incoming: drawDelivery(c, definitions, { ...seller, cost: quote.amount, count: quote.count }) };
      c.milestones.purchased = true;
      addJournal(state, "purchase", { merchantId: id, amount: quote.amount, count: quote.count });
      return commit({ ok: true });
    },
    keep(instanceId) {
      const item = c.trade?.incoming.find(item => item.instanceId === instanceId);
      if (!item) return fail("trade");
      const position = storePosition(state.warehouse.items, item);
      if (!position) return fail("full");
      c.trade.incoming.splice(c.trade.incoming.indexOf(item), 1);
      state.warehouse.items.push({ ...item, ...position });
      return commit({ ok: true });
    },
    sellBack(instanceId, source) {
      if (!c.trade || !["incoming", "warehouse"].includes(source)) return fail("trade");
      const items = source === "incoming" ? c.trade.incoming : state.warehouse.items;
      const item = items.find(item => item.instanceId === instanceId);
      if (!item) return fail("item");
      const amount = buybackPrice(definitions[item.itemId], merchant(), itemPrice(definitions[item.itemId], item, config.usedPriceRate));
      items.splice(items.indexOf(item), 1);
      c.gold += amount;
      c.today.buyback += amount;
      addJournal(state, "buyback", { merchantId: merchant().id, itemId: item.itemId, amount });
      return commit({ ok: true });
    },
    finishTrade() {
      if (!c.trade || c.trade.incoming.length) return fail("incoming");
      const [next, ...pending] = c.trade.pending ?? [];
      c.trade = next ? { ...next, pending } : null;
      return commit({ ok: true });
    },
    openShop() {
      if (!ready() || c.opened) return fail("opened");
      const { receipts, visits } = sellToCustomers(state, definitions, config);
      c.opened = true;
      c.phase = "sales";
      if (receipts.length) c.milestones.sold = true;
      c.customerVisits = visits;
      for (const visit of visits) {
        addJournal(state, "visit", { customerId: visit.customerId, dialogueKey: visit.dialogueKey });
        if (visit.purchase) addJournal(state, "sale", visit.purchase);
      }
      if (!receipts.length) addJournal(state, "noSale");
      return commit({ ok: true });
    },
    support(heroId, selection, amount = 0) {
      const hero = c.heroes.find(hero => hero.id === heroId);
      if (!ready() || c.expedition || !hero) return fail("away");
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > c.gold) return fail("money");
      // Keep the single-item command for existing callers and simulations.
      let changes = selection ?? {};
      if (typeof selection === 'string') {
        const item = state.warehouse.items.find(item => item.instanceId === selection);
        if (!item || !config.itemSlots[item.itemId]) return fail("equipment");
        changes = { [config.itemSlots[item.itemId]]: selection };
      }
      const result = exchangeEquipment(state, hero, changes, config, inventory);
      if (!result.ok) return result;
      if (!result.incoming.length && !result.returned.length && !amount) return fail("emptySupport");
      state.warehouse.items = result.items;
      hero.equipment = result.equipment;
      c.gold -= amount;
      c.today.support += amount;
      hero.funds += amount;
      c.milestones.supported = true;
      for (const item of result.returned) addJournal(state, "returnEquipment", { heroId, itemId: item.itemId });
      for (const [index, item] of result.incoming.entries()) addJournal(state, "support", { heroId, itemId: item.itemId, amount: index === 0 ? amount : 0 });
      if (!result.incoming.length && amount) addJournal(state, "support", { heroId, itemId: null, amount });
      return commit({ ok: true });
    },
    recoverArchivedEquipment(heroId) {
      const hero = c.heroes.find(hero => hero.id === heroId);
      if (!ready() || c.expedition || !hero) return fail("away");
      if (!hero.giftedEquipment.length) return fail("equipment");
      const result = exchangeEquipment(state, hero, {}, config, inventory, true);
      if (!result.ok) return result;
      state.warehouse.items = result.items;
      hero.giftedEquipment = [];
      for (const item of result.returned) addJournal(state, "returnEquipment", { heroId, itemId: item.itemId });
      return commit({ ok: true });
    },
    dispatch(kind = c.progress >= 100 ? "boss" : "explore") {
      if (!ready() || c.expedition || c.defeated) return fail("away");
      if (!["explore", "boss"].includes(kind) || (kind === "boss") !== (c.progress >= 100)) return fail("bossLocked");
      if (!party().length) return fail("party");
      if (party().some(hero => hero.recoverUntil > c.day)) return fail("recovering");
      const funds = party().reduce((sum, hero) => sum + hero.funds, 0);
      if (funds < config.quest.minimumFunds || party().filter(hero => Object.keys(hero.equipment).length > 0).length < config.quest.minimumEquipped) return fail("preparation");
      c.expedition = planExpedition(c, config, kind);
      for (const hero of party()) hero.funds = 0;
      addJournal(state, "dispatch", { questId: config.quest.id, kind, returnDay: c.expedition.returnDay, chance: Math.round(c.expedition.chance * 100) });
      return commit({ ok: true });
    },
    nextDay() {
      if (!ready()) return fail("trade");
      addJournal(state, "summary", { ...c.today, ...dailyTotals(c.today) });
      c.day += 1;
      c.phase = "report";
      c.opened = false;
      c.customerVisits = [];
      c.today = { sales: 0, cogs: 0, purchasing: 0, buyback: 0, support: 0, rewards: 0, aid: 0 };
      for (const hero of c.heroes) {
        if (hero.recoverUntil === c.day) addJournal(state, "recovered", { heroId: hero.id });
      }
      if (c.expedition && c.day >= c.expedition.returnDay) {
        for (const event of resolveExpedition(c, config)) addJournal(state, event.type, event.details);
        // Returning injuries start today; earlier injuries finish independently of missions.

      }
      return commit({ ok: true });
    },
    relief() {
      if (!ready() || c.aidDay === c.day || c.gold >= Math.min(...config.merchants.map(merchant => merchant.cost))) return fail("aid");
      c.gold += config.aidAmount;
      c.today.aid += config.aidAmount;
      c.aidDay = c.day;
      addJournal(state, "aid", { amount: config.aidAmount });
      return commit({ ok: true });
    },
    depart(ids) {
      const quote = departureQuote(c, config, ids);
      if (!ready() || !c.defeated || c.gold < config.targetGold || c.expedition || !quote.valid || quote.openingGold < 0) return fail("departure");
      const companions = structuredClone(c.heroes.filter(hero => ids.includes(hero.id)));
      c.departure = { ...quote, targetGold: config.targetGold, heroIds: [...ids], companions, villageGold: c.gold, day: c.day };
      addJournal(state, "departure", { count: ids.length, amount: quote.openingGold });
      c.gold = quote.openingGold;
      c.region = "next-town";
      return commit({ ok: true });
    },
  };
}
