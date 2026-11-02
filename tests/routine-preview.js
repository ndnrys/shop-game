// Isolated UI preview: never reads or writes the player's save.
import skin from '../js/data/skins/fantasy/index.js';
import { createSession } from '../js/application/createSession.js';
import { mountScreens } from '../js/ui/app.js';
import { mountCampaign } from '../js/ui/campaign.js';
import { mountWarehouse } from '../js/ui/warehouse.js';
import { mountStocking } from '../js/ui/stocking.js';
import { applyTranslations } from '../js/ui/i18n.js';
const game=createSession({...skin,id:'routine-preview'});
for(const [key,value] of Object.entries(skin.theme))document.documentElement.style.setProperty(key,value);
document.documentElement.dataset.skin='fantasy';
const app=mountScreens(document,game,[...['home','purchase','support','journal','residents','adventurers'].map(id=>({id,mount:mountCampaign})),{id:'warehouse',mount:mountWarehouse},{id:'stocking',mount:mountStocking}]);
applyTranslations(document,game.i18n);
const header=()=>{document.querySelector('#game-date').textContent=game.i18n.t('mvp.date',{year:1,season:game.i18n.t('mvp.season.0'),day:game.state.campaign.day});document.querySelector('#game-gold').textContent=game.i18n.t('money.amount',{amount:game.state.campaign.gold});};
header();const unsubscribe=game.subscribe(header);
document.querySelector('#save-controls').hidden=true;
window.addEventListener('pagehide',event=>{if(!event.persisted){app.destroy();unsubscribe();}});
