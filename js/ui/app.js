// The entry point supplies feature modules. Screens never import one another.
export function mountScreens(root, game, features) {
  const events = new AbortController();
  const screens = new Map();
  const links = [...root.querySelectorAll(".screen-link")];
  const panels = [...root.querySelectorAll("[data-screen]")];

  for (const feature of features) {
    const panel = panels.find((element) => element.dataset.screen === feature.id);
    if (panel) screens.set(feature.id, { panel, view: feature.mount(panel, game) });
  }

  function render() {
    for (const { view } of screens.values()) view.render();
  }

  function showScreen(id) {
    const activeId = screens.has(id) ? id : screens.keys().next().value;
    for (const panel of panels) panel.hidden = panel.dataset.screen !== activeId;
    for (const link of links) {
      const linkId = link.hash.slice(1);
      const available = screens.has(linkId);
      const active = linkId === activeId;
      link.hidden = !available;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  }

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
