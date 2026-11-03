// Isolated UI preview: never reads or writes the player's save.
import { calendarDate } from '../js/systems/calendar.js';
import { mountLocaleControls } from '../js/ui/localeControls.js';
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { mountScreens } from '../js/ui/app.js';
import { mountCampaign } from '../js/ui/campaign.js';
import { mountWarehouse } from '../js/ui/warehouse.js';
import { mountStocking } from '../js/ui/stocking.js';
import { applyTranslations } from '../js/ui/i18n.js';
const game=createSession({...skin,id:'routine-preview'});
// Preview-only fixture: each companion has one unallocated level-up.
if (new URLSearchParams(location.search).has('growth')) {
  for (const hero of game.state.campaign.heroes) {
    hero.level += 1;
    hero.pendingGrowth = 1;
  }
}

if(new URLSearchParams(location.search).has('dungeons')){
  game.state.campaign.phase='support';
  game.campaign.support('kyle','stock-001');
}

if(new URLSearchParams(location.search).has('health')){
  const c=game.state.campaign;c.phase='support';
  game.campaign.support('mira','stock-007');
  c.heroes[0].health='light';c.heroes[0].recoverUntil=c.day+2;
  c.heroes[1].health='dead';
}

if(new URLSearchParams(location.search).has('chapterClear')){
  const c=game.state.campaign;c.phase='support';c.dungeonProgress={forest:60,camp:140};c.defeated=true;c.gold=0;
}

for(const [key,value] of Object.entries(skin.theme))document.documentElement.style.setProperty(key,value);
document.documentElement.dataset.skin='fantasy';
const app=mountScreens(document,game,[...['home','purchase','support','journal','residents','adventurers'].map(id=>({id,mount:mountCampaign})),{id:'settings',mount:()=>({render(){},destroy(){}})},{id:'warehouse',mount:mountWarehouse},{id:'stocking',mount:mountStocking}]);
applyTranslations(document,game.i18n);
const header=()=>{const value=calendarDate(game.state.campaign.day,game.campaign.config.daysPerSeason);document.querySelector('#game-date').textContent=game.i18n.t('mvp.date',{...value,season:game.i18n.t(`mvp.season.${value.season}`)});document.querySelector('#game-gold').textContent=game.i18n.t('money.amount',{amount:game.state.campaign.gold.toLocaleString(game.i18n.getLocale())});};
header();const unsubscribe=game.subscribe(header);
const localeControls=mountLocaleControls(document.querySelector('#locale-select'),game);
const unsubscribeLocale=game.i18n.onLocaleChange(()=>{applyTranslations(document,game.i18n);app.render();header();});
document.querySelector('#save-controls').hidden=true;
window.addEventListener('pagehide',event=>{if(!event.persisted){app.destroy();unsubscribe();localeControls.destroy();unsubscribeLocale();}});

// Optional report preview uses the same isolated session and production action.
if (new URLSearchParams(location.search).has('report')) document.querySelector('[data-routine="details"]')?.click();

if (new URLSearchParams(location.search).has('procurement')) { game.campaign.advancePhase(); }
