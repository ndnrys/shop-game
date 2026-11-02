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
let game=createSession(skin); let app;
const features=[...['home','purchase','support','journal'].map(id=>({id,mount:mountCampaign})),{id:'warehouse',mount:mountWarehouse},{id:'stocking',mount:mountStocking}];
function mount(){app=mountScreens(fixture,game,features);applyTranslations(fixture,game.i18n);}
mount();
let passed=0;
function assert(value,message){if(!value)throw new Error(message);}
function get(selector){const el=fixture.querySelector(selector);if(!el)throw new Error(selector);return el;}
function page(name){get(`a.screen-link[href="#${name}"]`).click();}
function action(name,extra=''){get(`[data-screen]:not([hidden]) [data-action="${name}"]${extra}`).click();}
function give(id,gear,funds){const form=get(`form[data-hero="${id}"]`);form.elements.gear.value=gear;form.elements.funds.value=funds;form.requestSubmit();}
async function check(name,fn){await fn();passed++;const li=document.createElement('li');li.textContent=`PASS ${name}`;document.querySelector('#checks').append(li);}
try {
  await check('three supporters receive equipment and preparation money through forms',()=>{
    page('support');give('lina','stock-001',50);give('bran','stock-003',50);give('noa','stock-006',50);
    assert(!get('[data-screen="support"]').querySelector('[data-action="returnGear"]'),'no gift return');
    assert(get('[data-screen="support"]').textContent.includes('盾:'),'slot labels');
    assert(game.state.campaign.gold===250,'funds paid');
    assert(game.state.campaign.heroes.every(h=>Object.keys(h.equipment).length>0&&h.funds===50),'all supporters prepared');
    assert(get('[data-screen="support"]').textContent.includes(`${Math.round(game.campaign.chance()*100)}%`),'success preview');
  });
  await check('purchase/keep/buyback/finish controls and persistent pending trade',async()=>{
    page('purchase');action('buy','[data-id="weapons"]');assert(game.state.campaign.trade.incoming.length===4,'draw');
    action('sellBack','[data-source="warehouse"][data-id="stock-007"]');
    const snapshot=makeSave(game.state);await saveGame(skin.id,snapshot);
    const loaded=await loadGame(skin);assert(JSON.stringify(loaded)===JSON.stringify(game.state),'IndexedDB pending trade roundtrip');
    app.destroy();game=createSession(skin,loaded);mount();page('purchase');
    while(game.state.campaign.trade.incoming.length){const item=game.state.campaign.trade.incoming[0];action('keep',`[data-id="${item.instanceId}"]`);if(game.state.campaign.trade.incoming.some(i=>i.instanceId===item.instanceId))action('sellBack',`[data-source="incoming"][data-id="${item.instanceId}"]`);}
    action('finishTrade');assert(game.state.campaign.trade===null,'finished');
  });
  await check('external customers buy displayed goods through dashboard',()=>{
    // The existing stocking controller is independently regression-tested; fill its shelf using its public commands.
    for(const item of [...game.state.warehouse.items]){const pos=game.inventory.findOpenPosition(game.state.shop.displayedItems,item,0,0,5,5);if(pos)game.stocking.put(item.instanceId,pos.x,pos.y);}
    page('home');const before=game.state.campaign.gold;action('open');
    assert(game.state.campaign.gold>before,'sales income');assert(game.state.campaign.milestones.sold,'outside customers');
    assert(get('.visitor-list').children.length===5,'all visitors speak');
    assert(get('.visitor-list').textContent.includes('今日は何が並んでいるんだい？'),'customer dialogue');
    assert(get('[data-screen="home"]').querySelector('section [data-action="open"]'),'opening control');
  });
  await check('dispatch, persisted return, and retry lead to a safe village',async()=>{
    page('support');action('dispatch');assert(game.state.campaign.expedition.heroIds.length===3,'one three-person party');
    const pending=game.state.campaign.expedition;
    await saveGame(skin.id,makeSave(game.state));app.destroy();game=createSession(skin,await loadGame(skin));mount();
    assert(game.state.campaign.expedition.roll===pending.roll,'no reroll');
    page('home');action('nextDay');
    for(let tries=0;!game.state.campaign.defeated&&tries<20;tries++){
      if(game.state.campaign.gold<30){action('relief');if(game.state.campaign.gold<30)action('nextDay');}
      page('support');give('lina','',30);action('dispatch');page('home');action('nextDay');
    }
    assert(game.state.campaign.defeated,'leader defeated');
  });
  await check('full economic loop reaches departure goal without editing balances',()=>{
    for(let days=0;game.state.campaign.gold<game.campaign.config.targetGold&&days<100;days++){
      page('home');if(game.state.campaign.opened)action('nextDay');
      if(game.state.campaign.gold<150)action('relief');
      if(game.state.campaign.gold>=150){page('purchase');action('buy','[data-id="tools"]');while(game.state.campaign.trade.incoming.length){const item=game.state.campaign.trade.incoming[0];action('keep',`[data-id="${item.instanceId}"]`);if(game.state.campaign.trade.incoming.some(i=>i.instanceId===item.instanceId))action('sellBack',`[data-source="incoming"][data-id="${item.instanceId}"]`);}action('finishTrade');}
      for(const item of [...game.state.warehouse.items]){const pos=game.inventory.findOpenPosition(game.state.shop.displayedItems,item,0,0,5,5);if(pos)game.stocking.put(item.instanceId,pos.x,pos.y);}
      page('home');if(game.state.shop.displayedItems.length)action('open');else action('nextDay');
    }
    assert(game.state.campaign.gold>=1200,'goal achievable');
    assert(get('.departure-card'),'departure unlocked');
    get('[data-companion="lina"]').checked=true;get('[data-companion="lina"]').dispatchEvent(new Event('change',{bubbles:true}));
    assert(get('.departure-quote').textContent.includes('250 G'),'quote');action('depart');
    assert(game.state.campaign.departure.companions[0].equipment.weapon.itemId==='iron_sword','gear carried');
    assert(get('.mvp-complete'),'completion');
  });
  await check('completed state and structured journal reload correctly',async()=>{
    page('journal');assert(get('.mvp-parchment').textContent.includes('1年 春1日'),'dated journal');
    assert(get('.mvp-parchment').textContent.includes('村を出発'),'departure entry');
    const parsed=parseSave(JSON.stringify(makeSave(game.state)),skin);await saveGame(skin.id,makeSave(parsed));
    assert((await loadGame(skin)).campaign.region==='next-town','completed persistence');
    page('home');
  });
  document.querySelector('#result').textContent=`PASS ${passed}/${passed}`;
}catch(error){document.querySelector('#result').textContent=`FAIL after ${passed}: ${error.message}`;console.error(error);}
