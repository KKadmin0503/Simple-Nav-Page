export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function withProxy(originUrl, proxy = '') {
  if (!proxy) return originUrl;
  return `${proxy}/${originUrl.replace(/^https?:\/\//, '')}`;
}

