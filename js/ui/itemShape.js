// Only occupied cells receive pointer events, so holes expose the board or other items.
export function applyItemShape(element, item, game, preview = false) {
  const { itemDefinitions } = game;
  const { dimensions, itemCells } = game.inventory;
  if (!itemDefinitions[item.itemId].shape) return;
  const { width, height } = dimensions(item);
  const content = [...element.childNodes];
  element.replaceChildren();
  element.classList.add("shaped-item");
  element.style.setProperty("--shape-columns", width);
  element.style.setProperty("--shape-rows", height);
  for (const cell of itemCells(item)) {
    const part = document.createElement("span");
    part.className = "shape-cell";
    part.style.gridColumn = cell.x + 1;
    part.style.gridRow = cell.y + 1;
    part.setAttribute("aria-hidden", "true");
    element.append(part);
  }
  if (!preview) {
    const art = document.createElement('span');
    art.className = 'shape-art';
    art.setAttribute('aria-hidden', 'true');
    art.append(...content);
    element.append(art);
  }
}
