import { calendarDate } from "../systems/calendar.js";

// The entry point supplies feature modules. Screens never import one another.
export function mountScreens(root, game, features) {
  const events = new AbortController();
  const screens = new Map();
  let activeId;
  let detailsOpen = false;
  let lastPhase;
  const links = [...root.querySelectorAll(".screen-link")];
  const panels = [...root.querySelectorAll("[data-screen]")];

  for (const feature of features) {
    const panel = panels.find((element) => element.dataset.screen === feature.id);
    if (panel) screens.set(feature.id, { panel, view: feature.mount(panel, game) });
  }

  const routine = root.querySelector('#daily-routine');
  const phases = ['report','purchase','warehouse','stocking','support','sales'];
  const stageScreens = { purchase: 'purchase', warehouse: 'warehouse', stocking: 'stocking', support: 'support' };

  function render() {
    const c = game.state.campaign;
    const inRoutine = activeId === 'home' && c?.region === 'village';
    const visibleId = inRoutine ? (c.trade ? 'purchase' : stageScreens[c.phase] ?? 'home') : activeId;
    const actualId = screens.has(visibleId) ? visibleId : activeId;
    if (lastPhase !== c?.phase) {
      detailsOpen = (lastPhase === 'report' && c?.phase === 'purchase') || Boolean(c?.trade);
      lastPhase = c?.phase;
    }
    root.querySelector('.app-shell')?.classList.toggle('home-dashboard', Boolean(inRoutine));
    root.querySelector('.app-shell')?.classList.toggle('home-details', Boolean(inRoutine && detailsOpen));
    root.querySelector('.app-shell')?.classList.toggle('home-report', Boolean(inRoutine && detailsOpen && c.phase === 'report'));
    const inProcurement = Boolean(inRoutine && detailsOpen && c.phase === 'purchase' && !c.trade);
    root.querySelector('.app-shell')?.classList.toggle('home-procurement', inProcurement);
    const storeLabel = root.querySelector('.topbar .day-label > span:first-child');
    if (storeLabel) storeLabel.textContent = game.i18n.t('app.storeName');
    const interior = root.querySelector('#shop-interior');
    if (interior) {
      interior.hidden = !inRoutine;
      const art = game.campaign?.config.presentation?.home;
      if (art) {
        interior.style.backgroundImage = `url("${art.background}")`;
      }
    }
    for (const panel of panels) panel.hidden = panel.dataset.screen !== actualId;
    screens.get(actualId)?.view.render();
    if (routine) {
      routine.hidden = !inRoutine;
      if (inRoutine) {
        const index = phases.indexOf(c.phase);
        const t = game.i18n.t;
        const date = calendarDate(c.day, game.campaign.config.daysPerSeason);
        const dateLabel = t('mvp.date', { ...date, season: t(`mvp.season.${date.season}`) });
        const visiblePhases = phases;
        const displayPhase = c.phase;
        const icons = { report: '✎', purchase: '⚖', warehouse: '▣', stocking: '▤', support: '⚔', sales: '♜' };
        const label = phase => t(`routine.phase.${phase}`);
        routine.innerHTML = `<header class="home-panel-heading"><h2>${t('home.today')}</h2><span class="home-date">${dateLabel}</span></header><div class="home-phase-card"><span class="home-phase-icon" aria-hidden="true">${icons[c.phase]}</span><div><h3>${t(c.phase === 'report' ? `home.phase.${c.phase}` : `routine.phase.${c.phase}`)}</h3><p>${t(`home.description.${c.phase}`)}</p></div></div><button type="button" class="home-primary" data-routine="details" aria-expanded="${detailsOpen}">${t(detailsOpen ? 'home.close' : `home.action.${c.phase}`)}<span aria-hidden="true">›</span></button><ol>${visiblePhases.map(phase => `<li aria-label="${label(phase)}" class="${phases.indexOf(phase) < index ? 'is-complete' : ''}" ${phase === displayPhase ? 'aria-current="step"' : ''}><span aria-hidden="true">◆</span></li>`).join('')}</ol><p class="home-current-step">${label(displayPhase)}</p><div class="mvp-actions" ${detailsOpen ? '' : 'hidden'}>${index > 0 && index < 5 ? `<button type="button" class="mvp-button" data-routine="back" ${c.trade ? 'disabled' : ''}>${t('routine.back')}</button>` : ''}${index < 4 ? `<button type="button" class="mvp-button" data-routine="next" ${c.trade ? 'disabled' : ''}>${t(`routine.next.${c.phase}`)}</button>` : ''}${c.phase === 'support' ? `<button type="button" class="mvp-button" data-routine="open" ${c.trade ? 'disabled' : ''}>${t('routine.open')}</button>` : ''}${c.phase === 'purchase' ? `<button type="button" class="mvp-button" data-routine="skip" ${c.trade ? 'disabled' : ''}>${t(`routine.skip.${c.phase}`)}</button>` : ''}</div><p role="status" data-routine-status></p>`;
      }
    }
    for (const link of links) {
      const linkId = link.hash.slice(1);
      link.hidden = !screens.has(linkId) || Boolean(game.campaign && screens.has('home') && link.hasAttribute('data-preparation-link'));
      link.classList.toggle('is-active', linkId === activeId);
      if (linkId === activeId) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  function showScreen(id) {
    // Old preparation links now return to the current daily step.
    if (game.campaign && screens.has('home') && ['purchase','stocking','support'].includes(id)) id = 'home';
    detailsOpen = false;
    activeId = screens.has(id) ? id : screens.keys().next().value;
    render();
  }
  routine?.addEventListener('click', event => {
    const button = event.target.closest('[data-routine]');
    if (!button || button.disabled) return;
    if (button.dataset.routine === 'details') { detailsOpen = !detailsOpen; render(); return; }
    const result = button.dataset.routine === 'back' ? game.campaign.previousPhase() : button.dataset.routine === 'open' ? game.campaign.openShop() : game.campaign.advancePhase();
    if (!result.ok) routine.querySelector('[data-routine-status]').textContent = game.i18n.t(result.reason);
  }, { signal: events.signal });

  for (const link of links) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (!screens.has(link.hash.slice(1))) return;
      history.replaceState(null, "", link.hash);
      showScreen(link.hash.slice(1));
    }, { signal: events.signal });
  }
  window.addEventListener("hashchange", () => showScreen(location.hash.slice(1)), { signal: events.signal });
  const unsubscribe = game.subscribe(render);
  showScreen(location.hash.slice(1));

  return {
    render,
    destroy() {
      unsubscribe();
      events.abort();
      for (const { view } of screens.values()) view.destroy();
    },
  };
}
