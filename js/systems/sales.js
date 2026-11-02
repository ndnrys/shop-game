import { random } from "./random.js";

// External customers buy only shelf stock; supporters never generate shop revenue.
export function sellToCustomers(state, definitions, config) {
  const receipts = [];
  for (const customer of config.customers) {
    const eligible = state.shop.displayedItems.filter(item => {
      const definition = definitions[item.itemId];
      return customer.categories.includes(definition.categoryKey) && definition.price <= customer.budget;
    });
    if (!eligible.length || random(state.campaign) >= config.purchaseChance) continue;
    const item = eligible[Math.floor(random(state.campaign) * eligible.length)];
    const amount = definitions[item.itemId].price;
    state.shop.displayedItems.splice(state.shop.displayedItems.indexOf(item), 1);
    state.campaign.gold += amount;
    state.campaign.today.sales += amount;
    receipts.push({ customerId: customer.id, itemId: item.itemId, amount });
  }
  return receipts;
}
