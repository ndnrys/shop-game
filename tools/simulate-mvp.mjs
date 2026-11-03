import { equipmentItemError } from "../js/systems/equipment.js";
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import skin from '../js/data/skins/fantasy/index.js';
import { makeSave, validateSave } from '../js/systems/save.js';
import { createSession } from '../js/application/createSession.js';

export function simulateRun(seed, policy = 'balanced', maxDays = 120) {
  let game = createSession(skin);
  let c = game.state.campaign;
  // Only the new-game seed changes; money, stats and outcomes are never overwritten.
  c.seed = seed >>> 0;
  let dungeonsClearDay = null, targetDay = null, reloads = 0, expeditions = 0, injuries = 0, recoveryDays = 0, relief = 0, firstDungeonClearDay = null;
  const equipmentIds = new Set();
  function check(result, operation) { if (!result.ok) throw new Error(`${operation}: ${result.reason}`); }
  function equip() {
    if (c.expedition) return;
    const goods = [...game.state.warehouse.items].sort((a,b) => (game.campaign.config.gearPower[b.itemId]??0)-(game.campaign.config.gearPower[a.itemId]??0));
    for (const item of goods) {
      const slot = game.campaign.config.itemSlots[item.itemId];
      if (!slot) continue;
      const hero = c.heroes.filter(hero => !equipmentItemError(hero, item.itemId, game.campaign.config, game.itemDefinitions)).sort((a,b)=>(game.campaign.config.gearPower[a.equipment[slot]?.itemId]??0)-(game.campaign.config.gearPower[b.equipment[slot]?.itemId]??0))[0];
      if (!hero) continue;
      const old = game.campaign.config.gearPower[hero.equipment[slot]?.itemId]??0;
      const power = game.campaign.config.gearPower[item.itemId];
      // Equip vacant slots; buy upgrades only when the improvement is meaningful.
      if (power > old && (old === 0 || power-old >= 6)) {
        check(game.campaign.support(hero.id,item.instanceId), 'equip');
        equipmentIds.add(item.itemId);
      }
    }
  }
  function fillShelf() {
    const goods = [...game.state.warehouse.items].sort((a,b) => {
      const price=item=>game.itemDefinitions[item.itemId].price;
      return price(b)-price(a);
    });
    for (const item of goods) {
      const position = game.inventory.findOpenPosition(game.state.shop.displayedItems,item,0,0,game.state.shop.columns,game.state.shop.rows);
      if (position) check(game.stocking.put(item.instanceId,position.x,position.y), 'stock');
    }
  }
  while (c.day <= maxDays) {
    for(const hero of c.heroes)while(hero.pendingGrowth)check(game.campaign.grow(hero.id,'balanced'),'growth');
    equip();fillShelf();
    let merchant=policy==='merchant-mix' ? ['weapons','armor','tools'][(c.day+seed)%3] : 'tools';
    let seller=game.campaign.config.merchants.find(entry=>entry.id===merchant);
    if (c.gold < seller.cost) {
      const result=game.campaign.relief();if(result.ok) relief++;
    }
    if(c.gold<seller.cost){seller=game.campaign.config.merchants.find(entry=>entry.cost<=c.gold)??seller;merchant=seller.id;}
    if (c.gold >= seller.cost) {
      check(game.campaign.startTrade(merchant),'purchase');
      for(const item of [...c.trade.incoming]) {
        const kept=game.campaign.keep(item.instanceId);
        if(!kept.ok) check(game.campaign.sellBack(item.instanceId,'incoming'),'buyback');
      }
      check(game.campaign.finishTrade(),'finish trade');
      equip();fillShelf();
    }
    if(game.state.shop.displayedItems.length)check(game.campaign.openShop(),'sell');
    for(const hero of c.heroes)if(hero.health==='dead'&&c.gold>=game.campaign.config.danger.revivalCost)check(game.campaign.revive(hero.id),'revive');
    if (!c.defeated && !c.expedition) {
      if(!game.campaign.members().length || !game.campaign.members().some(hero=>Object.keys(hero.equipment).length)) recoveryDays++;
      else {
        const target=policy==='frugal'?30:policy==='generous'?90:60;
        const funds=c.parties[0].funds;
        const amount=Math.max(0,target-funds);
        {
          if(amount&&c.gold>=amount)check(game.campaign.fundParty(amount),'funds');
          if(c.dungeonProgress.forest===60 && firstDungeonClearDay===null) firstDungeonClearDay=c.day;
          check(game.campaign.dispatch(),'dispatch');expeditions++;
        }
      }
    }
    if(c.defeated && dungeonsClearDay===null) dungeonsClearDay=c.day;
    if(c.gold>=game.campaign.config.targetGold && targetDay===null) targetDay=c.day;
    if(c.defeated && c.gold>=game.campaign.config.targetGold) {
      check(game.campaign.depart(['lina']),'depart');
      injuries=c.journal.filter(event=>['injury','wound'].includes(event.type)).length;
      return {seed,policy,cleared:true,day:c.day,gold:c.departure.villageGold,dungeonProgress:{...c.dungeonProgress},expeditions,injuries,recoveryDays,relief,firstDungeonClearDay,dungeonsClearDay,targetDay,reloads,levels:c.heroes.map(hero=>hero.level),equipment:[...equipmentIds]};
    }
    if(c.day%5===0){game=createSession(skin,validateSave(makeSave(game.state),skin));c=game.state.campaign;reloads++;}
    check(game.campaign.nextDay(),'next day');
  }
  return {seed,policy,cleared:false,day:c.day,gold:c.gold,dungeonProgress:{...c.dungeonProgress},expeditions,recoveryDays,relief};
}

export function summarize(runs) {
  const cleared=runs.filter(run=>run.cleared);const days=cleared.map(run=>run.day).sort((a,b)=>a-b);
  const mean=values=>values.length?Number((values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2)):null;
  const percentile=p=>days.length?days[Math.floor((days.length-1)*p)]:null;
  return {runs:runs.length,cleared:cleared.length,meanDay:mean(days),medianDay:percentile(.5),minDay:days[0]??null,maxDay:days.at(-1)??null,p10:percentile(.1),p90:percentile(.9),within25to35:days.filter(day=>day>=25&&day<=35).length,meanDungeonsClearDay:mean(cleared.map(run=>run.dungeonsClearDay)),meanFirstTargetDay:mean(cleared.map(run=>run.targetDay)),meanExpeditions:mean(cleared.map(run=>run.expeditions)),meanRecoveryDays:mean(cleared.map(run=>run.recoveryDays)),meanInjuries:mean(cleared.map(run=>run.injuries)),byPolicy:Object.fromEntries([...new Set(runs.map(run=>run.policy))].map(policy=>{const subset=runs.filter(run=>run.policy===policy);return [policy,{cleared:subset.filter(run=>run.cleared).length,runs:subset.length,meanDay:mean(subset.filter(run=>run.cleared).map(run=>run.day))}];}))};
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const count=Number(process.argv[2]??100);
  const seedOffset=Number(process.argv[4]??0);
  const policies=['balanced','frugal','generous','merchant-mix'];
  const runs=Array.from({length:count},(_,index)=>simulateRun((Math.imul(index+1+seedOffset,2654435761)^20261102)>>>0,policies[index%policies.length]));
  const result={summary:summarize(runs),runs};
  console.log(JSON.stringify(result.summary,null,2));
  if(process.argv[3]) await fs.writeFile(process.argv[3],JSON.stringify(result,null,2)+'\n');
}
