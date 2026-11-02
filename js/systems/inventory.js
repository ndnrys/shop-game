export function createInventorySystem(itemDefinitions) {
  // Legacy booleans represent 0° / 90°; numeric values store all four orientations.
  function turns(rotated = false) {
    return ((Number(rotated) % 4) + 4) % 4;
  }

  function dimensions(item, rotated = item.rotated) {
    const definition = itemDefinitions[item.itemId];
    return turns(rotated) % 2
      ? { width: definition.height, height: definition.width }
      : { width: definition.width, height: definition.height };
  }

  // Coordinates are relative to the bounding box. Missing shape means a full rectangle.
  function itemCells(item, rotated = item.rotated) {
    const definition = itemDefinitions[item.itemId];
    let cells = [];
    for (let y = 0; y < definition.height; y += 1) {
      for (let x = 0; x < definition.width; x += 1) {
        if (!definition.shape || definition.shape[y][x]) cells.push({ x, y });
      }
    }
    let height = definition.height;
    let width = definition.width;
    for (let turn = 0; turn < turns(rotated); turn += 1) {
      cells = cells.map(({ x, y }) => ({ x: height - 1 - y, y: x }));
      [width, height] = [height, width];
    }
    return cells;
  }

  function canPlace(items, itemId, x, y, rotated, columns, rows, ignoredInstanceId = null) {
    if (!itemDefinitions[itemId] || !Number.isInteger(x) || !Number.isInteger(y)) return false;
    const cells = itemCells({ itemId, rotated }).map((cell) => ({ x: x + cell.x, y: y + cell.y }));
    if (cells.some((cell) => cell.x < 0 || cell.y < 0 || cell.x >= columns || cell.y >= rows)) return false;
    const occupied = new Set();
    for (const other of items) {
      if (other.instanceId === ignoredInstanceId) continue;
      for (const cell of itemCells(other)) occupied.add(`${other.x + cell.x},${other.y + cell.y}`);
    }
    return cells.every((cell) => !occupied.has(`${cell.x},${cell.y}`));
  }

  function rotateItem(items, instanceId, columns, rows) {
    const item = items.find((entry) => entry.instanceId === instanceId);
    if (!item) return { ok: false, reason: "warehouse.itemMissing" };
    const rotated = (turns(item.rotated) + 1) % 4;
    const original = { x: item.x, y: item.y };
    if (canPlace(items, item.itemId, item.x, item.y, rotated, columns, rows, instanceId)) {
      item.rotated = rotated;
      return { ok: true, item, repositioned: false };
    }

    const candidates = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        if (canPlace(items, item.itemId, x, y, rotated, columns, rows, instanceId)) {
          candidates.push({ x, y, distance: Math.abs(x - original.x) + Math.abs(y - original.y) });
        }
      }
    }
    candidates.sort((a, b) => a.distance - b.distance
      || Math.abs(a.y - original.y) - Math.abs(b.y - original.y)
      || a.x - b.x);
    if (!candidates.length) {
      return { ok: false, reason: "warehouse.rotateBlocked" };
    }

    item.x = candidates[0].x;
    item.y = candidates[0].y;
    item.rotated = rotated;
    return { ok: true, item, repositioned: true };
  }

  function moveItem(items, instanceId, x, y, columns, rows) {
    const item = items.find((entry) => entry.instanceId === instanceId);
    if (!item) return { ok: false, reason: "warehouse.itemMissing" };
    if (!canPlace(items, item.itemId, x, y, item.rotated, columns, rows, instanceId)) {
      return { ok: false, reason: "warehouse.moveInvalid" };
    }
    item.x = x;
    item.y = y;
    return { ok: true, item };
  }

  function findOpenPosition(items, item, preferredX, preferredY, columns, rows) {
    const candidates = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        if (canPlace(items, item.itemId, x, y, item.rotated, columns, rows)) {
          candidates.push({ x, y, distance: Math.abs(x - preferredX) + Math.abs(y - preferredY) });
        }
      }
    }
    candidates.sort((a, b) => a.distance - b.distance
      || Math.abs(a.y - preferredY) - Math.abs(b.y - preferredY)
      || a.x - b.x);
    return candidates[0] ?? null;
  }

  return { dimensions, itemCells, canPlace, rotateItem, moveItem, findOpenPosition };
}
