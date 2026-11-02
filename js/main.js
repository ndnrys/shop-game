import { loadGame } from "./systems/save.js";
import { calendarDate } from "./systems/calendar.js";
import { mountCampaign } from "./ui/campaign.js";
import { mountSaveControls } from "./ui/saveControls.js";
import { createSession } from "./application/createSession.js";
import { mountWarehouse } from "./ui/warehouse.js";
import { mountStocking } from "./ui/stocking.js";
import { mountScreens } from "./ui/app.js";
import { applyTranslations } from "./ui/i18n.js";
import skin from "./data/skins/fantasy/index.js";

let loaded = null;
let loadFailed = false;
try { loaded = await loadGame(skin); } catch { loadFailed = true; }
const game = loaded ? createSession(skin, loaded) : createSession(skin);
const { i18n } = game;
for (const [key, value] of Object.entries(skin.theme)) document.documentElement.style.setProperty(key, value);
document.documentElement.dataset.skin = skin.id;
if (skin.stylesheet) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = skin.stylesheet;
  document.head.append(stylesheet);
}

// Remove a registration and its import to omit a screen; other screens keep working.
const screens = mountScreens(document, game, [
  ...(game.campaign ? ['home','purchase','support','journal','residents','adventurers'].map(id => ({ id, mount: mountCampaign })) : []),
  { id: "warehouse", mount: mountWarehouse },
  { id: "stocking", mount: mountStocking },
]);

applyTranslations(document, i18n);
function renderHeader() {
  if (!game.campaign) return;
  const value = calendarDate(game.state.campaign.day, game.campaign.config.daysPerSeason);
  document.querySelector('#game-date').textContent = i18n.t('mvp.date', { ...value, season: i18n.t(`mvp.season.${value.season}`) });
  document.querySelector('#game-gold').textContent = i18n.t('money.amount', { amount: game.state.campaign.gold.toLocaleString('ja-JP') });
}
renderHeader();
const unsubscribeHeader = game.subscribe(renderHeader);
const saveControls = mountSaveControls(document.querySelector('#save-controls'), game, skin, loadFailed);
const unsubscribeLocale = i18n.onLocaleChange(() => {
  applyTranslations(document, i18n);
  screens.render();
  renderHeader();
});

window.addEventListener("pagehide", (event) => {
  // A back-forward-cache entry resumes with its existing listeners intact.
  if (event.persisted) return;
  unsubscribeLocale();
  unsubscribeHeader();
  saveControls.destroy();
  screens.destroy();
});
