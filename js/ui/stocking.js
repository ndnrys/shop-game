import { itemArt } from "./itemArt.js";
import { applyItemShape } from "./itemShape.js";

export function mountStocking(root, game) {
  const state = game.state;
  const { itemDefinitions, presentation } = game;
  const { canPlace, dimensions } = game.inventory;
  const { itemName, itemShortName, t } = game.i18n;
  const actions = game.stocking;
  const ui = { selectedInstanceId: null, selectedStockInstanceId: null };
  const events = new AbortController();
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: events.signal });
  const availableList = root.querySelector("#available-stock");
  const board = root.querySelector("#shop-board");
  const displayedCount = root.querySelector("#displayed-count");
  const selection = root.querySelector("#stocking-selection");
  const status = root.querySelector("#stocking-status");
  const returnButton = root.querySelector("#return-stock-button");
  const HOLD_DELAY = 100;

  let activePointer = null;
  let holdTimer = null;
  let drag = null;
  let suppressClick = false;
  let suppressTimer = null;

  function groupItems(items) {
    const groups = new Map();
    for (const item of items) {
      const key = groupKey(item);
      const group = groups.get(key) ?? { key, item, quantity: 0 };
      group.quantity += 1;
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  function groupKey(item) {
    return `${item.itemId}:${item.material ?? ""}:${item.rarity ?? ""}`;
  }

  function announce(key) {
    status.textContent = t(key);
  }

  function selectedShopItem(state) {
    return state.shop.displayedItems.find((item) => item.instanceId === ui.selectedInstanceId) ?? null;
  }

  function renderAvailableItems(state) {
    availableList.replaceChildren();
    const groups = groupItems(state.warehouse.items);
    if (!groups.length) {
      const empty = document.createElement("p");
      empty.className = "stock-empty";
      empty.textContent = t("stocking.availableEmpty");
      availableList.append(empty);
      return;
    }

    for (const group of groups) {
      const { item, quantity } = group;
      const definition = itemDefinitions[item.itemId];
      const card = document.createElement("article");
      card.className = `stock-card${ui.selectedStockInstanceId === item.instanceId ? " is-selected" : ""}`;
      card.innerHTML = `<div class="stock-glyph" aria-hidden="true">${itemArt(presentation[item.itemId])}</div><div class="stock-info"><h3>${itemName(item.itemId)}</h3><p>${t("money.amount", { amount: definition.price })}</p><p class="stock-quantity">${t("warehouse.itemCount", { quantity })}</p></div>`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stock-action add-stock";
      button.textContent = t("stocking.selectOne");
      button.setAttribute("aria-label", t("stocking.selectItem", { name: itemName(item.itemId) }));
      button.setAttribute("aria-pressed", String(ui.selectedStockInstanceId === item.instanceId));
      button.dataset.instanceId = item.instanceId;
      card.append(button);
      availableList.append(card);
    }
  }

  function cellAt(clientX, clientY, state) {
    const rect = board.getBoundingClientRect();
    return {
      x: Math.floor((clientX - rect.left) / (rect.width / state.shop.columns)),
      y: Math.floor((clientY - rect.top) / (rect.height / state.shop.rows)),
    };
  }

  function renderSelection(state) {
    const selectedStock = state.warehouse.items.find((item) => item.instanceId === ui.selectedStockInstanceId);
    const selectedDisplay = selectedShopItem(state);
    returnButton.disabled = !selectedDisplay;

    const item = selectedDisplay ?? selectedStock;
    if (!item) {
      selection.textContent = t("stocking.selectionEmpty");
      return;
    }

    const definition = itemDefinitions[item.itemId];
    const collection = selectedDisplay ? state.shop.displayedItems : state.warehouse.items;
    const quantity = groupItems(collection).find((group) => group.key === groupKey(item))?.quantity ?? 1;
    selection.innerHTML = `<span class="stocking-selected-glyph" aria-hidden="true">${itemArt(presentation[item.itemId])}</span><span><strong>${itemName(item.itemId)}</strong><br><span>${t("money.amount", { amount: definition.price })} · ${t("warehouse.itemCount", { quantity })}</span></span>`;
  }

  function renderPreview(state) {
    const item = state.shop.displayedItems.find((entry) => entry.instanceId === drag.instanceId);
    if (!item) return;
    const { width, height } = dimensions(item);
    const origin = cellAt(drag.pointerX, drag.pointerY, state);
    const x = origin.x - drag.grabX;
    const y = origin.y - drag.grabY;
    const valid = canPlace(state.shop.displayedItems, item.itemId, x, y, item.rotated, state.shop.columns, state.shop.rows, item.instanceId);
    const preview = document.createElement("div");
    preview.className = `placement-preview${valid ? "" : " is-invalid"}`;
    // Absolute positioning keeps invalid, out-of-bounds previews from adding grid tracks.
    preview.style.position = "absolute";
    preview.style.left = `${x / state.shop.columns * 100}%`;
    preview.style.top = `${y / state.shop.rows * 100}%`;
    preview.style.width = `${width / state.shop.columns * 100}%`;
    preview.style.height = `${height / state.shop.rows * 100}%`;
    preview.title = valid ? t("stocking.previewPlace", { name: itemName(item.itemId) }) : t("stocking.previewInvalid");
    preview.setAttribute("aria-hidden", "true");
    applyItemShape(preview, item, game, true);
    board.append(preview);
    drag.targetX = x;
    drag.targetY = y;
    drag.valid = valid;
  }

  function renderBoard(state) {
    board.style.setProperty("--grid-columns", state.shop.columns);
    board.style.setProperty("--grid-rows", state.shop.rows);
    board.replaceChildren();
    for (let y = 0; y < state.shop.rows; y += 1) {
      for (let x = 0; x < state.shop.columns; x += 1) {
        const cell = document.createElement("div");
        cell.className = "board-cell";
        cell.style.gridColumn = x + 1;
        cell.style.gridRow = y + 1;
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", t("warehouse.cellLabel", { column: x + 1, row: y + 1 }));
        board.append(cell);
      }
    }

    for (const item of state.shop.displayedItems) {
      const { width, height } = dimensions(item);
      const element = document.createElement("button");
      element.type = "button";
      element.className = "warehouse-item";
      element.dataset.instanceId = item.instanceId;
      element.dataset.shortName = itemShortName(item.itemId);
      element.style.gridColumn = `${item.x + 1} / span ${width}`;
      element.style.gridRow = `${item.y + 1} / span ${height}`;
      element.setAttribute("role", "gridcell");
      element.setAttribute("aria-label", t("warehouse.itemLabel", {
        name: itemName(item.itemId), width, height,
        selected: ui.selectedInstanceId === item.instanceId ? t("warehouse.selectedSuffix") : "",
      }));
      element.setAttribute("aria-pressed", String(ui.selectedInstanceId === item.instanceId));
      if (ui.selectedInstanceId === item.instanceId) element.classList.add("is-selected");
      if (drag?.instanceId === item.instanceId) element.classList.add("is-dragging");
      element.innerHTML = `<span class="item-glyph" aria-hidden="true">${itemArt(presentation[item.itemId], item.rotated)}</span>`;
      applyItemShape(element, item, game);
      board.append(element);
    }
    if (drag) renderPreview(state);
  }

  function render(state) {
    if (!state.shop.displayedItems.some((item) => item.instanceId === ui.selectedInstanceId)) ui.selectedInstanceId = null;
    if (!state.warehouse.items.some((item) => item.instanceId === ui.selectedStockInstanceId)) ui.selectedStockInstanceId = null;
    displayedCount.textContent = state.shop.displayedItems.length;
    renderAvailableItems(state);
    renderBoard(state);
    renderSelection(state);
  }

  render(state);

  listen(availableList, "click", (event) => {
    const button = event.target.closest(".add-stock");
    if (!button) return;
    ui.selectedStockInstanceId = button.dataset.instanceId;
    ui.selectedInstanceId = null;
    announce("stocking.statusSelected");
    render(state);
  });

  listen(board, "click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }

    const targetItem = event.target.closest(".warehouse-item");
    if (targetItem) {
      const instanceId = targetItem.dataset.instanceId;
      if (ui.selectedInstanceId === instanceId) {
        const result = actions.rotate(instanceId);
        announce(result.ok ? (result.repositioned ? "warehouse.statusRotatedMoved" : "warehouse.statusRotated") : result.reason);
      } else {
        ui.selectedInstanceId = instanceId;
        ui.selectedStockInstanceId = null;
        announce("stocking.statusShopItemSelected");
      }
      render(state);
      return;
    }

    const { x, y } = cellAt(event.clientX, event.clientY, state);
    if (ui.selectedStockInstanceId) {
      const result = actions.put(ui.selectedStockInstanceId, x, y);
      if (result.ok) {
        const placed = state.shop.displayedItems.at(-1);
        ui.selectedInstanceId = placed.instanceId;
        ui.selectedStockInstanceId = null;
        announce("stocking.statusPlaced");
      } else announce(result.reason);
      render(state);
      return;
    }
    if (ui.selectedInstanceId) {
      const result = actions.move(ui.selectedInstanceId, x, y);
      announce(result.ok ? "stocking.statusMoved" : result.reason);
      render(state);
    }
  });

  listen(board, "pointerdown", (event) => {
    const target = event.target.closest(".warehouse-item");
    if (!target || event.button > 0) return;
    activePointer = { pointerId: event.pointerId, instanceId: target.dataset.instanceId, startX: event.clientX, startY: event.clientY, holdReady: false };
    holdTimer = window.setTimeout(() => {
      if (activePointer?.pointerId === event.pointerId) activePointer.holdReady = true;
    }, HOLD_DELAY);
  });

  listen(board, "pointermove", (event) => {
    if (!activePointer || event.pointerId !== activePointer.pointerId) return;
    if (!drag) {
      const distance = Math.hypot(event.clientX - activePointer.startX, event.clientY - activePointer.startY);
      if (!activePointer.holdReady && distance > 9) {
        clearTimeout(holdTimer);
        activePointer = null;
        return;
      }
      if (activePointer.holdReady && distance > 4) {
        const item = state.shop.displayedItems.find((entry) => entry.instanceId === activePointer.instanceId);
        if (!item) return;
        ui.selectedInstanceId = item.instanceId;
        ui.selectedStockInstanceId = null;
        const point = cellAt(activePointer.startX, activePointer.startY, state);
        drag = { instanceId: item.instanceId, grabX: point.x - item.x, grabY: point.y - item.y, pointerX: event.clientX, pointerY: event.clientY, targetX: item.x, targetY: item.y, valid: true };
        board.classList.add("is-dragging");
        board.setPointerCapture(event.pointerId);
        announce("stocking.statusDragging");
        render(state);
      }
      return;
    }
    drag.pointerX = event.clientX;
    drag.pointerY = event.clientY;
    render(state);
  });

  const finishPointer = (event) => {
    if (!activePointer || event.pointerId !== activePointer.pointerId) return;
    clearTimeout(holdTimer);
    if (drag) {
      suppressClick = true;
      suppressTimer = window.setTimeout(() => { suppressClick = false; }, 0);
      if (drag.valid && event.type !== "pointercancel") {
        const result = actions.move(drag.instanceId, drag.targetX, drag.targetY);
        announce(result.ok ? "stocking.statusMoved" : result.reason);
      } else announce("warehouse.statusInvalidDrop");
      drag = null;
      board.classList.remove("is-dragging");
      render(state);
    }
    activePointer = null;
  };
  listen(board, "pointerup", finishPointer);
  listen(board, "pointercancel", finishPointer);

  listen(returnButton, "click", () => {
    if (!ui.selectedInstanceId) return;
    const result = actions.return(ui.selectedInstanceId);
    if (result.ok) {
      ui.selectedInstanceId = null;
      announce("stocking.statusReturned");
      render(state);
    } else announce(result.reason);
  });

  return {
    render: () => render(state),
    destroy() {
      events.abort();
      clearTimeout(holdTimer);
      clearTimeout(suppressTimer);
      if (activePointer && board.hasPointerCapture(activePointer.pointerId)) {
        board.releasePointerCapture(activePointer.pointerId);
      }
      activePointer = null;
      drag = null;
      board.classList.remove("is-dragging");
    },
  };
}
