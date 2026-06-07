export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function withProxy(originUrl, proxy = '') {
  const proxyBase = String(proxy || '').trim().replace(/\/+$/, '');
  if (!proxyBase) return originUrl;
  return `${proxyBase}/${originUrl.replace(/^https?:\/\//, '')}`;
}
