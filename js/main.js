import { createSession } from "./application/createSession.js";
import { mountWarehouse } from "./ui/warehouse.js";
import { mountStocking } from "./ui/stocking.js";
import { mountScreens } from "./ui/app.js";
import { applyTranslations } from "./ui/i18n.js";
import skin from "./data/skins/fantasy/index.js";

const game = createSession(skin);
const { i18n } = game;
for (const [key, value] of Object.entries(skin.theme)) document.documentElement.style.setProperty(key, value);

// Remove a registration and its import to omit a screen; other screens keep working.
const screens = mountScreens(document, game, [
  { id: "warehouse", mount: mountWarehouse },
  { id: "stocking", mount: mountStocking },
]);

applyTranslations(document, i18n);
const unsubscribeLocale = i18n.onLocaleChange(() => {
  applyTranslations(document, i18n);
  screens.render();
});

window.addEventListener("pagehide", (event) => {
  // A back-forward-cache entry resumes with its existing listeners intact.
  if (event.persisted) return;
  unsubscribeLocale();
  screens.destroy();
});
