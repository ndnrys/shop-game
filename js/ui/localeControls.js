// Language is presentation state only; it never enters a game save.
export function mountLocaleControls(root, game) {
  if (!root) return { render() {}, destroy() {} };
  const events = new AbortController();
  const render = () => { root.value = game.i18n.getLocale(); };
  root.addEventListener('change', () => {
    game.i18n.setLocale(root.value);
    render();
  }, { signal: events.signal });
  const unsubscribe = game.i18n.onLocaleChange(render);
  render();
  return { render, destroy() { unsubscribe(); events.abort(); } };
}
