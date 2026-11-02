import { buybackPrice, drawDelivery } from "../systems/gacha.js";
import { sellToCustomers, dailyTotals } from "../systems/sales.js";
import { successChance, departureQuote, planExpedition, resolveExpedition } from "../systems/expeditions.js";
import { addJournal } from "../systems/journal.js";

export function createCampaignActions(state, config, definitions, inventory, commit) {
  const c = state.campaign;
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
    chance: () => successChance(c.heroes, config, c.heroes.reduce((sum, hero) => sum + hero.funds, 0), c.progress, c.progress >= 100 ? "boss" : "explore"),
    buyback: itemId => merchant() ? buybackPrice(definitions[itemId], merchant()) : 0,
    startTrade(id) {
      const seller = config.merchants.find(entry => entry.id === id);
      if (!ready() || !seller) return fail("trade");
      if (c.gold < seller.cost) return fail("money");
      c.gold -= seller.cost;
      c.today.purchasing += seller.cost;
      c.trade = { merchantId: id, incoming: drawDelivery(c, definitions, seller) };
      c.milestones.purchased = true;
      addJournal(state, "purchase", { merchantId: id, amount: seller.cost, count: seller.count });
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
      const amount = buybackPrice(definitions[item.itemId], merchant());
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
      if (!state.shop.displayedItems.length) return fail("shelf");
      const { receipts, visits } = sellToCustomers(state, definitions, config);
      c.opened = true;
      if (receipts.length) c.milestones.sold = true;
      c.customerVisits = visits;
      for (const visit of visits) {
        addJournal(state, "visit", { customerId: visit.customerId, dialogueKey: visit.dialogueKey });
        if (visit.purchase) addJournal(state, "sale", visit.purchase);
      }
      if (!receipts.length) addJournal(state, "noSale");
      return commit({ ok: true });
    },
    support(heroId, instanceId, amount = 0) {
      const hero = c.heroes.find(hero => hero.id === heroId);
      if (!ready() || c.expedition || !hero) return fail("away");
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > c.gold) return fail("money");
      const item = instanceId ? state.warehouse.items.find(item => item.instanceId === instanceId) : null;
      if (instanceId && (!item || !config.itemSlots[item.itemId])) return fail("equipment");
      if (!item && !amount) return fail("emptySupport");
      if (item) {
        state.warehouse.items.splice(state.warehouse.items.indexOf(item), 1);
        const slot = config.itemSlots[item.itemId];
        if (hero.equipment[slot]) hero.giftedEquipment.push(hero.equipment[slot]);
        hero.equipment[slot] = { ...item };
      }
      c.gold -= amount;
      c.today.support += amount;
      hero.funds += amount;
      c.milestones.supported = true;
      addJournal(state, "support", { heroId, itemId: item?.itemId ?? null, amount });
      return commit({ ok: true });
    },
    dispatch(kind = c.progress >= 100 ? "boss" : "explore") {
      if (!ready() || c.expedition || c.defeated) return fail("away");
      if (!["explore", "boss"].includes(kind) || (kind === "boss") !== (c.progress >= 100)) return fail("bossLocked");
      if (c.heroes.some(hero => hero.recoverUntil > c.day)) return fail("recovering");
      const funds = c.heroes.reduce((sum, hero) => sum + hero.funds, 0);
      if (funds < config.quest.minimumFunds || c.heroes.filter(hero => Object.keys(hero.equipment).length > 0).length < config.quest.minimumEquipped) return fail("preparation");
      c.expedition = planExpedition(c, config, kind);
      for (const hero of c.heroes) hero.funds = 0;
      addJournal(state, "dispatch", { questId: config.quest.id, kind, returnDay: c.expedition.returnDay, chance: Math.round(c.expedition.chance * 100) });
      return commit({ ok: true });
    },
    nextDay() {
      if (!ready()) return fail("trade");
      addJournal(state, "summary", { ...c.today, ...dailyTotals(c.today) });
      c.day += 1;
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
