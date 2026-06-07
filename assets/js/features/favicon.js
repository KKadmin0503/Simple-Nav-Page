import { getDomain, withProxy } from '../utils/url.js';

export function buildExternalFaviconUrl(domain, config) {
  const faviconConfig = config.favicon ?? {};
  const defaultIcon = getDefaultFavicon(config);
  const provider = faviconConfig.provider ?? 'duckduckgo';

  if (!domain) return defaultIcon;
  if (provider === 'google') {
    return withProxy(`https://www.google.com/s2/favicons?sz=64&domain=${domain}`, faviconConfig.proxy);
  }
  if (provider === 'duckduckgo') {
    return withProxy(`https://icons.duckduckgo.com/ip3/${domain}.ico`, faviconConfig.proxy);
  }
  return defaultIcon;
}

export function faviconSrc(url, config) {
  return buildExternalFaviconUrl(getDomain(url), config);
}

export function siteFavicon(item, config) {
  return String(item?.icon ?? '').trim() || faviconSrc(item?.url, config);
}

export function engineFavicon(engine, config) {
  return buildExternalFaviconUrl(engine.domain, config);
}

export function directFaviconUrl(url) {
  const domain = getDomain(url);
  return domain ? `https://${domain}/favicon.ico` : '';
}

export function getDefaultFavicon(config, label = '') {
  return config.favicon?.defaultIcon || createInitialFavicon(label || config.site?.title || 'Nav');
}

export function createInitialFavicon(label = 'Nav') {
  const text = String(label || 'N').trim().slice(0, 1).toUpperCase() || 'N';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#35d08f"/>
          <stop offset="1" stop-color="#2f7de1"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#g)"/>
      <text x="32" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#fff">${escapeSvg(text)}</text>
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function applyBrowserFavicon(config) {
  const faviconConfig = config.favicon ?? {};
  let href = faviconConfig.imageUrl;

  if (faviconConfig.type === 'emoji' || !href) {
    href = createEmojiFavicon(faviconConfig.emoji || config.site?.headerIcon || '🧭');
  }

  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

function createEmojiFavicon(emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeSvg(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
