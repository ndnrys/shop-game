import { fixtureBonus } from "./stores.js";
import { itemPrice } from "./pricing.js";
import { random } from "./random.js";

// External customers buy only shelf stock; supporters never generate shop revenue.
export function sellToCustomers(state, definitions, config) {
  const receipts = [];
  const visits = [];
  for (const customer of config.customers) {
    const visit = { customerId: customer.id, dialogueKey: customer.dialogueKey, purchase: null };
    visits.push(visit);
    const eligible = state.shop.displayedItems.filter(item => {
      const definition = definitions[item.itemId];
      return customer.categories.includes(definition.categoryKey) && itemPrice(definition, item, config.usedPriceRate) <= customer.budget;
    });
    if (!eligible.length) continue;
    const roll = random(state.campaign);
    const purchasable = eligible.filter(item => roll < Math.min(1, config.purchaseChance + fixtureBonus(state.shop, item.shelfId)));
    if (!purchasable.length) continue;
    const item = purchasable[Math.floor(random(state.campaign) * purchasable.length)];
    const amount = itemPrice(definitions[item.itemId], item, config.usedPriceRate);
    state.shop.displayedItems.splice(state.shop.displayedItems.indexOf(item), 1);
    state.campaign.gold += amount;
    state.campaign.today.sales += amount;
    state.campaign.today.cogs += item.purchaseCost ?? 0;
    visit.purchase = { customerId: customer.id, itemId: item.itemId, amount, cost: item.purchaseCost ?? 0 };
    receipts.push(visit.purchase);
  }
  return { receipts, visits };
}

export function dailyTotals(today) {
  return {
    grossProfit: today.sales - (today.cogs ?? 0),
    net: today.sales + today.buyback + today.rewards + today.aid - today.purchasing - today.support - (today.revival ?? 0),
  };
}
