export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    if (url.pathname.startsWith('/tools/')) {
      return serveTool(url, env);
    }

    if (url.pathname === '/' && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    const workerHost = url.host; 
    const workerPrefix = `${url.protocol}//${workerHost}/`;

    // 1. 提取目标 URL
    let targetUrlStr = url.pathname.replace(/^\/+/, "");
    
    // 如果没有目标地址，显示欢迎页面
    if (!targetUrlStr) {
      return new Response("导航 Worker 已部署。", {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    // 补全 https 协议
    if (!targetUrlStr.startsWith('http')) {
      targetUrlStr = 'https://' + targetUrlStr;
    }
    targetUrlStr += url.search;

    try {
      const newHeaders = new Headers(request.headers);
      // 模拟常见浏览器，防止被 GitHub 或采集站拦截
      newHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

      const response = await fetch(targetUrlStr, {
        method: request.method,
        headers: newHeaders,
        redirect: "follow"
      });

      const contentType = response.headers.get("Content-Type") || "";
      
      // --- 关键：针对长域名的防止“套娃”逻辑 ---
      if (
        contentType.includes("application/json") || 
        contentType.includes("text/xml") || 
        contentType.includes("application/xml") || 
        contentType.includes("text/plain")
      ) {
        let content = await response.text();

        // 自动将域名中的 . 转义，防止正则解析错误
        // 比如将 x.y.org 转为 x\.y\.org
        const escapedHost = workerHost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // 构建正则：匹配所有 http 链接，但排除掉已经包含本域名的链接
        const regex = new RegExp(`https?://(?!${escapedHost})[^\\s"']+`, 'g');
        
        content = content.replace(regex, (match) => {
          return workerPrefix + match;
        });

        return new Response(content, {
          status: response.status,
          headers: {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache" // 严格无缓存，保证 GitHub 文件和动态图片实时更新
          }
        });
      }

      // 3. 图片、图标、视频等二进制资源直接流式透传
      const modifiedHeaders = new Headers(response.headers);
      modifiedHeaders.set("Access-Control-Allow-Origin", "*");
      
      return new Response(response.body, {
        status: response.status,
        headers: modifiedHeaders
      });

    } catch (e) {
      return new Response("代理请求失败: " + e.message, { status: 500 });
    }
  }
};

const CONFIG_KEY = 'site-config';
const LINKS_KEY = 'links-data';
const TOOL_PREFIX = 'tool:';
const ANALYTICS_TOTAL_KEY = 'analytics:visits:total';
const ANALYTICS_CLICKS_KEY = 'analytics:clicks';
const ANALYTICS_DAILY_PREFIX = 'analytics:visits:day:';
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const MAX_TOOL_SLUG_LENGTH = 64;
const MAX_TOOL_TITLE_LENGTH = 80;
const MAX_TOOL_DESCRIPTION_LENGTH = 160;
const MAX_TOOL_HTML_LENGTH = 250_000;
const MAX_TOOL_COUNT = 50;
const MAX_TOOLS_TOTAL_BYTES = 5 * 1024 * 1024;
const TOOL_CONTENT_SECURITY_POLICY = [
  'sandbox allow-scripts allow-forms allow-popups allow-downloads',
  "default-src 'self' https: data: blob:",
  "img-src 'self' https: data: blob:",
  "style-src 'self' 'unsafe-inline' https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "connect-src 'self' https:"
].join('; ');

async function handleApi(request, env) {
  try {
    return await routeApi(request, env);
  } catch (err) {
    return jsonResponse({
      error: '接口处理失败',
      detail: err?.message || '未知错误'
    }, 500);
  }
}

async function routeApi(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return jsonResponse({}, 204);
  }

  if (url.pathname === '/api/config' && request.method === 'GET') {
    return getConfig(env);
  }

  if (url.pathname === '/api/docs' && request.method === 'GET') {
    return getApiDocs();
  }

  if (url.pathname === '/api/status' && request.method === 'GET') {
    return getWorkerStatus(env);
  }

  if (url.pathname === '/api/analytics' && request.method === 'GET') {
    return getAnalytics(env);
  }

  if (url.pathname === '/api/analytics/visit' && request.method === 'POST') {
    return trackVisit(env);
  }

  if (url.pathname === '/api/analytics/click' && request.method === 'POST') {
    return trackClick(request, env);
  }

  if (url.pathname === '/api/links' && request.method === 'GET') {
    return getLinks(env);
  }

  if (url.pathname === '/api/tools' && request.method === 'GET') {
    return listPublicTools(env);
  }

  if (url.pathname === '/api/admin/login' && request.method === 'POST') {
    return login(request, env);
  }

  if (url.pathname === '/api/admin/config' && request.method === 'GET') {
    const auth = await requireAdmin(request, env);
    if (auth) return auth;
    return getConfig(env);
  }

  if (url.pathname === '/api/admin/config' && request.method === 'PUT') {
    const auth = await requireAdmin(request, env);
    if (auth) return auth;
    return saveConfig(request, env);
  }

  if (url.pathname === '/api/admin/links' && request.method === 'GET') {
    const auth = await requireAdmin(request, env);
    if (auth) return auth;
    return getLinks(env);
  }

  if (url.pathname === '/api/admin/links' && request.method === 'PUT') {
    const auth = await requireAdmin(request, env);
    if (auth) return auth;
    return saveLinks(request, env);
  }

  if (url.pathname === '/api/admin/tools' && request.method === 'GET') {
    const auth = await requireAdmin(request, env);
    if (auth) return auth;
    return listTools(env);
  }

  if (url.pathname === '/api/admin/tools' && request.method === 'PUT') {
    const auth = await requireAdmin(request, env);
    if (auth) return auth;
    return saveTool(request, env);
  }

  if (url.pathname.startsWith('/api/admin/tools/') && request.method === 'DELETE') {
    const auth = await requireAdmin(request, env);
    if (auth) return auth;
    const slug = decodeURIComponent(url.pathname.replace('/api/admin/tools/', ''));
    return deleteTool(slug, env);
  }

  return jsonResponse({ error: '接口不存在' }, 404);
}

function getApiDocs() {
  return jsonResponse({
    name: 'Simple Nav Page Admin API',
    auth: {
      login: {
        method: 'POST',
        path: '/api/admin/login',
        body: { password: 'ADMIN_PASSWORD' },
        response: { token: 'Bearer token for admin APIs' }
      },
      header: 'Authorization: Bearer <token>'
    },
    links: {
      publicRead: 'GET /api/links',
      adminRead: 'GET /api/admin/links',
      adminSave: 'PUT /api/admin/links',
      schema: [
        {
          section: '小工具',
          items: [
            {
              title: 'BMI 计算器',
              url: '/tools/bmi-calculator/',
              desc: '计算 BMI',
              'data-desc': 'BMI 体重 健康',
              icon: 'https://example.com/icon.png',
              intranet: ''
            }
          ]
        }
      ]
    },
    status: {
      publicRead: 'GET /api/status',
      description: '检查 Worker 部署状态、ADMIN_PASSWORD、KV 绑定、配置、分类站点和小工具数量，不返回敏感内容'
    },
    analytics: {
      publicRead: 'GET /api/analytics',
      visit: 'POST /api/analytics/visit',
      click: 'POST /api/analytics/click',
      description: '记录访问量和站点点击次数，用于首页访问统计和动态常用分区'
    },
    tools: {
      publicList: 'GET /api/tools',
      adminList: 'GET /api/admin/tools',
      adminSave: 'PUT /api/admin/tools',
      adminDelete: 'DELETE /api/admin/tools/<slug>',
      publicPage: 'GET /tools/<slug>/',
      saveBody: {
        slug: 'bmi-calculator',
        title: 'BMI 计算器',
        description: '计算 BMI 和健康区间',
        html: '<!doctype html><html lang="zh-CN">...</html>',
        addToNav: true
      },
      limits: {
        slug: `1-${MAX_TOOL_SLUG_LENGTH} chars, lowercase letters/numbers/dash after normalization`,
        title: `1-${MAX_TOOL_TITLE_LENGTH} chars`,
        description: `0-${MAX_TOOL_DESCRIPTION_LENGTH} chars`,
        html: `1-${MAX_TOOL_HTML_LENGTH} chars`,
        maxTools: MAX_TOOL_COUNT,
        maxTotalBytes: MAX_TOOLS_TOTAL_BYTES
      }
    },
    errors: {
      400: '请求体不是合法 JSON，或字段不符合限制',
      401: '未登录、Token 缺失或 Token 已过期',
      404: '接口或小工具页面不存在',
      501: 'Worker 未配置 ADMIN_PASSWORD 或未绑定 CONFIG_KV',
      500: 'Worker 内部处理失败'
    },
    cors: {
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization']
    }
  });
}

async function getWorkerStatus(env) {
  const store = getConfigStore(env);
  const status = {
    ok: false,
    generatedAt: new Date().toISOString(),
    runtime: 'cloudflare-worker',
    checks: {
      adminPassword: {
        ok: Boolean(env.ADMIN_PASSWORD),
        message: env.ADMIN_PASSWORD ? 'ADMIN_PASSWORD 已配置' : '未配置 ADMIN_PASSWORD'
      },
      kvBinding: {
        ok: Boolean(store),
        message: store ? 'CONFIG_KV 已绑定' : '未绑定 CONFIG_KV 或 NAV_CONFIG'
      },
      config: {
        ok: false,
        exists: false,
        keys: 0,
        message: '等待检测'
      },
      links: {
        ok: false,
        sections: 0,
        sites: 0,
        message: '等待检测'
      },
      tools: {
        ok: false,
        count: 0,
        message: '等待检测'
      }
    },
    endpoints: {
      docs: '/api/docs',
      config: '/api/config',
      links: '/api/links',
      tools: '/api/tools',
      adminLogin: '/api/admin/login'
    }
  };

  if (!store) {
    status.checks.config.message = 'KV 未绑定，无法读取配置';
    status.checks.links.message = 'KV 未绑定，无法读取分类站点';
    status.checks.tools.message = 'KV 未绑定，无法读取小工具';
    return jsonResponse(status);
  }

  try {
    const config = await store.get(CONFIG_KEY, 'json');
    status.checks.config.exists = Boolean(config && Object.keys(config).length);
    status.checks.config.keys = config && typeof config === 'object' ? Object.keys(config).length : 0;
    status.checks.config.ok = true;
    status.checks.config.message = status.checks.config.exists ? '配置可读取' : 'KV 中暂无线上配置';
  } catch (err) {
    status.checks.config.message = `配置读取失败：${err.message}`;
  }

  try {
    const links = await store.get(LINKS_KEY, 'json');
    const safeLinks = sanitizeLinks(links);
    status.checks.links.sections = safeLinks.length;
    status.checks.links.sites = safeLinks.reduce((sum, section) => sum + section.items.length, 0);
    status.checks.links.ok = true;
    status.checks.links.message = safeLinks.length ? '分类站点可读取' : 'KV 中暂无线上分类站点';
  } catch (err) {
    status.checks.links.message = `分类站点读取失败：${err.message}`;
  }

  try {
    const tools = await listStoredTools(env, true);
    if (tools instanceof Response) {
      status.checks.tools.message = '小工具读取失败';
    } else {
      const usage = getToolUsage(tools);
      status.checks.tools.count = tools.length;
      status.checks.tools.usage = usage;
      status.checks.tools.ok = true;
      status.checks.tools.message = tools.length
        ? `小工具列表可读取，已用 ${usage.totalBytes} / ${usage.maxTotalBytes} bytes`
        : 'KV 中暂无小工具';
    }
  } catch (err) {
    status.checks.tools.message = `小工具读取失败：${err.message}`;
  }

  status.ok = status.checks.adminPassword.ok
    && status.checks.kvBinding.ok
    && status.checks.config.ok
    && status.checks.links.ok
    && status.checks.tools.ok;

  return jsonResponse(status);
}

async function getAnalytics(env) {
  const store = getConfigStore(env);
  if (!store) {
    return jsonResponse({ error: '未绑定 CONFIG_KV' }, 501);
  }

  return jsonResponse(await readAnalytics(store));
}

async function trackVisit(env) {
  const store = getConfigStore(env);
  if (!store) {
    return jsonResponse({ error: '未绑定 CONFIG_KV' }, 501);
  }

  const dateKey = getTodayKey();
  await incrementNumber(store, ANALYTICS_TOTAL_KEY);
  await incrementNumber(store, `${ANALYTICS_DAILY_PREFIX}${dateKey}`);
  return jsonResponse(await readAnalytics(store));
}

async function trackClick(request, env) {
  const store = getConfigStore(env);
  if (!store) {
    return jsonResponse({ error: '未绑定 CONFIG_KV' }, 501);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: '点击数据必须是 JSON' }, 400);
  }

  const click = sanitizeAnalyticsClick(body);
  if (!click.id) {
    return jsonResponse({ error: '点击数据缺少 id 或 url' }, 400);
  }

  const clicks = normalizeClickMap(await store.get(ANALYTICS_CLICKS_KEY, 'json'));
  const current = clicks[click.id] || {
    id: click.id,
    title: click.title,
    url: click.url,
    count: 0
  };

  clicks[click.id] = {
    ...current,
    title: click.title || current.title,
    url: click.url || current.url,
    count: current.count + 1,
    lastClickedAt: new Date().toISOString()
  };

  await store.put(ANALYTICS_CLICKS_KEY, JSON.stringify(limitClickMap(clicks)));
  return jsonResponse({ ok: true, click: clicks[click.id] });
}

async function readAnalytics(store) {
  const dateKey = getTodayKey();
  const [total, today, clicks] = await Promise.all([
    readNumber(store, ANALYTICS_TOTAL_KEY),
    readNumber(store, `${ANALYTICS_DAILY_PREFIX}${dateKey}`),
    store.get(ANALYTICS_CLICKS_KEY, 'json')
  ]);

  return {
    source: 'server',
    visits: {
      total,
      today,
      date: dateKey
    },
    clicks: normalizeClickMap(clicks)
  };
}

async function incrementNumber(store, key) {
  const next = (await readNumber(store, key)) + 1;
  await store.put(key, String(next));
  return next;
}

async function readNumber(store, key) {
  const value = Number(await store.get(key));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function sanitizeAnalyticsClick(body) {
  const id = String(body?.id || body?.url || '').trim().slice(0, 500);
  return {
    id,
    title: String(body?.title || '').trim().slice(0, 120),
    url: String(body?.url || '').trim().slice(0, 500)
  };
}

function normalizeClickMap(clicks) {
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

function limitClickMap(clicks) {
  return Object.fromEntries(
    Object.entries(clicks)
      .sort(([, a], [, b]) => (b.count || 0) - (a.count || 0))
      .slice(0, 500)
  );
}

function getTodayKey() {
  const chinaOffsetMs = 8 * 60 * 60 * 1000;
  return new Date(Date.now() + chinaOffsetMs).toISOString().slice(0, 10);
}

async function getConfig(env) {
  const store = getConfigStore(env);
  if (!store) {
    return jsonResponse({ error: '未绑定 CONFIG_KV' }, 501);
  }

  const config = await store.get(CONFIG_KEY, 'json');
  return jsonResponse(config || {});
}

async function saveConfig(request, env) {
  const store = getConfigStore(env);
  if (!store) {
    return jsonResponse({ error: '未绑定 CONFIG_KV' }, 501);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: '配置必须是 JSON' }, 400);
  }

  if (!isPlainObject(body)) {
    return jsonResponse({ error: '配置根节点必须是对象' }, 400);
  }

  await store.put(CONFIG_KEY, JSON.stringify(body));
  return jsonResponse({ ok: true, updatedAt: new Date().toISOString() });
}

async function getLinks(env) {
  const store = getConfigStore(env);
  if (!store) {
    return jsonResponse({ error: '未绑定 CONFIG_KV' }, 501);
  }

  const links = await store.get(LINKS_KEY, 'json');
  return jsonResponse(Array.isArray(links) ? links : []);
}

async function saveLinks(request, env) {
  const store = getConfigStore(env);
  if (!store) {
    return jsonResponse({ error: '未绑定 CONFIG_KV' }, 501);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: '链接数据必须是 JSON' }, 400);
  }

  if (!Array.isArray(body)) {
    return jsonResponse({ error: '链接数据必须是分类数组' }, 400);
  }

  const links = sanitizeLinks(body);
  await store.put(LINKS_KEY, JSON.stringify(links));
  return jsonResponse({ ok: true, links, updatedAt: new Date().toISOString() });
}

async function listPublicTools(env) {
  const result = await listStoredTools(env, false);
  return result instanceof Response ? result : jsonResponse({ tools: result.map(toPublicTool) });
}

async function listTools(env) {
  const result = await listStoredTools(env, true);
  return result instanceof Response ? result : jsonResponse({
    tools: result,
    usage: getToolUsage(result)
  });
}

async function saveTool(request, env) {
  const store = getConfigStore(env);
  if (!store) {
    return jsonResponse({ error: '未绑定 CONFIG_KV' }, 501);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: '小工具数据必须是 JSON' }, 400);
  }

  const tool = sanitizeTool(body);
  const validationError = validateTool(tool);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  const existingTools = await listStoredTools(env, true);
  if (existingTools instanceof Response) {
    return existingTools;
  }

  const quotaError = validateToolQuota(existingTools, tool);
  if (quotaError) {
    return jsonResponse({ error: quotaError }, 400);
  }

  await store.put(`${TOOL_PREFIX}${tool.slug}`, JSON.stringify(tool));
  let links = await store.get(LINKS_KEY, 'json');

  if (body.addToNav) {
    links = addToolToLinks(sanitizeLinks(links), tool);
    await store.put(LINKS_KEY, JSON.stringify(links));
  }

  return jsonResponse({
    ok: true,
    tool: toPublicTool(tool),
    usage: getToolUsage(upsertTool(existingTools, tool)),
    links: Array.isArray(links) ? links : undefined,
    url: `/tools/${tool.slug}/`
  });
}

async function deleteTool(slug, env) {
  const store = getConfigStore(env);
  if (!store) {
    return jsonResponse({ error: '未绑定 CONFIG_KV' }, 501);
  }

  const normalized = normalizeSlug(slug);
  if (!normalized) {
    return jsonResponse({ error: 'slug 无效' }, 400);
  }

  await store.delete(`${TOOL_PREFIX}${normalized}`);
  return jsonResponse({ ok: true });
}

async function serveTool(url, env) {
  const store = getConfigStore(env);
  if (!store) {
    return new Response('未绑定 CONFIG_KV', { status: 501 });
  }

  const slug = normalizeSlug(url.pathname.replace(/^\/tools\/([^/]+).*$/, '$1'));
  if (!slug) {
    return new Response('工具不存在', { status: 404 });
  }

  const tool = await store.get(`${TOOL_PREFIX}${slug}`, 'json');
  if (!tool?.html) {
    return new Response('工具不存在', { status: 404 });
  }

  return new Response(tool.html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-cache',
      'Content-Security-Policy': TOOL_CONTENT_SECURITY_POLICY,
      'Referrer-Policy': 'no-referrer-when-downgrade',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function login(request, env) {
  const password = env.ADMIN_PASSWORD;
  if (!password) {
    return jsonResponse({ error: '未配置 ADMIN_PASSWORD' }, 501);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: '请求必须是 JSON' }, 400);
  }

  if (!body?.password || body.password !== password) {
    return jsonResponse({ error: '管理员密码错误' }, 401);
  }

  const token = await signToken(password, Date.now() + TOKEN_TTL_SECONDS * 1000);
  return jsonResponse({ token, expiresIn: TOKEN_TTL_SECONDS });
}

async function requireAdmin(request, env) {
  const password = env.ADMIN_PASSWORD;
  if (!password) {
    return jsonResponse({ error: '未配置 ADMIN_PASSWORD' }, 501);
  }

  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token || !(await verifyToken(token, password))) {
    return jsonResponse({ error: '请先登录后台' }, 401);
  }

  return null;
}

async function signToken(secret, expiresAt) {
  const payload = `${expiresAt}.${crypto.randomUUID()}`;
  const signature = await hmac(secret, payload);
  return `${payload}.${signature}`;
}

async function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expiresAt, nonce, signature] = parts;
  const expiresAtMs = Number(expiresAt);
  if (!Number.isFinite(expiresAtMs) || !nonce || expiresAtMs < Date.now()) return false;
  const expected = await hmac(secret, `${expiresAt}.${nonce}`);
  return constantTimeEqual(signature, expected);
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map(item => item.toString(16).padStart(2, '0')).join('');
}

function getConfigStore(env) {
  return env.CONFIG_KV || env.NAV_CONFIG || null;
}

async function listStoredTools(env, includeHtml) {
  const store = getConfigStore(env);
  if (!store) {
    return jsonResponse({ error: '未绑定 CONFIG_KV' }, 501);
  }

  const tools = [];
  let cursor;

  do {
    const list = await store.list({ prefix: TOOL_PREFIX, cursor });
    for (const key of list.keys) {
      const tool = await store.get(key.name, 'json');
      if (tool) tools.push(includeHtml ? tool : toPublicTool(tool));
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return tools.sort((a, b) => String(a.title || a.slug).localeCompare(String(b.title || b.slug), 'zh-CN'));
}

function sanitizeLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .map(section => ({
      section: String(section?.section ?? '').trim(),
      items: Array.isArray(section?.items) ? section.items.map(sanitizeLinkItem).filter(Boolean) : []
    }))
    .filter(section => section.section && section.section !== '常用');
}

function sanitizeLinkItem(item) {
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

function sanitizeTool(tool) {
  return {
    slug: normalizeSlug(tool?.slug),
    title: String(tool?.title ?? '').trim(),
    description: String(tool?.description ?? '').trim(),
    html: String(tool?.html ?? ''),
    updatedAt: new Date().toISOString()
  };
}

function validateTool(tool) {
  if (!tool.slug || !tool.title || !tool.html.trim()) {
    return 'slug、title、html 不能为空';
  }

  if (tool.slug.length > MAX_TOOL_SLUG_LENGTH) {
    return `slug 不能超过 ${MAX_TOOL_SLUG_LENGTH} 个字符`;
  }

  if (tool.title.length > MAX_TOOL_TITLE_LENGTH) {
    return `工具名称不能超过 ${MAX_TOOL_TITLE_LENGTH} 个字符`;
  }

  if (tool.description.length > MAX_TOOL_DESCRIPTION_LENGTH) {
    return `工具描述不能超过 ${MAX_TOOL_DESCRIPTION_LENGTH} 个字符`;
  }

  if (tool.html.length > MAX_TOOL_HTML_LENGTH) {
    return `HTML 内容不能超过 ${MAX_TOOL_HTML_LENGTH} 个字符`;
  }

  return '';
}

function validateToolQuota(existingTools, nextTool) {
  const nextTools = upsertTool(existingTools, nextTool);
  const usage = getToolUsage(nextTools);

  if (usage.toolCount > MAX_TOOL_COUNT) {
    return `小工具数量不能超过 ${MAX_TOOL_COUNT} 个`;
  }

  if (usage.totalBytes > MAX_TOOLS_TOTAL_BYTES) {
    return `小工具总占用不能超过 ${formatBytes(MAX_TOOLS_TOTAL_BYTES)}，当前保存后将达到 ${formatBytes(usage.totalBytes)}`;
  }

  return '';
}

function upsertTool(tools, tool) {
  const nextTools = Array.isArray(tools) ? [...tools] : [];
  const index = nextTools.findIndex(item => item.slug === tool.slug);
  if (index >= 0) {
    nextTools[index] = tool;
  } else {
    nextTools.push(tool);
  }
  return nextTools;
}

function getToolUsage(tools) {
  const items = Array.isArray(tools) ? tools : [];
  const totalBytes = items.reduce((sum, tool) => sum + byteLength(JSON.stringify(tool)), 0);
  const largestTool = items.reduce((largest, tool) => {
    const bytes = byteLength(JSON.stringify(tool));
    return bytes > largest.bytes
      ? { slug: tool.slug || '', title: tool.title || tool.slug || '', bytes }
      : largest;
  }, { slug: '', title: '', bytes: 0 });

  return {
    toolCount: items.length,
    maxTools: MAX_TOOL_COUNT,
    totalBytes,
    maxTotalBytes: MAX_TOOLS_TOTAL_BYTES,
    maxToolHtmlLength: MAX_TOOL_HTML_LENGTH,
    countPercent: percent(items.length, MAX_TOOL_COUNT),
    bytesPercent: percent(totalBytes, MAX_TOOLS_TOTAL_BYTES),
    largestTool
  };
}

function byteLength(value) {
  return new TextEncoder().encode(String(value || '')).length;
}

function percent(value, max) {
  if (!max) return 0;
  return Math.min(Math.round((Number(value) / Number(max)) * 100), 100);
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value} B`;
}

function toPublicTool(tool) {
  return {
    slug: tool.slug,
    title: tool.title,
    description: tool.description,
    url: `/tools/${tool.slug}/`,
    updatedAt: tool.updatedAt
  };
}

function addToolToLinks(links, tool) {
  const sectionName = '小工具';
  let section = links.find(item => item.section === sectionName);
  if (!section) {
    section = { section: sectionName, items: [] };
    links.push(section);
  }

  const url = `/tools/${tool.slug}/`;
  const item = {
    title: tool.title,
    url,
    desc: tool.description || 'Worker 托管小工具',
    'data-desc': `${tool.title} ${tool.description || ''} 小工具`.trim()
  };
  const index = section.items.findIndex(existing => existing.url === url || existing.title === tool.title);
  if (index >= 0) {
    section.items[index] = item;
  } else {
    section.items.push(item);
  }
  return links;
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

function jsonResponse(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Cache-Control': 'no-cache'
    }
  });
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}
