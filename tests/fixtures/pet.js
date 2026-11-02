// Test-only content with unrelated IDs proves systems do not rely on fantasy products.
export function petFixture() {
  return {
    id: "test-pet-shop", contentVersion: 1,
    itemDefinitions: {
      pet_brush: { id: "pet_brush", categoryKey: "care", materialKey: "wood", width: 2, height: 3, shape: [[1, 1], [1, 0], [1, 0]], price: 100 },
      pet_treat: { id: "pet_treat", categoryKey: "food", materialKey: "food", width: 1, height: 1, price: 20 },
    },
    presentation: { pet_brush: { glyph: "🪮" }, pet_treat: { glyph: "🍪" } },
    locales: { ja: {
      "app.title": "PET SHOP", "app.homeLabel": "ペットショップ ホーム", "app.brand": "PET SHOP", "app.storeName": "ペットグッズショップ",
      "warehouse.eyebrow": "BACKROOM", "stocking.eyebrow": "SHOP FLOOR",
      "money.amount": "{amount} 円", "warehouse.selectedMeta": "{category} · {material}<br>{width} × {height} マス · {price}",
      "items.pet_brush": "ペットブラシ", "items.short.pet_brush": "ブラシ",
      "items.pet_treat": "おやつ", "items.short.pet_treat": "おやつ",
      "categories.care": "お手入れ", "categories.food": "フード",
      "materials.wood": "木", "materials.food": "食品",
    } },
    initialState: {
      warehouse: { columns: 8, rows: 8, items: [
        { instanceId: "brush-1", itemId: "pet_brush", x: 0, y: 0, rotated: 0 },
        { instanceId: "treat-1", itemId: "pet_treat", x: 3, y: 0, rotated: 0 },
      ] }, shop: { columns: 5, rows: 5, displayedItems: [] },
    }, theme: {},
  };
}

