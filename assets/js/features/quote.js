export async function initQuote(config) {
  const quoteConfig = config.quote ?? {};
  const subtitleEl = document.getElementById('siteSubtitle');
  if (!subtitleEl || !quoteConfig.enabled || !quoteConfig.endpoint) {
    return;
  }

  const fallback = quoteConfig.fallback || config.site?.subtitle || subtitleEl.textContent;

  try {
    const quote = await fetchQuote(quoteConfig);
    subtitleEl.textContent = normalizeQuote(quote) || fallback;
  } catch (err) {
    console.warn('一言加载失败：', err);
    subtitleEl.textContent = fallback;
  }
}

async function fetchQuote(quoteConfig) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), quoteConfig.timeout ?? 6000);

  try {
    const res = await fetch(quoteConfig.endpoint, {
      cache: 'no-cache',
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    if (quoteConfig.responseType === 'json') {
      const data = await res.json();
      return data.hitokoto || data.text || data.content || '';
    }

    return res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeQuote(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

