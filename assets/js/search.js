import {
  directFaviconUrl,
  engineFavicon,
  getDefaultFavicon
} from './features/favicon.js';

export function createSearch(config) {
  const categories = config.search?.categories ?? [];
  let currentCategoryId = config.search?.defaultCategoryId ?? categories[0]?.id;
  let currentEngine = categories.find(cat => cat.id === currentCategoryId)?.engines?.[0] ?? categories[0]?.engines?.[0];
  let enginePanelOpen = false;

  function renderSearchTabs() {
    const tabsEl = document.getElementById('searchTabs');
    tabsEl.innerHTML = '';

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `search-tab${cat.id === currentCategoryId ? ' active' : ''}`;
      btn.innerHTML = `<span class="tab-icon">${cat.icon}</span><span class="tab-label">${cat.label}</span>`;
      btn.onclick = () => {
        selectCategory(cat.id);
        if (enginePanelOpen) renderEnginePanel();
      };
      tabsEl.appendChild(btn);
    });
  }

  function updateSearchBoxEngine() {
    const icon = document.getElementById('search-engine-icon');
    const nameEl = document.getElementById('engineName');
    if (!currentEngine) return;

    icon.loading = 'lazy';
    icon.decoding = 'async';
    icon.referrerPolicy = 'no-referrer';
    delete icon.dataset.fallbackTried;
    icon.src = engineFavicon(currentEngine, config);
    icon.onerror = function () {
      const directIcon = directFaviconUrl(currentEngine.url);
      if (directIcon && !this.dataset.fallbackTried) {
        this.dataset.fallbackTried = '1';
        this.src = directIcon;
        return;
      }
      this.src = getDefaultFavicon(config, currentEngine.name);
      this.onerror = null;
    };
    nameEl.textContent = currentEngine.name;
  }

  function selectCategory(catId) {
    currentCategoryId = catId;
    const cat = categories.find(c => c.id === catId);
    currentEngine = cat.engines[0];
    renderSearchTabs();
    updateSearchBoxEngine();
  }

  function selectEngine(engine) {
    currentEngine = engine;
    updateSearchBoxEngine();
    renderEnginePanel();
    document.getElementById('searchInput').focus();
  }

  function renderEnginePanel() {
    const panel = document.getElementById('enginePanel');
    panel.innerHTML = '';
    const cat = categories.find(c => c.id === currentCategoryId);
    if (!cat) return;

    cat.engines.forEach(engine => {
      const btn = document.createElement('button');
      btn.className = `engine-btn${engine === currentEngine ? ' active' : ''}`;

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.src = engineFavicon(engine, config);
      img.alt = engine.name;
      img.onerror = function () {
        const directIcon = directFaviconUrl(engine.url);
        if (directIcon && !this.dataset.fallbackTried) {
          this.dataset.fallbackTried = '1';
          this.src = directIcon;
        } else {
          this.src = getDefaultFavicon(config, engine.name);
          this.onerror = null;
        }
      };

      const label = document.createElement('span');
      label.textContent = engine.name;

      btn.appendChild(img);
      btn.appendChild(label);
      btn.onclick = () => selectEngine(engine);
      panel.appendChild(btn);
    });
  }

  function toggleEnginePanel() {
    enginePanelOpen ? closeEnginePanel() : openEnginePanel();
  }

  function openEnginePanel() {
    enginePanelOpen = true;
    renderEnginePanel();
    document.getElementById('enginePanel').style.display = 'flex';
    document.getElementById('engineArrow').style.transform = 'rotate(180deg)';
  }

  function closeEnginePanel() {
    enginePanelOpen = false;
    document.getElementById('enginePanel').style.display = 'none';
    document.getElementById('engineArrow').style.transform = '';
  }

  function clearSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearBtn');
    input.value = '';
    clearBtn.style.display = 'none';
    input.focus();
    filterLinks();
  }

  function syncClearBtn() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearBtn');
    clearBtn.style.display = input.value.length > 0 ? 'flex' : 'none';
  }

  function doSearch() {
    const kw = document.getElementById('searchInput').value.trim();
    if (kw && currentEngine) {
      window.open(currentEngine.url + encodeURIComponent(kw), '_blank');
    }
  }

  function filterLinks() {
    syncClearBtn();
    const query = document.getElementById('searchInput').value.toLowerCase().trim();

    document.querySelectorAll('.card').forEach(card => {
      if (!query) {
        card.classList.remove('hidden');
        return;
      }

      const title = card.querySelector('.title')?.innerText.toLowerCase() ?? '';
      const datadesc = (card.dataset.desc ?? '').toLowerCase();
      card.classList.toggle('hidden', !title.includes(query) && !datadesc.includes(query));
    });

    document.querySelectorAll('.section').forEach(section => {
      if (!query) {
        section.classList.remove('section-hidden');
        return;
      }

      const visible = section.querySelectorAll('.card:not(.hidden)');
      section.classList.toggle('section-hidden', visible.length === 0);
    });
  }

  function bindEvents() {
    document.getElementById('engineTrigger').addEventListener('click', toggleEnginePanel);
    document.getElementById('searchInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
      if (e.key === 'Escape') closeEnginePanel();
    });

    window.clearSearch = clearSearch;
    window.doSearch = doSearch;
    window.filterLinks = filterLinks;
  }

  function init() {
    renderSearchTabs();
    updateSearchBoxEngine();
    bindEvents();
  }

  return {
    init,
    filterLinks,
    clearSearch,
    doSearch
  };
}
