import { itemArt } from "./itemArt.js";
import { applyItemShape } from "./itemShape.js";

export function mountWarehouse(root, game) {
  const state = game.state;
  const { itemDefinitions, presentation } = game;
  const { canPlace, dimensions, itemCells } = game.inventory;
  const { itemName, itemShortName, t } = game.i18n;
  const itemLabel = item => item.used ? t('item.usedName', { name: itemName(item.itemId) }) : itemName(item.itemId);
  const actions = game.warehouse;
  const ui = { selectedInstanceId: null };
  const events = new AbortController();
  const listen = (target, type, handler) => target.addEventListener(type, handler, { signal: events.signal });
  const board = root.querySelector("#warehouse-board");
  const selectionContent = root.querySelector("#selection-content");
  const statusMessage = root.querySelector("#status-message");
  const itemCount = root.querySelector("#item-count");
  const undoButton = root.querySelector("#undo-button");
  const rotateButton = root.querySelector("#rotate-button");
  const HOLD_DELAY = 100;

  let activePointer = null;
  let holdTimer = null;
  let drag = null;
  let suppressClick = false;
  let suppressTimer = null;

  function selectedItem(state) {
    return state.warehouse.items.find((item) => item.instanceId === ui.selectedInstanceId) ?? null;
  }

  function announce(message) {
    statusMessage.textContent = t(message);
  }

  function occupiedCells(state) {
    return state.warehouse.items.reduce((sum, item) => {
      return sum + itemCells(item).length;
    }, 0);
  }

  function renderSelection(state) {
    const item = selectedItem(state);
    rotateButton.disabled = !item;
    if (!item) {
      selectionContent.innerHTML = `<div class="selection-empty">${t("warehouse.selectionEmpty")}</div>`;
      return;
    }
    const definition = itemDefinitions[item.itemId];
    const { width, height } = dimensions(item);
    selectionContent.innerHTML = `<div class="item-preview" aria-hidden="true">${itemArt(presentation[item.itemId])}</div><div><p class="selection-name">${itemLabel(item)}</p><p class="selection-meta">${t("warehouse.selectedMeta", { category: t(`categories.${definition.categoryKey}`), material: t(`materials.${definition.materialKey}`), width, height, price: t("money.amount", { amount: game.price(item) }) })}</p></div>`;
  }

  function render(state) {
    if (!state.warehouse.items.some((item) => item.instanceId === ui.selectedInstanceId)) ui.selectedInstanceId = null;
    const { columns, rows, items } = state.warehouse;
    board.style.setProperty("--grid-columns", columns);
    board.style.setProperty("--grid-rows", rows);
    itemCount.textContent = occupiedCells(state);
    undoButton.disabled = !actions.canUndo();
    board.replaceChildren();

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const cell = document.createElement("div");
        cell.className = "board-cell";
        cell.style.gridColumn = x + 1;
        cell.style.gridRow = y + 1;
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", t("warehouse.cellLabel", { column: x + 1, row: y + 1 }));
        board.append(cell);
      }
    }

    for (const item of items) {
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
        name: itemLabel(item),
        width,
        height,
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
    renderSelection(state);
  }

  function cellAt(clientX, clientY) {
    const rect = board.getBoundingClientRect();
    const cellWidth = rect.width / state.warehouse.columns;
    const cellHeight = rect.height / state.warehouse.rows;
    return {
      x: Math.floor((clientX - rect.left) / cellWidth),
      y: Math.floor((clientY - rect.top) / cellHeight),
    };
  }

  function renderPreview(state) {
    const item = state.warehouse.items.find((entry) => entry.instanceId === drag.instanceId);
    if (!item) return;
    const { width, height } = dimensions(item);
    const origin = cellAt(drag.pointerX, drag.pointerY);
    const x = origin.x - drag.grabX;
    const y = origin.y - drag.grabY;
    const valid = canPlace(state.warehouse.items, item.itemId, x, y, item.rotated, state.warehouse.columns, state.warehouse.rows, item.instanceId);
    const preview = document.createElement("div");
    preview.className = `placement-preview${valid ? "" : " is-invalid"}`;
    // Absolute positioning keeps invalid, out-of-bounds previews from adding grid tracks.
    preview.style.position = "absolute";
    preview.style.left = `${x / state.warehouse.columns * 100}%`;
    preview.style.top = `${y / state.warehouse.rows * 100}%`;
    preview.style.width = `${width / state.warehouse.columns * 100}%`;
    preview.style.height = `${height / state.warehouse.rows * 100}%`;
    preview.setAttribute("aria-hidden", "true");
    preview.title = valid ? t("warehouse.previewPlace", { name: itemLabel(item) }) : t("warehouse.previewInvalid");
    applyItemShape(preview, item, game, true);
    board.append(preview);
    drag.targetX = x;
    drag.targetY = y;
    drag.valid = valid;
  }

  function selectOrRotate(state, instanceId) {
    if (ui.selectedInstanceId !== instanceId) {
      ui.selectedInstanceId = instanceId;
      announce("warehouse.statusSelected");
    } else {
      const result = actions.rotate(instanceId);
      announce(result.ok ? (result.repositioned ? "warehouse.statusRotatedMoved" : "warehouse.statusRotated") : result.reason);
    }
    render(state);
  }

  render(state);

  listen(board, "click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const item = event.target.closest(".warehouse-item");
    if (item) {
      selectOrRotate(state, item.dataset.instanceId);
      return;
    }
    if (!ui.selectedInstanceId || drag) return;
    const { x, y } = cellAt(event.clientX, event.clientY);
    const result = actions.move(ui.selectedInstanceId, x, y);
    announce(result.ok ? "warehouse.statusPlaced" : result.reason);
    render(state);
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
        const item = state.warehouse.items.find((entry) => entry.instanceId === activePointer.instanceId);
        if (!item) return;
        ui.selectedInstanceId = item.instanceId;
        const point = cellAt(activePointer.startX, activePointer.startY);
        drag = { instanceId: item.instanceId, grabX: point.x - item.x, grabY: point.y - item.y, pointerX: event.clientX, pointerY: event.clientY, targetX: item.x, targetY: item.y, valid: true };
        board.classList.add("is-dragging");
        board.setPointerCapture(event.pointerId);
        announce("warehouse.statusDragging");
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
        announce(result.ok ? "warehouse.statusMoved" : result.reason);
      } else {
        announce("warehouse.statusInvalidDrop");
      }
      drag = null;
      board.classList.remove("is-dragging");
      render(state);
    }
    activePointer = null;
  };
  listen(board, "pointerup", finishPointer);
  listen(board, "pointercancel", finishPointer);

  listen(rotateButton, "click", () => {
    const item = selectedItem(state);
    if (!item) return;
    const result = actions.rotate(item.instanceId);
    announce(result.ok ? (result.repositioned ? "warehouse.statusRotatedMoved" : "warehouse.statusRotated") : result.reason);
    render(state);
  });

  listen(undoButton, "click", () => {
    if (!actions.canUndo()) return;
    actions.undo();
    announce("warehouse.statusUndo");
    render(state);
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
