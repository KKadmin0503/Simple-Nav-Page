import { apiUrl } from '../api-client.js';

const VISIT_API = '/api/analytics/visit';
const CLICK_API = '/api/analytics/click';
const LOCAL_ANALYTICS_KEY = 'simple-nav-page-analytics';
const POPULAR_LIMIT = 16;
const POPULAR_SECTION_TITLE = '常用';

export async function initAnalytics(config) {
  if (config.analytics?.enabled === false) {
    return createEmptyAnalytics();
  }

  const localAnalytics = incrementLocalVisit();
  const serverAnalytics = await postJson(VISIT_API, {
    date: getTodayKey()
  });

  return normalizeAnalytics(serverAnalytics || localAnalytics);
}

export function renderVisitStats(analytics, config) {
  if (config.analytics?.visitStatsEnabled === false) return;

  const root = document.getElementById('visitStats');
  if (!root) return;

  const normalized = normalizeAnalytics(analytics);
  const totalEl = document.getElementById('visitTotal');
  const todayEl = document.getElementById('visitToday');
  const sourceEl = document.getElementById('visitSource');

  if (totalEl) totalEl.textContent = formatNumber(normalized.visits.total);
  if (todayEl) todayEl.textContent = formatNumber(normalized.visits.today);
  if (sourceEl) sourceEl.textContent = normalized.source === 'server' ? '全站统计' : '本地预览';
  root.hidden = false;
}

export function buildDynamicSections(sections, analytics, config) {
  const title = config.analytics?.popularSectionTitle || POPULAR_SECTION_TITLE;
  const limit = Math.min(Number(config.analytics?.popularLimit) || POPULAR_LIMIT, POPULAR_LIMIT);
  const sourceSections = sections.filter(section => section.section !== title);
  const popularItems = getPopularItems(sourceSections, analytics, limit);

  if (!popularItems.length) {
    return sourceSections;
  }

  return [
    { section: title, items: popularItems },
    ...sourceSections
  ];
}

export function recordLinkClick(item) {
  const payload = sanitizeClickPayload(item);
  if (!payload.id) return;

  incrementLocalClick(payload);
  sendClick(payload);
}

function getPopularItems(sections, analytics, limit) {
  const clicks = normalizeAnalytics(analytics).clicks;
  const seen = new Set();
  const candidates = [];

  sections.forEach(section => {
    section.items.forEach(item => {
      const id = getLinkId(item);
      if (!id || seen.has(id)) return;
      seen.add(id);

      const count = clicks[id]?.count || 0;
      if (count <= 0) return;

      candidates.push({
        item,
        count,
        lastClickedAt: clicks[id]?.lastClickedAt || ''
      });
    });
  });

  return candidates
    .sort((a, b) => b.count - a.count || String(b.lastClickedAt).localeCompare(String(a.lastClickedAt)))
    .slice(0, limit)
    .map(entry => entry.item);
}

function sendClick(payload) {
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(apiUrl(CLICK_API), blob)) return;
    }
  } catch {
    // Fall back to fetch below.
  }

  fetch(apiUrl(CLICK_API), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {});
}

async function postJson(url, body) {
  try {
    const res = await fetch(apiUrl(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-cache'
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { ...data, source: 'server' };
  } catch {
    return null;
  }
}

function incrementLocalVisit() {
  const analytics = readLocalAnalytics();
  const today = getTodayKey();
  analytics.visits.total += 1;
  analytics.visits.byDate[today] = (analytics.visits.byDate[today] || 0) + 1;
  saveLocalAnalytics(analytics);
  return localToPublicAnalytics(analytics);
}

function incrementLocalClick(payload) {
  const analytics = readLocalAnalytics();
  const current = analytics.clicks[payload.id] || {
    id: payload.id,
    title: payload.title,
    url: payload.url,
    count: 0
  };

  analytics.clicks[payload.id] = {
    ...current,
    title: payload.title,
    url: payload.url,
    count: current.count + 1,
    lastClickedAt: new Date().toISOString()
  };
  saveLocalAnalytics(analytics);
}

function readLocalAnalytics() {
  try {
    const raw = window.localStorage?.getItem(LOCAL_ANALYTICS_KEY);
    if (!raw) return createLocalAnalytics();
    return normalizeLocalAnalytics(JSON.parse(raw));
  } catch {
    return createLocalAnalytics();
  }
}

function saveLocalAnalytics(analytics) {
  try {
    window.localStorage?.setItem(LOCAL_ANALYTICS_KEY, JSON.stringify(analytics));
  } catch {
    // Analytics must never block navigation.
  }
}

function createLocalAnalytics() {
  return {
    visits: {
      total: 0,
      byDate: {}
    },
    clicks: {}
  };
}

function normalizeLocalAnalytics(value) {
  return {
    visits: {
      total: Number(value?.visits?.total) || 0,
      byDate: isPlainObject(value?.visits?.byDate) ? value.visits.byDate : {}
    },
    clicks: normalizeClicks(value?.clicks)
  };
}

function localToPublicAnalytics(analytics) {
  const today = getTodayKey();
  return {
    source: 'local',
    visits: {
      total: analytics.visits.total,
      today: Number(analytics.visits.byDate[today]) || 0,
      date: today
    },
    clicks: analytics.clicks
  };
}

function normalizeAnalytics(value) {
  if (!value) return createEmptyAnalytics();
  const today = getTodayKey();

  return {
    source: value.source || 'local',
    visits: {
      total: Number(value.visits?.total) || 0,
      today: Number(value.visits?.today) || 0,
      date: value.visits?.date || today
    },
    clicks: normalizeClicks(value.clicks)
  };
}

function createEmptyAnalytics() {
  return {
    source: 'local',
    visits: {
      total: 0,
      today: 0,
      date: getTodayKey()
    },
    clicks: {}
  };
}

function normalizeClicks(clicks) {
  if (!isPlainObject(clicks)) return {};

  return Object.fromEntries(Object.entries(clicks).map(([id, value]) => {
    if (typeof value === 'number') {
      return [id, { id, count: value }];
    }

    return [id, {
      id,
      title: String(value?.title ?? ''),
      url: String(value?.url ?? ''),
      count: Number(value?.count) || 0,
      lastClickedAt: String(value?.lastClickedAt ?? '')
    }];
  }));
}

function sanitizeClickPayload(item) {
  const id = getLinkId(item);
  return {
    id,
    title: String(item?.title || '').slice(0, 120),
    url: String(item?.url || '').slice(0, 500)
  };
}

function getLinkId(item) {
  return String(item?.url || item?.title || '').trim();
}

function getTodayKey() {
  const chinaOffsetMs = 8 * 60 * 60 * 1000;
  return new Date(Date.now() + chinaOffsetMs).toISOString().slice(0, 10);
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value) || 0);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}
