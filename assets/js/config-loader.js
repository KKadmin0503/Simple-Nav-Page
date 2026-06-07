import { apiUrl } from './api-client.js';

const CONFIG_FILE = 'data/default-config.json';
const CONFIG_API = '/api/config';
export const LOCAL_CONFIG_KEY = 'simple-nav-page-config';

export async function loadConfig() {
  const defaultConfig = await loadDefaultConfig();
  const serverConfig = await loadServerConfig();
  const localConfig = readLocalConfig();
  return sanitizeConfig(mergeConfig(defaultConfig, serverConfig, localConfig));
}

export async function loadDefaultConfig() {
  const res = await fetch(CONFIG_FILE, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`默认配置加载失败：${res.status}`);
  }
  return sanitizeConfig(await res.json());
}

export function readLocalConfig() {
  const raw = safeStorageGet(LOCAL_CONFIG_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    safeStorageRemove(LOCAL_CONFIG_KEY);
    return null;
  }
}

export function saveLocalConfig(config) {
  safeStorageSet(LOCAL_CONFIG_KEY, JSON.stringify(config));
}

export function clearLocalConfig() {
  safeStorageRemove(LOCAL_CONFIG_KEY);
}

async function loadServerConfig() {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 1800);

  try {
    const res = await fetch(apiUrl(CONFIG_API), {
      cache: 'no-cache',
      signal: controller.signal
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function mergeConfig(...configs) {
  return configs.filter(item => item != null).reduce((result, item) => {
    if (!isPlainObject(result) || !isPlainObject(item)) {
      return item ?? result;
    }

    const merged = { ...result };
    Object.entries(item).forEach(([key, value]) => {
      merged[key] = isPlainObject(value)
        ? mergeConfig(result[key] ?? {}, value)
        : value;
    });
    return merged;
  }, {});
}

function sanitizeConfig(config) {
  if (isPlainObject(config)) {
    delete config.interactionEffect;
    if (config.site?.title === '一站导航') {
      config.site.title = '澄砚导航';
    }
    if (config.tabTitle?.normalTitle === '一站导航') {
      config.tabTitle.normalTitle = '澄砚导航';
    }
  }
  return config;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
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
    throw new Error(`本地配置保存失败：${err.message}`);
  }
}

function safeStorageRemove(key) {
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // Ignore storage cleanup errors in restricted browser contexts.
  }
}
