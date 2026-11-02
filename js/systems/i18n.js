export function createI18n(dictionaries, locale = "ja") {
  if (!dictionaries[locale]) throw new Error(`Missing locale: ${locale}`);
  const keys = new Set(Object.values(dictionaries).flatMap(dictionary => Object.keys(dictionary)));
  for (const [id, dictionary] of Object.entries(dictionaries)) {
    for (const key of keys) if (!Object.hasOwn(dictionary, key)) throw new Error(`Missing translation: ${id}.${key}`);
  }
  let currentLocale = locale;
  const listeners = new Set();

  function getLocale() { return currentLocale; }

  function onLocaleChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function t(key, params = {}, fallback = key) {
    const template = dictionaries[currentLocale]?.[key] ?? fallback;
    return String(template).replace(/\{([\w]+)\}/g, (match, name) => (
      Object.hasOwn(params, name) ? String(params[name]) : match
    ));
  }

  function itemName(itemId, fallback = itemId) {
    return t(`items.${itemId}`, {}, fallback);
  }

  function itemShortName(itemId, fallback = itemId) {
    return t(`items.short.${itemId}`, {}, fallback);
  }

  function setLocale(locale) {
    if (!Object.hasOwn(dictionaries, locale)) return false;
    currentLocale = locale;
    for (const listener of listeners) listener(locale);
    return true;
  }

  return { getLocale, onLocaleChange, t, itemName, itemShortName, setLocale };
}
