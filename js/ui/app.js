// The entry point supplies feature modules. Screens never import one another.
export function mountScreens(root, game, features) {
  const events = new AbortController();
  const screens = new Map();
  let activeId;
  const links = [...root.querySelectorAll(".screen-link")];
  const panels = [...root.querySelectorAll("[data-screen]")];

  for (const feature of features) {
    const panel = panels.find((element) => element.dataset.screen === feature.id);
    if (panel) screens.set(feature.id, { panel, view: feature.mount(panel, game) });
  }

  const routine = root.querySelector('#daily-routine');
  const phases = ['report','purchase','warehouse','stocking','support','opening','sales','end'];
  const stageScreens = { purchase: 'purchase', warehouse: 'warehouse', stocking: 'stocking', support: 'support' };

  function render() {
    const c = game.state.campaign;
    const inRoutine = activeId === 'home' && c?.region === 'village';
    const visibleId = inRoutine ? (c.trade ? 'purchase' : stageScreens[c.phase] ?? 'home') : activeId;
    const actualId = screens.has(visibleId) ? visibleId : activeId;
    for (const panel of panels) panel.hidden = panel.dataset.screen !== actualId;
    screens.get(actualId)?.view.render();
    if (routine) {
      routine.hidden = !inRoutine;
      if (inRoutine) {
        const index = phases.indexOf(c.phase);
        const t = game.i18n.t;
        routine.innerHTML = `<h2>${t('routine.today')}</h2><ol>${phases.map((phase, i) => `<li class="${i < index ? 'is-complete' : ''}" ${phase === c.phase ? 'aria-current="step"' : ''}>${t(`routine.phase.${phase}`)}</li>`).join('')}</ol><div class="mvp-actions">${index > 0 && index < 6 ? `<button type="button" class="mvp-button" data-routine="back" ${c.trade ? 'disabled' : ''}>${t('routine.back')}</button>` : ''}${index < 5 ? `<button type="button" class="mvp-button" data-routine="next" ${c.trade ? 'disabled' : ''}>${t(`routine.next.${c.phase}`)}</button>` : ''}${['purchase','support'].includes(c.phase) ? `<button type="button" class="mvp-button" data-routine="skip" ${c.trade ? 'disabled' : ''}>${t(`routine.skip.${c.phase}`)}</button>` : ''}</div><p role="status" data-routine-status></p>`;
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
    activeId = screens.has(id) ? id : screens.keys().next().value;
    render();
  }
  routine?.addEventListener('click', event => {
    const button = event.target.closest('[data-routine]');
    if (!button || button.disabled) return;
    const result = button.dataset.routine === 'back' ? game.campaign.previousPhase() : game.campaign.advancePhase();
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
