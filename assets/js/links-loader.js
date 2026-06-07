import { apiUrl } from './api-client.js';

const LINKS_API = '/api/links';
export const LOCAL_LINKS_KEY = 'simple-nav-page-links';

export async function loadLinksData(file = 'links.json') {
  const defaultLinks = await loadDefaultLinks(file);
  const serverLinks = await loadServerLinks();
  const localLinks = readLocalLinks();
  return firstNonEmptyLinks(localLinks, serverLinks, defaultLinks);
}

export async function loadDefaultLinks(file = 'links.json') {
  const res = await fetch(file, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`链接数据加载失败：${res.status}`);
  }
  return sanitizeLinks(await res.json());
}

export function readLocalLinks() {
  const raw = safeStorageGet(LOCAL_LINKS_KEY);
  if (!raw) return null;

  try {
    return sanitizeLinks(JSON.parse(raw));
  } catch {
    safeStorageRemove(LOCAL_LINKS_KEY);
    return null;
  }
}

export function saveLocalLinks(links) {
  safeStorageSet(LOCAL_LINKS_KEY, JSON.stringify(sanitizeLinks(links)));
}

export function clearLocalLinks() {
  safeStorageRemove(LOCAL_LINKS_KEY);
}

async function loadServerLinks() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 1800);

  try {
    const res = await fetch(apiUrl(LINKS_API), {
      cache: 'no-cache',
      signal: controller.signal
    });
    if (!res.ok) return null;
    return sanitizeLinks(await res.json());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function sanitizeLinks(links) {
  if (!Array.isArray(links)) return [];

  return links
    .map(section => ({
      section: String(section?.section ?? '').trim(),
      items: Array.isArray(section?.items) ? section.items.map(sanitizeItem).filter(Boolean) : []
    }))
    .filter(section => section.section && section.section !== '常用');
}

function firstNonEmptyLinks(...sources) {
  for (const source of sources) {
    const links = sanitizeLinks(source);
    if (links.length) return links;
  }
  return [];
}

function sanitizeItem(item) {
  const title = String(item?.title ?? '').trim();
  const url = String(item?.url ?? '').trim();
  if (!title || !url) return null;

  return {
    title,
    url,
    desc: String(item?.desc ?? '').trim(),
    'data-desc': String(item?.['data-desc'] ?? item?.dataDesc ?? item?.desc ?? '').trim(),
    ...(item?.icon ? { icon: String(item.icon).trim() } : {}),
    ...(item?.intranet ? { intranet: String(item.intranet).trim() } : {})
  };
}

function safeStorageGet(key) {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch (err) {
    throw new Error(`本地链接保存失败：${err.message}`);
  }
}

function safeStorageRemove(key) {
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // Ignore storage cleanup errors in restricted browser contexts.
  }
}
