export function initTabTitle(config) {
  const tabConfig = config.tabTitle ?? {};
  const normalTitle = tabConfig.normalTitle || config.site?.title || document.title;

  document.title = normalTitle;

  if (!tabConfig.enabled) {
    return;
  }

  let restoreTimer = null;

  document.addEventListener('visibilitychange', () => {
    clearTimeout(restoreTimer);

    if (document.hidden) {
      document.title = pickTitle(tabConfig.awayTitles, normalTitle);
      return;
    }

    document.title = pickTitle(tabConfig.backTitles, normalTitle);
    restoreTimer = setTimeout(() => {
      document.title = normalTitle;
    }, tabConfig.restoreDelay ?? 2000);
  });
}

export function pickTitle(titles, fallback, random = Math.random) {
  if (!Array.isArray(titles) || titles.length === 0) {
    return fallback;
  }
  return titles[Math.floor(random() * titles.length)] || fallback;
}
