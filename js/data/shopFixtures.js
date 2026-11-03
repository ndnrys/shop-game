// Provisional capacities and additive purchase probability bonuses.
export const fixtureDefinitions = {
  normal: { capacity: 8, bonus: 0, adjacentBonus: 0, icon: "▤" },
  special: { capacity: 6, bonus: .1, adjacentBonus: 0, icon: "✦" },
  equipment: { capacity: 0, bonus: 0, adjacentBonus: .05, icon: "✧" },
  counter: { capacity: 0, bonus: 0, adjacentBonus: 0, icon: "▰" },
};
export function initializeShop(shop) {
  if (shop.fixtures) return;
  shop.fixtures = [];
  // Preserve every legacy instance; allocate enough shelves even for a full old board.
  for (let i = 0; i < Math.max(1, Math.ceil(shop.displayedItems.length / 8)); i++) {
    shop.fixtures.push({ id: `fixture-${i+1}`, type: "normal", x: i % shop.columns, y: Math.floor(i / shop.columns) });
  }
  shop.displayedItems.forEach((item,i) => { item.shelfId = shop.fixtures[Math.floor(i/8)].id; });
}
