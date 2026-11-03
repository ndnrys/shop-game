export function equipmentItemError(hero, itemId, config, definitions) {
  const item = definitions[itemId];
  const type = config.equipmentTypes[item?.equipmentType];
  const job = config.jobs[hero.jobId];
  if (!type || type.slot !== config.itemSlots[itemId]) return 'equipment.invalidType';
  if (type.slot === 'weapon' && (![1, 2].includes(type.hands ?? item.hands) || (type.hands !== null && item.hands !== undefined && item.hands !== type.hands))) return 'equipment.invalidType';
  if (!Object.hasOwn(config.jobs, hero.jobId) || !job || (!type.shared && !job.allowedTypes.includes(item.equipmentType))) return 'equipment.jobDenied';
  return null;
}

export function equipmentLoadoutError(hero, equipment, config, definitions) {
  for (const [slot, item] of Object.entries(equipment)) {
    if (config.itemSlots[item.itemId] !== slot) return 'mvp.error.equipment';
    const reason = equipmentItemError(hero, item.itemId, config, definitions);
    if (reason) return reason;
  }
  const weapon = definitions[equipment.weapon?.itemId];
  const hands = config.equipmentTypes[weapon?.equipmentType]?.hands ?? weapon?.hands;
  if (weapon && ![1, 2].includes(hands)) return 'equipment.invalidType';
  if (hands === 2 && equipment.offhand) return 'equipment.twoHandedShield';
  return null;
}

// Plan the whole exchange before committing: a full warehouse must not lose gear.
export function exchangeEquipment(state, hero, changes, config, inventory, definitions, recoverArchived = false) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return { ok: false, reason: 'mvp.error.equipment' };
  const entries = Object.entries(changes);
  const incoming = [];
  for (const [slot, id] of entries) {
    if (!config.equipmentSlots.includes(slot)) return { ok: false, reason: 'mvp.error.equipment' };
    if (id === null) continue;
    const item = state.warehouse.items.find(item => item.instanceId === id);
    if (!item || config.itemSlots[item.itemId] !== slot || incoming.some(entry => entry.instanceId === id)) return { ok: false, reason: 'mvp.error.equipment' };
    incoming.push(item);
  }
  const equipment = { ...hero.equipment };
  for (const [slot, id] of entries) {
    if (id === null) delete equipment[slot];
    else equipment[slot] = { ...incoming.find(item => item.instanceId === id), used: true };
  }
  const reason = equipmentLoadoutError(hero, equipment, config, definitions);
  if (reason) return { ok: false, reason };
  const returned = entries.flatMap(([slot]) => hero.equipment[slot] ? [hero.equipment[slot]] : []);
  if (recoverArchived) returned.push(...hero.giftedEquipment);
  const items = state.warehouse.items.filter(item => !incoming.some(entry => entry.instanceId === item.instanceId));
  // Large pieces first reduces avoidable failures when several slots are exchanged.
  for (const old of [...returned].sort((a, b) => inventory.itemCells(b).length - inventory.itemCells(a).length)) {
    let placement;
    for (const rotated of [...new Set([old.rotated, 0, 1, 2, 3])]) {
      const candidate = { ...old, used: true, rotated };
      const position = inventory.findOpenPosition(items, candidate, old.x, old.y, state.warehouse.columns, state.warehouse.rows);
      if (position) { placement = { ...candidate, ...position }; break; }
    }
    if (!placement) return { ok: false, reason: 'mvp.error.returnFull' };
    items.push(placement);
  }
  return { ok: true, items, equipment, returned, incoming };
}
