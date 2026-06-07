const API_BASE_META = 'simple-nav-api-base';

export function getApiBase() {
  const globalBase = normalizeBase(typeof window !== 'undefined' ? window.SIMPLE_NAV_API_BASE : '');
  if (globalBase) return globalBase;

  const metaBase = normalizeBase(
    typeof document !== 'undefined'
      ? document.querySelector(`meta[name="${API_BASE_META}"]`)?.content
      : ''
  );
  if (metaBase) return metaBase;

  return '';
}

export function apiUrl(path) {
  const normalizedPath = normalizePath(path);
  const base = getApiBase();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function workerPathUrl(path) {
  if (!isWorkerPath(path)) return path;
  return apiUrl(path);
}

function isWorkerPath(path) {
  return typeof path === 'string' && /^\/(?:api|tools)\//.test(path);
}

function normalizePath(path) {
  const value = String(path || '').trim();
  if (!value) return '/';
  return value.startsWith('/') ? value : `/${value}`;
}

function normalizeBase(value) {
  const base = String(value || '').trim();
  if (!base || base === '/') return '';
  return base.replace(/\/+$/, '');
}
