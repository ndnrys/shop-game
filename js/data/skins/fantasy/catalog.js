export const itemDefinitions = {
  // Prototype axe: the broad blade occupies the top row, the handle the left column.
  iron_axe: { id: "iron_axe", categoryKey: "weapon", width: 2, height: 3, shape: [[1, 1], [1, 0], [1, 0]], price: 100, rarity: "common", materialKey: "iron" },
  iron_sword: { id: "iron_sword", categoryKey: "weapon", width: 1, height: 3, price: 100, rarity: "common", materialKey: "iron" },
  potion: { id: "potion", categoryKey: "medicine", width: 2, height: 2, price: 45, rarity: "common", materialKey: "herb" },
  oak_shield: { id: "oak_shield", categoryKey: "armor", width: 2, height: 3, price: 80, rarity: "common", materialKey: "oak" },
  crystal: { id: "crystal", categoryKey: "material", width: 1, height: 1, price: 130, rarity: "uncommon", materialKey: "magicCrystal" },
  herb_bundle: { id: "herb_bundle", categoryKey: "material", width: 2, height: 1, price: 20, rarity: "common", materialKey: "herb" },
  leather_armor: { id: "leather_armor", categoryKey: "armor", width: 2, height: 3, price: 120, rarity: "common", materialKey: "leather" },
  silver_ring: { id: "silver_ring", categoryKey: "accessory", width: 1, height: 1, price: 95, rarity: "uncommon", materialKey: "silver" },
  bread: { id: "bread", categoryKey: "food", width: 2, height: 1, price: 15, rarity: "common", materialKey: "wheat" },
};

export const startingInventory = [
  { instanceId: "stock-009", itemId: "iron_axe", x: 6, y: 4, rotated: false },
  { instanceId: "stock-001", itemId: "iron_sword", x: 0, y: 0, rotated: false },
  { instanceId: "stock-002", itemId: "potion", x: 1, y: 0, rotated: false },
  { instanceId: "stock-003", itemId: "oak_shield", x: 3, y: 0, rotated: false },
  { instanceId: "stock-004", itemId: "crystal", x: 6, y: 0, rotated: false },
  { instanceId: "stock-005", itemId: "herb_bundle", x: 0, y: 3, rotated: false },
  { instanceId: "stock-006", itemId: "leather_armor", x: 2, y: 3, rotated: false },
  { instanceId: "stock-007", itemId: "silver_ring", x: 4, y: 3, rotated: false },
  { instanceId: "stock-008", itemId: "bread", x: 5, y: 3, rotated: false },
];
