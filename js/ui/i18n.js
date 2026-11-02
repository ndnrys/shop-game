export function applyTranslations(root, { getLocale, t }) {
  document.documentElement.lang = getLocale();
  for (const element of root.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n, JSON.parse(element.dataset.i18nParams ?? "{}"));
  }
  for (const element of root.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel, {}, element.getAttribute("aria-label") ?? ""));
  }
  for (const element of root.querySelectorAll("[data-i18n-title]")) {
    element.setAttribute("title", t(element.dataset.i18nTitle, {}, element.getAttribute("title") ?? ""));
  }
  const title = root.querySelector("title[data-i18n]");
  if (title) document.title = title.textContent;
}
