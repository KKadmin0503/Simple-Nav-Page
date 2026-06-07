import { getDomain } from './utils/url.js?v=20260607-icon-source';
import {
  directFaviconUrl,
  getDefaultFavicon,
  siteFavicon
} from './features/favicon.js?v=20260607-icon-source';

export function renderCards(sections, { config, getCardUrl, onCardClick }) {
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  sections.forEach(({ section, items }) => {
    const sec = document.createElement('div');
    sec.className = 'section';

    const h2 = document.createElement('h2');
    h2.className = 'section-title';

    const titleText = document.createElement('span');
    titleText.textContent = section;

    const countBadge = document.createElement('span');
    countBadge.className = 'section-count';
    countBadge.textContent = String(items.length);

    h2.appendChild(titleText);
    h2.appendChild(countBadge);
    sec.appendChild(h2);

    const grid = document.createElement('div');
    grid.className = 'link-container';

    items.forEach(item => {
      grid.appendChild(createCard(item, { config, getCardUrl, onCardClick }));
    });

    sec.appendChild(grid);
    main.appendChild(sec);
  });

  bindTouchTooltip();
}

function createCard(item, { config, getCardUrl, onCardClick }) {
  const a = document.createElement('a');
  a.href = getCardUrl(item);
  a.target = '_blank';
  a.className = 'card';
  a.dataset.desc = item['data-desc'] ?? item.desc ?? '';
  a.rel = 'noopener noreferrer';
  a.addEventListener('click', () => {
    onCardClick?.(item);
  });

  if (item.intranet) {
    a.dataset.url = item.url;
    a.dataset.intranet = item.intranet;
  }

  const img = document.createElement('img');
  img.className = 'favicon';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.width = 20;
  img.height = 20;
  img.alt = `${item.title} 图标`;
  img.src = siteFavicon(item, config);
  img.onerror = function () {
    if (item.icon && !this.dataset.autoTried) {
      this.dataset.autoTried = '1';
      this.src = siteFavicon({ ...item, icon: '' }, config);
      return;
    }

    const directIcon = directFaviconUrl(item.url);
    if (directIcon && !this.dataset.directTried) {
      this.dataset.directTried = '1';
      this.src = directIcon;
      return;
    }

    if (!this.dataset.defaultTried) {
      this.dataset.defaultTried = '1';
      this.src = getDefaultFavicon(config, item.title);
      this.onerror = null;
    }
  };

  const top = document.createElement('div');
  top.className = 'card-top';

  const titleEl = document.createElement('span');
  titleEl.className = 'title';
  titleEl.textContent = item.title;

  top.appendChild(img);
  top.appendChild(titleEl);

  const desc = document.createElement('div');
  desc.className = 'desc';
  desc.textContent = item.desc ?? '';

  const popup = document.createElement('div');
  popup.className = 'info-popup';
  popup.textContent = getDomain(getCardUrl(item)) ?? getCardUrl(item);

  a.appendChild(top);
  a.appendChild(desc);
  a.appendChild(popup);

  return a;
}

function bindTouchTooltip() {
  if (!window.matchMedia('(hover: none)').matches) return;

  let timer = null;
  let activeCard = null;

  function clearActive() {
    if (activeCard) {
      activeCard.classList.remove('touch-active');
      activeCard = null;
    }
    clearTimeout(timer);
    timer = null;
  }

  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('touchstart', () => {
      clearActive();
      timer = setTimeout(() => {
        card.classList.add('touch-active');
        activeCard = card;
        setTimeout(clearActive, 2000);
      }, 500);
    }, { passive: true });

    card.addEventListener('touchend', () => {
      if (timer) clearTimeout(timer);
    });

    card.addEventListener('touchmove', () => {
      clearTimeout(timer);
      timer = null;
    }, { passive: true });
  });

  document.addEventListener('touchstart', e => {
    if (activeCard && !activeCard.contains(e.target)) clearActive();
  }, { passive: true });
}
