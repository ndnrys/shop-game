import { itemArt } from "./itemArt.js";
import { fixtureDefinitions } from "../data/shopFixtures.js";
import { fixtureBonus } from "../systems/stores.js";

export function mountStocking(root, game) {
  const {state, i18n:{t,itemName}} = game;
  const board = root.querySelector('#shop-board');
  const available = root.querySelector('#available-stock');
  const selection = root.querySelector('#stocking-selection');
  const status = root.querySelector('#stocking-status');
  const returnButton = root.querySelector('#return-stock-button');
  let events = new AbortController();
  const toolbar = document.createElement('div');
  toolbar.className = 'shelf-toolbar';
  board.before(toolbar);
  let mode = 'layout', selected = null, adding = null, stock = null;
  const listen = (target, type, handler) => target.addEventListener(type,handler,{signal:events.signal});
  const label = item => item.used ? t('item.usedName',{name:itemName(item.itemId)}) : itemName(item.itemId);
  const groupKey = i => JSON.stringify([i.itemId,Boolean(i.used),i.material,i.rarity,game.price(i)]);
  function groups(items) {
    const result = new Map();
    for (const item of items) {
      const key = groupKey(item);
      if (!result.has(key)) result.set(key,[]);
      result.get(key).push(item);
    }
    return [...result.values()];
  }
  function button(text, action, pressed = false) {
    const b = document.createElement('button'); b.type='button'; b.textContent=text;
    b.setAttribute('aria-pressed',String(pressed)); listen(b,'click',action); return b;
  }
  function act(result) { status.textContent=t(result.ok?'shelves.saved':result.reason); render(); }
  function render() {
    events.abort(); events = new AbortController();
    toolbar.replaceChildren();
    for (const value of ['layout','stock']) toolbar.append(button(t(`shelves.${value}`),()=>{mode=value;adding=null;render();},mode===value));
    if (mode==='layout') for (const [type,definition] of Object.entries(fixtureDefinitions)) toolbar.append(button(`${definition.icon} ${t(`shelves.${type}`)}`,()=>{adding=type;selected=null;render();},adding===type));
    const summary=document.createElement('p');
    summary.className='shelf-layout-summary';
    const maximum=state.shop.columns*state.shop.rows;
    const capacity=state.shop.fixtures.reduce((sum,f)=>sum+fixtureDefinitions[f.type].capacity,0);
    summary.textContent=t('shelves.layoutSummary',{count:state.shop.fixtures.length,maximum,remaining:maximum-state.shop.fixtures.length,stock:state.shop.displayedItems.length,capacity});
    toolbar.append(summary);
    const hint=document.createElement('p'); hint.textContent=t(mode==='layout'?'shelves.layoutHelp':'shelves.stockHelp'); toolbar.append(hint);
    board.style.setProperty('--grid-columns',state.shop.columns);
    board.style.setProperty('--grid-rows',state.shop.rows);
    board.replaceChildren();
    for(let y=0;y<state.shop.rows;y++) for(let x=0;x<state.shop.columns;x++) {
      const fixture=state.shop.fixtures.find(f=>f.x===x&&f.y===y);
      const cell=button('',()=>{
        if(fixture) {selected=fixture.id;adding=null;render();}
        else if(mode==='layout' && adding) act(game.stocking.placeFixture(adding,x,y));
        else if(mode==='layout' && selected) {const f=state.shop.fixtures.find(f=>f.id===selected);act(game.stocking.placeFixture(f.type,x,y,f.id));}
      },fixture?.id===selected);
      cell.className='shelf-cell';cell.style.gridColumn=x+1;cell.style.gridRow=y+1;
      cell.setAttribute('aria-label',`${t('warehouse.cellLabel',{column:x+1,row:y+1})}${fixture ? ' '+t(`shelves.${fixture.type}`):''}`);
      if(fixture) {
        const items=state.shop.displayedItems.filter(i=>i.shelfId===fixture.id);
        const icon=document.createElement('span'); icon.textContent=fixtureDefinitions[fixture.type].icon;cell.append(icon);
        const count=document.createElement('small');count.textContent=`${items.length}/${fixtureDefinitions[fixture.type].capacity}`;cell.append(count);
        for(const group of groups(items).slice(0,2)) {const badge=document.createElement('span');badge.className='shelf-product';badge.innerHTML=itemArt(game.presentation[group[0].itemId]);const n=document.createElement('small');n.textContent=`×${group.length}`;badge.append(n);cell.append(badge);}
      }
      board.append(cell);
    }
    root.querySelector('#displayed-count').textContent=state.shop.displayedItems.length;
    selection.replaceChildren();
    const shelf=state.shop.fixtures.find(f=>f.id===selected);
    if(shelf) {
      const items=state.shop.displayedItems.filter(i=>i.shelfId===shelf.id);
      const text=document.createElement('p');text.textContent=t('shelves.details',{name:t(`shelves.${shelf.type}`),count:items.length,capacity:fixtureDefinitions[shelf.type].capacity,bonus:Math.round(fixtureBonus(state.shop,shelf.id)*100)});selection.append(text);
      if (shelf.type === 'equipment') { const effect=document.createElement('p');effect.textContent=t('shelves.adjacentEffect',{bonus:fixtureDefinitions[shelf.type].adjacentBonus*100});selection.append(effect); }
      for(const group of groups(items)) {
        const row=document.createElement('div');row.className='shelf-stock-row';
        row.innerHTML=`<span class="stock-glyph">${itemArt(game.presentation[group[0].itemId])}</span>`;
        const info=document.createElement('span');info.textContent=`${label(group[0])} ×${group.length} · ${t('money.amount',{amount:game.price(group[0])})}`;row.append(info);
        row.append(button(t('shelves.returnOne'),()=>act(game.stocking.return(group[0].instanceId))));selection.append(row);
      }
    } else selection.textContent=t('shelves.selectShelf');
    returnButton.hidden=true;
    available.hidden=mode!=='stock';available.replaceChildren();
    if(mode==='stock') for(const group of groups(state.warehouse.items)) {
      const item=group[0],card=document.createElement('article');card.className='stock-card';card.dataset.instanceId=item.instanceId;
      card.innerHTML=`<div class="stock-glyph">${itemArt(game.presentation[item.itemId])}</div>`;
      const text=document.createElement('p');text.textContent=`${label(item)} ×${group.length} · ${t('money.amount',{amount:game.price(item)})}`;card.append(text);
      const input=document.createElement('input');input.type='number';input.min=1;input.max=group.length;input.value=stock?.key===groupKey(item)?stock.quantity:1;input.setAttribute('aria-label',t('shelves.quantity'));input.style.width='5em';
      listen(input,'input',()=>{stock={key:groupKey(item),quantity:input.value};});card.append(input);
      const b=button(t('shelves.replenish'),()=>act(game.stocking.replenish(item.instanceId,selected,Number(input.value))));b.disabled=!shelf || !fixtureDefinitions[shelf.type].capacity;card.append(b);available.append(card);
    }
  }
  render();
  return {render,destroy(){events.abort();toolbar.remove();returnButton.hidden=false;}};
}
