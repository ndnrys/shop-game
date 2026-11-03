import { setPartyMembers, assignPartyMember, fundParty, createParty } from "../systems/party.js";
import { growHero } from "../systems/growth.js";
import { exchangeEquipment } from "../systems/equipment.js";
import { itemPrice } from "../systems/pricing.js";
import { buybackPrice, drawDelivery, deliveryQuote } from "../systems/gacha.js";
import { sellToCustomers, dailyTotals } from "../systems/sales.js";
import { successChance, departureQuote, planExpedition, resolveExpedition } from "../systems/expeditions.js";
import { addJournal } from "../systems/journal.js";

export function createCampaignActions(state, config, definitions, inventory, commit) {
  const c = state.campaign;
  c.phase ??= c.opened ? "sales" : c.trade ? "purchase" : "report";
  const partyData = id => c.parties.find(entry => entry.id === (id ?? c.parties[0].id));
  const party = id => (partyData(id)?.members ?? []).filter(Boolean).map(heroId => c.heroes.find(hero => hero.id === heroId));
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
  return {
    config,
    quote: ids => departureQuote(c, config, ids),
    chance: partyId => successChance(party(partyId), config, partyData(partyId)?.funds ?? 0, c.progress, c.progress >= 100 ? "boss" : "explore"),
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
    grow(heroId, choice) {
      if (!ready() || c.expedition) return fail("away");
      return commit(growHero(c, c.heroes.find(hero => hero.id === heroId), choice));
    },
    setParty(ids, partyId = c.parties[0].id) {
      if (!ready() || c.expedition) return fail("away");
      return commit(setPartyMembers(c, config, partyId, ids));
    },
    assignPartySlot(partyId, index, heroId) {
      if (!ready() || c.expedition) return fail("away");
      return commit(assignPartyMember(c, config, partyId, index, heroId));
    },
    createParty() {
      if (!ready() || c.expedition) return fail("away");
      return commit(createParty(c, config));
    },
    fundParty(amount, partyId = c.parties[0].id) {
      if (!ready() || c.expedition) return fail("away");
      const result = fundParty(c, partyId, amount);
      if (result.ok) addJournal(state, "partySupport", { amount, partyId });
      return commit(result);
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
      c.trade = null;
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
      const recipient = c.parties.find(entry => entry.members.includes(heroId)) ?? c.parties[0];
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > c.gold || !Number.isSafeInteger(recipient.funds + amount)) return fail("money");
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
      recipient.funds += amount;
      c.milestones.supported = true;
      for (const item of result.returned) addJournal(state, "returnEquipment", { heroId, itemId: item.itemId });
      for (const item of result.incoming) addJournal(state, "support", { heroId, itemId: item.itemId, amount: 0 });
      if (amount) addJournal(state, "partySupport", { amount, partyId: recipient.id });
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
    dispatch(kind = c.progress >= 100 ? "boss" : "explore", partyId = c.parties[0].id) {
      if (!ready() || c.expedition || c.defeated) return fail("away");
      if (!["explore", "boss"].includes(kind) || (kind === "boss") !== (c.progress >= 100)) return fail("bossLocked");
      if (!party(partyId).length) return fail("party");
      if (party(partyId).some(hero => hero.recoverUntil > c.day)) return fail("recovering");
      const funds = partyData(partyId).funds;
      if (funds < config.quest.minimumFunds || party(partyId).filter(hero => Object.keys(hero.equipment).length > 0).length < config.quest.minimumEquipped) return fail("preparation");
      c.expedition = planExpedition(c, config, kind, partyId);
      partyData(partyId).funds = 0;
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
