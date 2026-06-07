import { loadConfig } from './config-loader.js';
import { applyBackground } from './features/background.js?v=20260607-adapt-a11y2';
import { applyBrowserFavicon } from './features/favicon.js?v=20260607-inkmark-logo';
import { initTabTitle } from './features/tab-title.js';
import { initQuote } from './features/quote.js';
import { createNetMode } from './features/net-mode.js';
import { initAmbientEffect } from './effects/ambient-manager.js?v=20260607-adapt-a11y2';
import { initLive2D } from './features/live2d.js?v=20260607-adapt-a11y2';
import { renderCards } from './nav-renderer.js?v=20260607-front-optimize';
import { createSearch } from './search.js?v=20260607-front-optimize';
import { getDomain } from './utils/url.js?v=20260607-icon-source';
import { loadLinksData } from './links-loader.js?v=20260607-links-fallback';
import {
  buildDynamicSections,
  initAnalytics,
  recordLinkClick,
  renderVisitStats
} from './features/analytics.js?v=20260607-analytics';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const config = await loadConfig();
    applySiteConfig(config);
    applyBrowserFavicon(config);
    initTabTitle(config);
    applyBackground(config);
    initAmbientEffect(config);
    initQuote(config);
    const analytics = await initAnalytics(config);
    renderVisitStats(analytics, config);

    const search = createSearch(config);
    search.init();

    const netMode = createNetMode({ getDomain });
    netMode.injectNetToggleBtn();
    netMode.updateNetToggleBtn();
    window.toggleNetMode = netMode.toggleNetMode;

    const links = buildDynamicSections(
      await loadLinksData(config.assets?.linksFile ?? 'links.json'),
      analytics,
      config
    );
    renderCards(links, {
      config,
      getCardUrl: netMode.getCardUrl,
      onCardClick: recordLinkClick
    });

    runWhenIdle(() => initLive2D(config), 1800);
  } catch (err) {
    console.error(err);
    showStartupError(err);
  }
});

function runWhenIdle(callback, timeout = 1500) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout });
    return;
  }

  window.setTimeout(callback, Math.min(timeout, 500));
}

function applySiteConfig(config) {
  const site = config.site ?? {};
  document.title = site.title || document.title;

  const titleEl = document.getElementById('siteTitle');
  if (titleEl) titleEl.textContent = site.title ?? '';

  const subtitleEl = document.getElementById('siteSubtitle');
  if (subtitleEl) subtitleEl.textContent = site.subtitle ?? '';

  const headerIcon = document.getElementById('headerIcon');
  if (headerIcon) {
    const logoUrl = String(site.logoUrl || config.favicon?.imageUrl || '').trim();
    if (logoUrl) {
      headerIcon.classList.add('brand-mark');
      headerIcon.innerHTML = '';
      const logo = document.createElement('img');
      logo.src = logoUrl;
      logo.alt = '';
      logo.decoding = 'async';
      logo.width = 46;
      logo.height = 46;
      headerIcon.appendChild(logo);
    } else {
      headerIcon.classList.remove('brand-mark');
      headerIcon.textContent = site.headerIcon ?? '';
    }
  }

  const headerAccent = document.getElementById('headerAccent');
  if (headerAccent) headerAccent.textContent = site.headerAccent ?? '';
}

function showStartupError(err) {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <p style="color:rgba(255,255,255,0.72);text-align:center;padding:2rem;">
      页面初始化失败，请检查配置和链接数据。${err?.message ? `<br>${err.message}` : ''}
    </p>
  `;
}
