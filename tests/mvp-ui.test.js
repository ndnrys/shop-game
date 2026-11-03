import fantasy from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { mountScreens } from '../js/ui/app.js';
import { mountCampaign } from '../js/ui/campaign.js';
import { mountWarehouse } from '../js/ui/warehouse.js';
import { mountStocking } from '../js/ui/stocking.js';
import { applyTranslations } from '../js/ui/i18n.js';
import { makeSave, loadGame, saveGame, parseSave } from '../js/systems/save.js';

const skin={...fantasy,id:'test-mvp-ui'};
const fixture=document.querySelector('#fixture');
const template=new DOMParser().parseFromString(await(await fetch('../index.html')).text(),'text/html').querySelector('main');
fixture.append(template.cloneNode(true));
let game=createSession(skin), app;
const features=[...['home','purchase','support','journal','adventurers','residents'].map(id=>({id,mount:mountCampaign})),{id:'warehouse',mount:mountWarehouse},{id:'stocking',mount:mountStocking}];
function mount(){app=mountScreens(fixture,game,features);applyTranslations(fixture,game.i18n);}
mount();
let passed=0;
function assert(value,message){if(!value)throw new Error(message);}
function get(selector){const el=fixture.querySelector(selector);if(!el)throw new Error(selector);return el;}
const visible='[data-screen]:not([hidden])';
function page(name){get(`a.screen-link[href="#${name}"]`).click();}
function action(name,extra=''){get(`${visible} [data-action="${name}"]${extra}`).click();}
function step(name='next'){get(`[data-routine="${name}"]`).click();}
function give(id,gear,funds){get(`${visible} [data-select-hero="${id}"]`).click();const form=get(`${visible} form[data-hero="${id}"]`);if(gear){const item=game.state.warehouse.items.find(item=>item.instanceId===gear);const slot=game.campaign.config.itemSlots[item.itemId];form.querySelector(`[data-equip-item="${gear}"]`).click();form.querySelector(`[data-equip-slot="${slot}"]`).click();}for(const increment of [1000,100,10])while(funds>=increment){form.querySelector(`[data-funds-add="${increment}"]`).click();funds-=increment;}form.requestSubmit();}
async function check(name,fn){await fn();passed++;const li=document.createElement('li');li.textContent=`PASS ${name}`;document.querySelector('#checks').append(li);}
try {
  await check('five tabs; adventurer preparation shares party, gear and funds without departure controls',()=>{
    page('home');assert(game.state.campaign.phase==='report','start at report');
    assert(get('#daily-routine ol').children.length===7,'seven visual steps');
    assert(!get('#daily-routine ol').textContent.includes('倉庫整理'),'warehouse excluded only from indicator');
    const initial=JSON.stringify(game.state);
    step('details');assert(get('.app-shell').classList.contains('home-details'),'primary opens existing controls');
    assert(JSON.stringify(game.state)===initial,'opening details does not change saved state');

    assert([...fixture.querySelectorAll('.main-nav a')].filter(a=>!a.hidden).length===5,'five visible tabs');
    page('adventurers');assert(!get('[data-screen="adventurers"]').querySelector('[data-action="dispatch"], [data-destination]'),'no departure in tab');
    const before=JSON.stringify(game.state);get(`${visible} [data-select-hero="bran"]`).click();assert(JSON.stringify(game.state)===before,'selection does not save');
    for(const id of ['bran','noa']){const input=get(`${visible} [data-party="${id}"]`);input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));}
    give('lina','stock-001',30);assert(game.state.campaign.heroes[0].equipment.weapon.itemId==='iron_sword','gear transferred');
    assert(game.state.campaign.partyIds.join()==='lina','single selected party');
    page('home');assert(game.state.campaign.phase==='report','tab switching preserves step');step();
  });
  await check('tap equipment drafts commit several slots and removal returns discounted used gear',()=>{
    page('adventurers');
    const form=get(`${visible} form[data-hero="lina"]`);
    assert(form.querySelectorAll('[data-equip-slot]').length===4,'four equipment slots');
    assert(!form.querySelector('select'),'no equipment dropdown');
    assert(form.previousElementSibling.classList.contains('hero-health'),'editor directly below health');
    const before=JSON.stringify(game.state);
    for(const [slot,id] of [['weapon','stock-009'],['offhand','stock-003']]){
      form.querySelector(`[data-equip-item="${id}"]`).click();
      form.querySelector(`[data-equip-slot="${slot}"]`).click();
    }
    assert(JSON.stringify(game.state)===before,'draft is temporary');form.querySelector('[data-funds-add="10"]').click();form.requestSubmit();
    const hero=game.state.campaign.heroes[0];assert(hero.equipment.weapon.instanceId==='stock-009'&&hero.equipment.offhand.instanceId==='stock-003','multiple slots committed');assert(!hero.equipment.body,'unchanged body preserved');
    assert(game.state.warehouse.items.find(item=>item.instanceId==='stock-001').used,'old sword returned used');
    const nextForm=get(`${visible} form[data-hero="lina"]`);nextForm.querySelector('[data-equip-remove="weapon"]').click();nextForm.requestSubmit();
    assert(!hero.equipment.weapon&&hero.equipment.offhand,'only selected slot removed');
    const axe=game.state.warehouse.items.find(item=>item.instanceId==='stock-009');assert(axe.used&&game.price(axe)===50,'used axe half price');
    give('lina','stock-001',0);
    page('warehouse');get('#warehouse-board [data-instance-id="stock-009"]').click();assert(get('#selection-content').textContent.includes('使用済み')&&get('#selection-content').textContent.includes('50 G'),'warehouse condition and price');
    const newAxe={...axe,instanceId:'unused-axe',used:false};const pos=game.inventory.findOpenPosition(game.state.warehouse.items,newAxe,0,0,8,8);assert(pos,'room for new axe fixture');game.state.warehouse.items.push({...newAxe,...pos});
    page('home');
  });
  await check('merchant payment previews quantity; unresolved stock blocks stage and persists',async()=>{
    const input=get('[data-merchant-amount="tools"]');input.value='240';input.dispatchEvent(new Event('input',{bubbles:true}));
    assert(get('[data-quote="tools"]').textContent.includes('8品'),'eight-item quote');
    action('buy','[data-id="tools"]');assert(game.state.campaign.trade.incoming.length===8,'paid delivery');
    assert(get('[data-routine="next"]').disabled&&get('[data-routine="skip"]').disabled,'pending trade locks next and skip');
    await saveGame(skin.id,makeSave(game.state));const loaded=await loadGame(skin);assert(JSON.stringify(loaded)===JSON.stringify(game.state),'IndexedDB roundtrip');
    app.destroy();game=createSession(skin,loaded);mount();page('home');assert(!get('[data-screen="purchase"]').hidden,'resume purchase');
    page('warehouse');assert(get('#daily-routine').hidden,'warehouse tab independent');page('home');
    while(game.state.campaign.trade.incoming.length){const item=game.state.campaign.trade.incoming[0];action('keep',`[data-id="${item.instanceId}"]`);if(game.state.campaign.trade.incoming.some(i=>i.instanceId===item.instanceId))action('sellBack',`[data-source="incoming"][data-id="${item.instanceId}"]`);}
    action('finishTrade');step();assert(game.state.campaign.phase==='warehouse','warehouse stage');
  });
  await check('warehouse and stocking stages use existing controllers and can return to previous preparation',()=>{
    assert(!get('[data-screen="warehouse"]').hidden,'warehouse shown within routine');step();
    assert(!get('[data-screen="stocking"]').hidden,'stocking shown');
    const axes=[...get('#available-stock').querySelectorAll('.stock-card')].filter(card=>card.textContent.includes('鉄の斧'));assert(axes.length===2,'used and new axes in separate groups');assert(axes.some(card=>card.textContent.includes('50 G')&&card.textContent.includes('使用済み'))&&axes.some(card=>card.textContent.includes('100 G')),'condition-specific shelf prices');step('back');assert(game.state.campaign.phase==='warehouse','back');step();
    for(const item of [...game.state.warehouse.items]){const pos=game.inventory.findOpenPosition(game.state.shop.displayedItems,item,0,0,5,5);if(pos)game.stocking.put(item.instanceId,pos.x,pos.y);}
    assert(Number(get('#displayed-count').textContent)>0,'shelf rendered');step();
  });
  await check('support shares preparation; map selection enables departure only in support',()=>{
    assert(game.state.campaign.phase==='support','support stage');
    assert(get(`${visible} [data-party="lina"]`).checked&&!get(`${visible} [data-party="bran"]`).checked,'shared party');
    assert(get('[data-action="dispatch"]').disabled,'destination required');
    get('[data-destination="outskirts"]').click();assert(!get('[data-action="dispatch"]').disabled,'map enables departure');
    action('dispatch');assert(game.state.campaign.expedition.heroIds.join()==='lina','selected party dispatched');
    page('adventurers');assert(!get('[data-screen="adventurers"]').querySelector('[data-action="dispatch"]'),'still no dispatch in tab');
    page('home');step();assert(game.state.campaign.phase==='opening','opening stage');
  });
  await check('opening, customer conversations, summary and next-day report form a complete day',()=>{
    action('open');assert(game.state.campaign.phase==='sales','sales stage');
    assert(get('.visitor-list').children.length===5,'all visitors speak');
    assert(!get('.speech-bubble').querySelector('img,svg'),'face outside speech');
    assert(get('.visitor-scene').querySelector(':scope > .scene-actor .item-art'),'separate actor');
    action('salesDone');assert(game.state.campaign.phase==='end','day summary');assert(get('.mvp-stats'),'totals');
    action('nextDay');assert(game.state.campaign.phase==='report'&&game.state.campaign.day===2,'next day');assert(game.state.campaign.expedition===null,'return resolved');
    assert(get('[data-screen="home"]').textContent.includes('1日の記録'),'previous-day summary');
  });
  await check('purchase and support can be skipped; empty shelves can finish a day',()=>{
    step();step('skip');assert(game.state.campaign.phase==='warehouse','skip purchase');step();
    for(const item of [...game.state.shop.displayedItems])game.stocking.return(item.instanceId);
    step();step('skip');assert(game.state.campaign.phase==='opening','skip support');
    // Empty-shelf behavior also has a logic test; current warehouse may be full on return.
    action('open');action('salesDone');action('nextDay');assert(game.state.campaign.day===3,'day completed');
  });
  await check('residents are extensible placeholders and journal excludes repeated visitor dialogue',()=>{
    page('residents');assert(get('[data-screen="residents"]').textContent.includes('大工'),'carpenter');assert(get('[data-screen="residents"]').textContent.includes('教会'),'church');
    assert(!get('[data-screen="residents"]').querySelector('button'),'no invented facility actions');
    page('journal');assert(get('.mvp-parchment').textContent.includes('仕入れ'),'purchase log');assert(!get('.mvp-parchment').textContent.includes('今日は何が並んでいるんだい'),'concise log');
    const state=parseSave(JSON.stringify(makeSave(game.state)),skin);assert(state.campaign.day===3,'JSON roundtrip');page('home');
  });
  await check('legacy saves with both completed sales and pending trade can finish the trade',()=>{
    app.destroy();game=createSession(skin);game.campaign.openShop();game.campaign.startTrade('tools');
    const legacy=makeSave(game.state);legacy.version=3;delete legacy.state.campaign.phase;delete legacy.state.campaign.partyIds;
    game=createSession(skin,parseSave(JSON.stringify(legacy),skin));mount();page('home');
    assert(!get('[data-screen="purchase"]').hidden,'pending legacy trade remains accessible');
    while(game.state.campaign.trade.incoming.length)action('sellBack',`[data-source="incoming"][data-id="${game.state.campaign.trade.incoming[0].instanceId}"]`);
    action('finishTrade');assert(game.state.campaign.phase==='sales'&&!get('[data-screen="home"]').hidden,'returns to previous sales results');
  });
  document.querySelector('#result').textContent=`PASS ${passed}/${passed}`;
}catch(error){document.querySelector('#result').textContent=`FAIL after ${passed}: ${error.message}`;console.error(error);}
