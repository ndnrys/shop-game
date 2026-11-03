import { equipmentItemError, equipmentLoadoutError } from "./equipment.js";
import { createInventorySystem } from "./inventory.js";

export const SAVE_VERSION = 8;
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;

export function makeSave(state) {
  return { version: SAVE_VERSION, state: structuredClone(state) };
}

export function validateSave(value, skin) {
  const reject = () => { throw new Error('Invalid save data'); };
  const s = value?.state ? structuredClone(value.state) : null;
  if (![1, 2, 3, 4, 5, 6, 7, SAVE_VERSION].includes(value?.version) || !s || s.skinId !== skin.id || s.contentVersion !== skin.contentVersion) reject();
  // Version 1 used one nullable equipment item. Preserve it in its configured slot.
  if (value.version === 1 && s.campaign) {
    const migrateHero = hero => {
      if (!hero || typeof hero !== 'object') reject();
      if (hero.equipment?.itemId) {
        const slot = skin.campaign?.itemSlots[hero.equipment.itemId];
        if (!slot) reject();
        hero.equipment = { [slot]: hero.equipment };
      } else if (hero.equipment === null) hero.equipment = {};
      if (hero.giftedEquipment === undefined) hero.giftedEquipment = [];
    };
    if (Array.isArray(s.campaign.heroes)) s.campaign.heroes.forEach(migrateHero);
    if (Array.isArray(s.campaign.departure?.companions)) s.campaign.departure.companions.forEach(migrateHero);
  }
  if (value.version < 3 && s.campaign) {
    const c = s.campaign;
    c.progress = c.defeated ? 100 : 0;
    const migrateGrowth = hero => {
      hero.level = 1;
      hero.experience = 0;
      hero.recoverUntil = 0;
    };
    if (Array.isArray(c.heroes)) c.heroes.forEach(migrateGrowth);
    if (Array.isArray(c.departure?.companions)) c.departure.companions.forEach(migrateGrowth);
    if (c.expedition) {
      c.expedition.kind = "explore";
      c.expedition.injuryRolls = c.heroes.map(() => .999999);
      c.expedition.recoveryRolls = c.heroes.map(() => 0);
    }
  }
  if (value.version < 6 && s.campaign) {
    const migrateStats = hero => {
      const initial = skin.campaign.heroes.find(entry => entry.id === hero.id);
      if (!initial || !integer(hero.level, initial.level ?? 1)) reject();
      hero.hp = initial.hp;
      hero.attack = initial.attack;
      hero.defense = initial.defense;
      hero.pendingGrowth = hero.level - (initial.level ?? 1);
    };
    if (Array.isArray(s.campaign.heroes)) s.campaign.heroes.forEach(migrateStats);
    if (Array.isArray(s.campaign.departure?.companions)) s.campaign.departure.companions.forEach(migrateStats);
  }
  if (value.version < 8 && s.campaign) {
    const config = skin.campaign;
    const migrateJob = hero => {
      const initial = config.heroes.find(entry => entry.id === hero.id);
      if (!initial || !hero.equipment || !Array.isArray(hero.giftedEquipment)) reject();
      hero.jobId = initial.jobId;
      for (const [slot, item] of Object.entries(hero.equipment)) {
        if (!skin.itemDefinitions[item?.itemId]) reject();
        if (equipmentItemError(hero, item.itemId, config, skin.itemDefinitions)) {
          hero.giftedEquipment.push(item); delete hero.equipment[slot];
        }
      }
      if (equipmentLoadoutError(hero, hero.equipment, config, skin.itemDefinitions) === 'equipment.twoHandedShield') {
        hero.giftedEquipment.push(hero.equipment.offhand); delete hero.equipment.offhand;
      }
    };
    if (Array.isArray(s.campaign.heroes)) s.campaign.heroes.forEach(migrateJob);
    if (Array.isArray(s.campaign.departure?.companions)) s.campaign.departure.companions.forEach(migrateJob);
  }
  const inventory = createInventorySystem(skin.itemDefinitions);
  const ids = new Set();
  let maximumDeliveryId = 0;
  function item(entry) {
    if (!entry || typeof entry.instanceId !== 'string' || !entry.instanceId || ids.has(entry.instanceId) || !skin.itemDefinitions[entry.itemId]) reject();
    if (entry.used !== undefined && typeof entry.used !== 'boolean') reject();
    if (entry.purchaseCost !== undefined && !integer(entry.purchaseCost)) reject();
    if (!integer(entry.x) || !integer(entry.y) || ![false,true,0,1,2,3].includes(entry.rotated)) reject();
    ids.add(entry.instanceId);
    if (/^delivery-\d+$/.test(entry.instanceId)) maximumDeliveryId = Math.max(maximumDeliveryId, Number(entry.instanceId.slice(9)));
  }
  for (const [key, itemsKey] of [['warehouse','items'], ['shop','displayedItems']]) {
    const grid = s[key];
    const initial = skin.initialState[key];
    if (!grid || grid.columns !== initial.columns || grid.rows !== initial.rows || !Array.isArray(grid[itemsKey]) || grid[itemsKey].length > 1000) reject();
    for (const entry of grid[itemsKey]) {
      item(entry);
      if (!inventory.canPlace(grid[itemsKey], entry.itemId, entry.x, entry.y, entry.rotated, grid.columns, grid.rows, entry.instanceId)) reject();
    }
  }
  if (skin.campaign) {
    const c = s.campaign; const config = skin.campaign;
    if (!c || !integer(c.gold) || !integer(c.day,1) || !integer(c.seed) || c.seed > 4294967295 || !integer(c.nextItemId,1) || !integer(c.aidDay) || c.aidDay > c.day || !['village','next-town'].includes(c.region) || typeof c.opened !== 'boolean' || typeof c.defeated !== 'boolean') reject();
    if (value.version < 4) {
      c.phase = c.opened ? 'sales' : c.trade ? 'purchase' : 'report';
      if (!c.parties) c.partyIds = config.heroes.map(hero => hero.id);
    }
    if (!['report','purchase','warehouse','stocking','support','opening','sales','end'].includes(c.phase)) reject();
    if (value.version < 7) {
      if (!c.parties) {
        if (!Array.isArray(c.heroes) || c.heroes.some(hero => !integer(hero.funds))) reject();
        const members = c.partyIds;
        if (!Array.isArray(members) || members.length > config.partySize) reject();
        c.parties = [{ id: "party-1", members: [...members, ...Array(config.partySize - members.length).fill(null)], funds: c.heroes.reduce((sum, hero) => sum + hero.funds, 0) }];
      }
      if (c.expedition && !c.expedition.partyId) c.expedition.partyId = c.parties[0].id;
      delete c.partyIds;
      for (const hero of [...(c.heroes ?? []), ...(c.departure?.companions ?? [])]) delete hero.funds;
    }
    if (!Array.isArray(c.parties) || !c.parties.length || c.parties.length > config.maximumParties) reject();
    const members = [];
    for (const [index, party] of c.parties.entries()) {
      if (!party || party.id !== `party-${index + 1}` || !integer(party.funds) || !Array.isArray(party.members) || party.members.length !== config.partySize) reject();
      members.push(...party.members.filter(id => id !== null));
    }
    if (new Set(members).size !== members.length || members.some(id => !config.heroes.some(hero => hero.id === id))) reject();
    if ((c.opened && !['sales','end'].includes(c.phase)) || (!c.opened && ['sales','end'].includes(c.phase))) reject();
    if (!integer(c.progress) || c.progress > 100 || (c.defeated && c.progress !== 100)) reject();
    if (c.customerVisits === undefined) c.customerVisits = [];
    if (!Array.isArray(c.customerVisits) || c.customerVisits.length > config.customers.length || new Set(c.customerVisits.map(visit=>visit.customerId)).size!==c.customerVisits.length) reject();
    for (const visit of c.customerVisits) {
      const customer = config.customers.find(entry=>entry.id===visit.customerId);
      if (!customer || visit.dialogueKey!==customer.dialogueKey) reject();
      const purchase = visit.purchase;
      if (purchase!==null && (!purchase || purchase.customerId!==visit.customerId || !skin.itemDefinitions[purchase.itemId] || !integer(purchase.amount) || !integer(purchase.cost))) reject();
    }
    if (c.today && c.today.cogs === undefined) c.today.cogs = 0;
    if (!c.today || ['cogs','sales','purchasing','buyback','support','rewards','aid'].some(key=>!integer(c.today[key]))) reject();
    if (!c.milestones || ['sold','supported','purchased'].some(key=>typeof c.milestones[key]!=='boolean')) reject();
    if (!Array.isArray(c.heroes) || c.heroes.length !== config.heroes.length || new Set(c.heroes.map(hero=>hero.id)).size !== config.heroes.length) reject();
    for (const hero of c.heroes) {
      const initial = config.heroes.find(entry => entry.id === hero.id);
      if (Object.hasOwn(hero, 'funds') || !Object.hasOwn(config.jobs, hero.jobId)) reject();
      if (equipmentLoadoutError(hero, hero.equipment ?? {}, config, skin.itemDefinitions)) reject();
      if (!initial || !integer(hero.hp, 1) || !integer(hero.attack, 1) || !integer(hero.defense, 1) || !integer(hero.pendingGrowth) || hero.pendingGrowth > hero.level - (initial.level ?? 1)) reject();
      if (!config.heroes.some(entry=>entry.id===hero.id) || !integer(hero.ability,1) || !integer(hero.level,1) || !integer(hero.experience) || hero.experience >= config.quest.levelExperience || !integer(hero.recoverUntil) || hero.recoverUntil > c.day + config.quest.recoveryMax) reject();
      if (!hero.equipment || typeof hero.equipment !== 'object' || Array.isArray(hero.equipment) || !Array.isArray(hero.giftedEquipment) || hero.giftedEquipment.length > 10000) reject();
      for (const [slot, equipped] of Object.entries(hero.equipment)) {
        if (!config.equipmentSlots.includes(slot) || config.itemSlots[equipped?.itemId] !== slot) reject();
        item(equipped);
      }
      for (const gift of hero.giftedEquipment) {
        if (!config.itemSlots[gift?.itemId]) reject();
        item(gift);
      }
    }
    if (c.trade !== null) {
      if (!c.trade || !config.merchants.some(merchant=>merchant.id===c.trade.merchantId) || !Array.isArray(c.trade.incoming) || c.trade.incoming.length > 1000) reject();
      c.trade.incoming.forEach(item);
    }
    if (c.nextItemId <= maximumDeliveryId) reject();
    if (c.expedition !== null) {
      const e = c.expedition;
      if (!e || !c.parties.some(party => party.id === e.partyId) || !['explore','boss'].includes(e.kind) || (e.kind==='boss') !== (c.progress===100) || !Array.isArray(e.injuryRolls) || !Array.isArray(e.recoveryRolls) || e.injuryRolls.length!==e.heroIds?.length || e.recoveryRolls.length!==e.heroIds?.length || [...e.injuryRolls,...e.recoveryRolls].some(roll=>!Number.isFinite(roll)||roll<0||roll>=1) || e.questId !== config.quest.id || !integer(e.departedDay,1) || !integer(e.returnDay,e.departedDay+1) || e.departedDay > c.day || e.returnDay <= c.day || !Number.isFinite(e.chance) || e.chance<0 || e.chance>1 || !Number.isFinite(e.roll) || e.roll<0 || e.roll>=1 || !integer(e.funds) || !Array.isArray(e.heroIds) || !e.heroIds.length || new Set(e.heroIds).size !== e.heroIds.length || e.heroIds.some(id=>!c.heroes.some(hero=>hero.id===id))) reject();
      const assigned = c.parties.find(party => party.id === e.partyId).members.filter(Boolean);
      if (e.heroIds.length !== assigned.length || e.heroIds.some(id => !assigned.includes(id))) reject();
    }
    if (!Array.isArray(c.journal) || c.journal.length>100000) reject();
    const types = ['exploration','bossSuccess','bossFailure','levelUp','injury','recovered','visit','purchase','buyback','sale','noSale','support','partySupport','returnEquipment','dispatch','questSuccess','questFailure','summary','aid','departure'];
    for (const entry of c.journal) {
      if (!integer(entry.day,1) || entry.day>c.day || !types.includes(entry.type) || !entry.details || typeof entry.details!=='object' || Array.isArray(entry.details)) reject();
      const d=entry.details;
      if (d.partyId && !c.parties.some(party => party.id === d.partyId)) reject();
      if (d.heroId && !config.heroes.some(hero=>hero.id===d.heroId)) reject();
      if (d.itemId && !skin.itemDefinitions[d.itemId]) reject();
      if (d.merchantId && !config.merchants.some(merchant=>merchant.id===d.merchantId)) reject();
      if (d.customerId && !config.customers.some(customer=>customer.id===d.customerId)) reject();
      for (const key of ['gain','progress','days','level','ability','amount','count','sales','cogs','purchasing','buyback','support','rewards','aid']) if (d[key]!==undefined && !integer(d[key])) reject();
      if (entry.type==='visit' && d.dialogueKey!==config.customers.find(customer=>customer.id===d.customerId)?.dialogueKey) reject();
      if (d.net!==undefined && !Number.isSafeInteger(d.net)) reject();
    }
    if (c.region==='next-town') {
      const d=c.departure;
      if (d && d.targetGold === undefined) d.targetGold = Math.min(config.targetGold, d.villageGold);
      if (!c.defeated || c.expedition || c.trade || !d || !Array.isArray(d.heroIds) || new Set(d.heroIds).size!==d.heroIds.length || d.heroIds.some(id=>!c.heroes.some(hero=>hero.id===id)) || !integer(d.openingGold) || !integer(d.travel) || !integer(d.settlement) || !integer(d.targetGold,1) || !integer(d.villageGold,d.targetGold) || !integer(d.day,1) || !Array.isArray(d.companions) || d.companions.length!==d.heroIds.length || d.companions.some(hero=>!d.heroIds.includes(hero.id) || JSON.stringify(hero)!==JSON.stringify(c.heroes.find(current=>current.id===hero.id))) || d.openingGold!==config.nextTownBaseGold-d.travel || c.gold!==d.openingGold) reject();
    } else if (c.departure !== null) reject();
  }
  return structuredClone(s);
}

export function parseSave(text, skin) {
  if (typeof text !== 'string' || text.length>5000000) throw new Error('Save is too large');
  return validateSave(JSON.parse(text), skin);
}

function openDatabase() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('shop-game',1);
    request.onupgradeneeded=()=>{ if(!request.result.objectStoreNames.contains('saves')) request.result.createObjectStore('saves'); };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('Database blocked'));
  });
}
export async function loadGame(skin) {
  const db=await openDatabase();
  try {
    const data=await new Promise((resolve,reject)=>{
      const request=db.transaction('saves','readonly').objectStore('saves').get(skin.id);
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    return data ? validateSave(data,skin) : null;
  } finally { db.close(); }
}
export async function saveGame(skinId, snapshot) {
  const db=await openDatabase();
  try {
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction('saves','readwrite');
      transaction.objectStore('saves').put(snapshot,skinId);
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error ?? new Error('Save aborted'));
    });
  } finally { db.close(); }
}
