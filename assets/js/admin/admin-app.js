import {
  clearLocalConfig,
  loadConfig,
  loadDefaultConfig,
  saveLocalConfig
} from '../config-loader.js';
import {
  clearLocalLinks,
  loadDefaultLinks,
  loadLinksData,
  saveLocalLinks,
  sanitizeLinks
} from '../links-loader.js';
import { apiUrl, getApiBase, workerPathUrl } from '../api-client.js';

const ADMIN_TOKEN_KEY = 'simple-nav-page-admin-token';
const LOGIN_API = '/api/admin/login';
const ADMIN_CONFIG_API = '/api/admin/config';
const ADMIN_LINKS_API = '/api/admin/links';
const ADMIN_TOOLS_API = '/api/admin/tools';
const SITE_META_API = '/api/admin/site-meta';
const STATUS_API = '/api/status';

let currentConfig = null;
let currentLinks = [];
let selectedSectionIndex = 0;
let tools = [];
let toolUsage = createEmptyToolUsage();
let selectedToolSlug = '';
let adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
let saveProgressSaved = false;
let workerStatus = null;
let workerStatusError = '';

const form = document.getElementById('adminForm');
const statusBar = document.getElementById('statusBar');
const jsonEditor = document.getElementById('jsonEditor');
const previewFrame = document.getElementById('previewFrame');
const linksEditor = document.getElementById('linksEditor');
const linksSummary = document.getElementById('linksSummary');
const sectionList = document.getElementById('sectionList');
const sectionNameInput = document.getElementById('sectionNameInput');
const siteList = document.getElementById('siteList');
const toolsList = document.getElementById('toolsList');
const toolUsageSummary = document.getElementById('toolUsageSummary');
const toolLargestValue = document.getElementById('toolLargestValue');
const toolCountValue = document.getElementById('toolCountValue');
const toolCountBar = document.getElementById('toolCountBar');
const toolCountPercent = document.getElementById('toolCountPercent');
const toolBytesValue = document.getElementById('toolBytesValue');
const toolBytesBar = document.getElementById('toolBytesBar');
const toolBytesPercent = document.getElementById('toolBytesPercent');
const loginPanel = document.getElementById('loginPanel');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const passwordInput = document.getElementById('passwordInput');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const loadJsonBtn = document.getElementById('loadJsonBtn');
const reloadLinksBtn = document.getElementById('reloadLinksBtn');
const reloadToolsBtn = document.getElementById('reloadToolsBtn');
const saveToolBtn = document.getElementById('saveToolBtn');
const deleteToolBtn = document.getElementById('deleteToolBtn');
const toolSlugInput = document.getElementById('toolSlug');
const toolTitleInput = document.getElementById('toolTitle');
const toolHtmlInput = document.getElementById('toolHtml');
const setupModeTitle = document.getElementById('setupModeTitle');
const setupModeText = document.getElementById('setupModeText');
const setupRemoteStep = document.querySelector('[data-setup-step="remote"]');
const setupSavedStep = document.querySelector('[data-setup-step="saved"]');
const publishChecklist = document.getElementById('publishChecklist');
const refreshChecklistBtn = document.getElementById('refreshChecklistBtn');
const copyBackupBtn = document.getElementById('copyBackupBtn');
const checkWorkerBtn = document.getElementById('checkWorkerBtn');

initAdmin();

async function initAdmin() {
  try {
    currentConfig = await loadConfig();
    currentLinks = await loadLinksData(currentConfig.assets?.linksFile ?? 'links.json');
    fillForm(currentConfig);
    renderLinksEditor();
    updateJsonEditor();
    bindEvents();
    updateAuthUi();
    if (adminToken) {
      await loadRemoteConfig();
      await loadRemoteLinks();
      await loadTools();
    } else {
      renderToolsList();
      renderToolUsage();
      setStatus('配置已加载。未登录时保存为本地预览配置。', 'warn');
    }
    renderPublishChecklist();
  } catch (err) {
    setStatus(`后台初始化失败：${err.message}`, 'error');
  }
}

function bindEvents() {
  document.querySelectorAll('[data-admin-tab]').forEach(tab => {
    tab.addEventListener('click', () => switchAdminPage(tab.dataset.adminTab));
  });

  document.querySelectorAll('[data-setup-page]').forEach(button => {
    button.addEventListener('click', () => switchAdminPage(button.dataset.setupPage));
  });

  loginBtn.addEventListener('click', login);
  passwordInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') login();
  });

  logoutBtn.addEventListener('click', () => {
    adminToken = '';
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    updateAuthUi();
    setSaveProgress(false);
    setStatus('已退出登录。后续保存会写入本地预览配置。', 'warn');
  });

  form.addEventListener('input', event => {
    setSaveProgress(false);
    event.target?.removeAttribute?.('aria-invalid');
  });

  saveBtn.addEventListener('click', () => runButtonAction(saveBtn, '保存中...', async () => {
    try {
      syncConfigFromForm();
      await saveConfig();
      await saveLinks();
      updateJsonEditor();
      refreshPreview();
      setSaveProgress(true);
      setStatus(adminToken
        ? '页面配置和分类站点已保存到 Worker/KV。线上前台刷新后会读取新数据。'
        : '页面配置和分类站点已保存到当前浏览器。刷新前台即可看到本地预览效果。',
      adminToken ? 'ok' : 'warn');
    } catch (err) {
      setStatus(`保存失败：${err.message}`, 'error');
    }
  }));

  resetBtn.addEventListener('click', () => runButtonAction(resetBtn, '恢复中...', async () => {
    if (!confirmDanger('恢复默认配置？这会清除当前浏览器里的本地覆盖配置，并用默认分类和站点替换当前编辑内容。')) {
      return;
    }

    clearLocalConfig();
    clearLocalLinks();
    currentConfig = await loadDefaultConfig();
    currentLinks = await loadDefaultLinks(currentConfig.assets?.linksFile ?? 'links.json');
    fillForm(currentConfig);
    renderLinksEditor();
    updateJsonEditor();
    refreshPreview();
    setSaveProgress(false);
    setStatus('已恢复默认配置并清除本地覆盖。需要同步到线上时请再点击保存配置。', 'warn');
  }));

  copyJsonBtn.addEventListener('click', () => runButtonAction(copyJsonBtn, '复制中...', async () => {
    syncConfigFromForm();
    updateJsonEditor();
    await navigator.clipboard.writeText(jsonEditor.value);
    setStatus('当前配置 JSON 已复制。', 'ok');
  }));

  loadJsonBtn.addEventListener('click', () => {
    if (!confirmDanger('从 JSON 文本载入配置？当前基础配置表单会被 JSON 内容替换。')) {
      return;
    }

    try {
      currentConfig = JSON.parse(jsonEditor.value);
      fillForm(currentConfig);
      updateJsonEditor();
      setSaveProgress(false);
      setStatus('已从 JSON 文本载入，点击保存配置后生效。', 'ok');
    } catch (err) {
      setStatus(`JSON 解析失败：${err.message}`, 'error');
    }
  });

  document.getElementById('addSectionBtn').addEventListener('click', () => {
    syncActiveSectionFromEditor();
    currentLinks.push({ section: '新分类', items: [] });
    selectedSectionIndex = currentLinks.length - 1;
    renderLinksEditor();
    setSaveProgress(false);
    setStatus('已新增分类，记得保存配置。', 'warn');
    sectionNameInput.focus();
    sectionNameInput.select();
  });

  reloadLinksBtn.addEventListener('click', () => runButtonAction(reloadLinksBtn, '重载中...', async () => {
    if (!confirmDanger('重载默认链接？当前分类和站点编辑内容会被默认 links.json 替换。')) {
      return;
    }

    currentLinks = await loadDefaultLinks(currentConfig.assets?.linksFile ?? 'links.json');
    selectedSectionIndex = 0;
    renderLinksEditor();
    setSaveProgress(false);
    setStatus('已重载默认链接，保存后生效。', 'warn');
  }));

  document.getElementById('addSiteBtn').addEventListener('click', addSiteToSelectedSection);
  document.getElementById('deleteSectionBtn').addEventListener('click', deleteSelectedSection);
  sectionNameInput.addEventListener('input', updateSelectedSectionName);
  siteList.addEventListener('input', updateSelectedSiteField);
  siteList.addEventListener('click', handleSiteListClick);

  document.getElementById('addToolBtn').addEventListener('click', () => {
    selectTool({
      slug: '',
      title: '',
      description: '',
      html: createDefaultToolHtml()
    });
    setSaveProgress(false);
  });

  reloadToolsBtn.addEventListener('click', () => runButtonAction(reloadToolsBtn, '刷新中...', loadTools));
  saveToolBtn.addEventListener('click', () => runButtonAction(saveToolBtn, '保存中...', saveTool));
  deleteToolBtn.addEventListener('click', () => runButtonAction(deleteToolBtn, '删除中...', deleteTool));
  toolHtmlInput.addEventListener('input', renderToolDraftSize);
  refreshChecklistBtn?.addEventListener('click', () => {
    syncConfigFromForm();
    syncActiveSectionFromEditor();
    renderPublishChecklist();
    setStatus('发布检查已刷新。', 'ok');
  });
  copyBackupBtn?.addEventListener('click', () => runButtonAction(copyBackupBtn, '复制中...', async () => {
    syncConfigFromForm();
    syncActiveSectionFromEditor();
    updateJsonEditor();
    await navigator.clipboard.writeText(JSON.stringify(createPublishBackup(), null, 2));
    setStatus('完整备份已复制，包含页面配置、分类站点和小工具列表。', 'ok');
  }));
  checkWorkerBtn?.addEventListener('click', () => runButtonAction(checkWorkerBtn, '检测中...', checkWorkerStatus));
}

function switchAdminPage(page) {
  document.querySelectorAll('[data-admin-tab]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.adminTab === page);
    tab.setAttribute('aria-selected', String(tab.dataset.adminTab === page));
  });
  document.querySelectorAll('[data-admin-page]').forEach(panel => {
    const isActive = panel.dataset.adminPage === page;
    panel.classList.toggle('active', isActive);
    panel.hidden = !isActive;
  });

  if (page === 'preview') {
    refreshPreview();
  }

  if (page === 'publish') {
    syncConfigFromForm();
    syncActiveSectionFromEditor();
    renderPublishChecklist();
  }
}

async function runButtonAction(button, busyText, action) {
  if (!button || button.disabled) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.dataset.busy = 'true';
  button.textContent = busyText;

  try {
    return await action();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
    delete button.dataset.busy;
  }
}

function confirmDanger(message) {
  return window.confirm(message);
}

async function login() {
  const password = passwordInput.value.trim();
  if (!password) {
    setStatus('请输入管理员密码。', 'warn');
    passwordInput.focus();
    return;
  }

  loginBtn.disabled = true;
  setStatus('正在登录后台...', 'warn');

  try {
    const res = await fetch(apiUrl(LOGIN_API), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await readJsonResponse(res);

    if (!res.ok) {
      throw new Error(data.error || `登录失败：${res.status}`);
    }

    adminToken = data.token;
    sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
    passwordInput.value = '';
    updateAuthUi();
    setSaveProgress(false);
    await loadRemoteConfig();
    await loadRemoteLinks();
    await loadTools();
    setStatus('已登录后台。保存配置会写入 Worker/KV。', 'ok');
  } catch (err) {
    setStatus(`登录失败：${err.message}`, 'error');
  } finally {
    loginBtn.disabled = false;
  }
}

async function loadRemoteConfig() {
  if (!adminToken) return;

  const res = await fetch(apiUrl(ADMIN_CONFIG_API), {
    cache: 'no-cache',
    headers: getAuthHeaders()
  });
  const data = await readJsonResponse(res);

  if (!res.ok) {
    adminToken = '';
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    updateAuthUi();
    setStatus(data.error || `后台配置读取失败：${res.status}`, 'error');
    return;
  }

  if (Object.keys(data).length) {
    currentConfig = mergeConfig(currentConfig, data);
    fillForm(currentConfig);
    updateJsonEditor();
  }
}

async function loadRemoteLinks() {
  if (!adminToken) return;

  const res = await fetch(apiUrl(ADMIN_LINKS_API), {
    cache: 'no-cache',
    headers: getAuthHeaders()
  });
  const data = await readJsonResponse(res);

  if (!res.ok) {
    setStatus(data.error || `链接数据读取失败：${res.status}`, 'error');
    return;
  }

  if (Array.isArray(data) && data.length) {
    currentLinks = sanitizeLinks(data);
    renderLinksEditor();
  }
}

async function saveConfig() {
  if (!adminToken) {
    saveLocalConfig(currentConfig);
    return;
  }

  const res = await fetch(apiUrl(ADMIN_CONFIG_API), {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(currentConfig)
  });
  const data = await readJsonResponse(res);

  if (!res.ok) {
    if (res.status === 401) {
      adminToken = '';
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      updateAuthUi();
    }
    throw new Error(data.error || `保存失败：${res.status}`);
  }

  clearLocalConfig();
}

async function saveLinks() {
  currentLinks = sanitizeLinks(readLinksFromEditor());

  if (!adminToken) {
    saveLocalLinks(currentLinks);
    return;
  }

  const res = await fetch(apiUrl(ADMIN_LINKS_API), {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(currentLinks)
  });
  const data = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(data.error || `链接保存失败：${res.status}`);
  }

  clearLocalLinks();
}

function renderLinksEditor() {
  normalizeSelectedSectionIndex();
  renderLinksSummary();
  renderSectionList();
  renderSectionDetail();
  requestPublishChecklistUpdate();
}

function readLinksFromEditor() {
  syncActiveSectionFromEditor();
  return currentLinks.map(section => ({
    section: section.section,
    items: section.items.map(item => {
      const next = { ...item };
      if (!next.icon) delete next.icon;
      if (!next.intranet) delete next.intranet;
      return next;
    })
  }));
}

function normalizeSelectedSectionIndex() {
  if (!Array.isArray(currentLinks)) {
    currentLinks = [];
  }

  if (!currentLinks.length) {
    selectedSectionIndex = -1;
    return;
  }

  selectedSectionIndex = Math.min(
    Math.max(Number(selectedSectionIndex) || 0, 0),
    currentLinks.length - 1
  );
}

function renderLinksSummary() {
  const sectionCount = currentLinks.length;
  const siteCount = currentLinks.reduce((sum, section) => sum + (section.items?.length || 0), 0);
  linksSummary.textContent = `共 ${sectionCount} 个分类，${siteCount} 个站点。左侧选择分类，右侧编辑当前分类内容。`;
}

function renderSectionList() {
  sectionList.innerHTML = '';

  if (!currentLinks.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-editor-state';
    empty.textContent = '暂无分类，点击“新增分类”开始添加。';
    sectionList.appendChild(empty);
    return;
  }

  currentLinks.forEach((section, sectionIndex) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `section-list-item${sectionIndex === selectedSectionIndex ? ' active' : ''}`;
    item.dataset.sectionIndex = String(sectionIndex);
    item.innerHTML = `
      <span class="section-list-name">${escapeHtml(section.section || '未命名分类')}</span>
      <span class="section-list-count">${section.items?.length || 0}</span>
    `;
    item.addEventListener('click', () => {
      syncActiveSectionFromEditor();
      selectedSectionIndex = sectionIndex;
      renderLinksEditor();
    });
    sectionList.appendChild(item);
  });
}

function renderSectionDetail() {
  const addSiteBtn = document.getElementById('addSiteBtn');
  const deleteSectionBtn = document.getElementById('deleteSectionBtn');
  const section = currentLinks[selectedSectionIndex];

  siteList.innerHTML = '';

  if (!section) {
    sectionNameInput.value = '';
    sectionNameInput.disabled = true;
    addSiteBtn.disabled = true;
    deleteSectionBtn.disabled = true;

    const empty = document.createElement('p');
    empty.className = 'empty-editor-state';
    empty.textContent = '请选择或新增一个分类。';
    siteList.appendChild(empty);
    return;
  }

  sectionNameInput.disabled = false;
  addSiteBtn.disabled = false;
  deleteSectionBtn.disabled = false;
  sectionNameInput.value = section.section || '';

  if (!section.items?.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-editor-state';
    empty.textContent = '当前分类还没有站点，点击“新增站点”添加。';
    siteList.appendChild(empty);
    return;
  }

  section.items.forEach((item, itemIndex) => {
    const card = document.createElement('article');
    card.className = 'site-card';
    card.dataset.itemIndex = String(itemIndex);
    card.innerHTML = `
      <div class="site-card-head">
        <strong>站点 ${itemIndex + 1}</strong>
        <div class="site-card-actions">
          <button class="ghost-btn" data-action="match-site" type="button" title="根据外网地址读取标题、描述和图标">自动匹配</button>
          <button class="ghost-btn danger-btn" data-action="remove-site" type="button">删除</button>
        </div>
      </div>
      <div class="site-card-grid">
        <label>
          <span>标题</span>
          <input data-field="title" type="text" value="${escapeAttr(item.title)}" placeholder="例如 GitHub">
        </label>
        <label>
          <span>外网地址</span>
          <input data-field="url" type="url" value="${escapeAttr(item.url)}" placeholder="https://example.com/">
        </label>
        <label>
          <span>图标 URL</span>
          <input data-field="icon" type="url" value="${escapeAttr(item.icon ?? '')}" placeholder="可选，不填则自动获取">
        </label>
        <label>
          <span>描述</span>
          <input data-field="desc" type="text" value="${escapeAttr(item.desc ?? '')}" placeholder="显示在前台卡片下方">
        </label>
        <label>
          <span>搜索关键词</span>
          <input data-field="data-desc" type="text" value="${escapeAttr(item['data-desc'] ?? '')}" placeholder="用于前台搜索匹配">
        </label>
        <label class="site-field-wide">
          <span>内网地址</span>
          <input data-field="intranet" type="url" value="${escapeAttr(item.intranet ?? '')}" placeholder="可选，内外网切换时使用">
        </label>
      </div>
    `;
    siteList.appendChild(card);
  });
}

function addSiteToSelectedSection() {
  syncActiveSectionFromEditor();

  if (!currentLinks.length) {
    currentLinks.push({ section: '新分类', items: [] });
    selectedSectionIndex = 0;
  }

  const section = currentLinks[selectedSectionIndex];
  section.items ??= [];
  section.items.push({
    title: '新站点',
    url: 'https://example.com/',
    icon: '',
    desc: '',
    'data-desc': '',
    intranet: ''
  });

  renderLinksEditor();

  const newIndex = section.items.length - 1;
  const titleInput = siteList.querySelector(`.site-card[data-item-index="${newIndex}"] [data-field="title"]`);
  titleInput?.focus();
  titleInput?.select();
  setSaveProgress(false);
  setStatus('已新增站点，记得保存配置。', 'warn');
}

function deleteSelectedSection() {
  if (!currentLinks.length || selectedSectionIndex < 0) return;

  syncActiveSectionFromEditor();
  const removedName = currentLinks[selectedSectionIndex]?.section || '未命名分类';
  const removedCount = currentLinks[selectedSectionIndex]?.items?.length || 0;
  if (!confirmDanger(`删除分类「${removedName}」？其中 ${removedCount} 个站点会从导航移除。`)) {
    return;
  }

  currentLinks.splice(selectedSectionIndex, 1);
  selectedSectionIndex = Math.min(selectedSectionIndex, currentLinks.length - 1);
  renderLinksEditor();
  setSaveProgress(false);
  setStatus(`已删除分类：${removedName}。记得保存配置。`, 'warn');
}

function updateSelectedSectionName() {
  const section = currentLinks[selectedSectionIndex];
  if (!section) return;
  section.section = sectionNameInput.value.trim();
  renderLinksSummary();
  renderSectionList();
}

function updateSelectedSiteField(event) {
  const input = event.target.closest('[data-field]');
  if (!input) return;

  const card = input.closest('.site-card');
  const section = currentLinks[selectedSectionIndex];
  const itemIndex = Number(card?.dataset.itemIndex);
  if (!section || !Number.isInteger(itemIndex) || !section.items[itemIndex]) return;

  section.items[itemIndex][input.dataset.field] = input.value.trim();
}

function handleSiteListClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  syncActiveSectionFromEditor();
  const card = button.closest('.site-card');
  const section = currentLinks[selectedSectionIndex];
  const itemIndex = Number(card?.dataset.itemIndex);
  if (!section || !Number.isInteger(itemIndex)) return;

  if (button.dataset.action === 'match-site') {
    runButtonAction(button, '匹配中...', () => matchSiteMeta(card, section, itemIndex));
    return;
  }

  if (button.dataset.action !== 'remove-site') return;

  const removedTitle = section.items[itemIndex]?.title || `站点 ${itemIndex + 1}`;
  if (!confirmDanger(`删除站点「${removedTitle}」？保存配置后前台导航会移除这个站点。`)) {
    return;
  }

  section.items.splice(itemIndex, 1);
  renderLinksEditor();
  setSaveProgress(false);
  setStatus(`已删除站点：${removedTitle}。记得保存配置。`, 'warn');
}

async function matchSiteMeta(card, section, itemIndex) {
  if (!adminToken) {
    setStatus('请先登录后台。自动匹配需要 Worker 代为读取目标站点。', 'warn');
    return;
  }

  const urlInput = card.querySelector('[data-field="url"]');
  const url = urlInput?.value.trim();
  if (!url) {
    urlInput?.focus();
    setStatus('请先填写站点外网地址。', 'warn');
    return;
  }

  let res;
  let data;
  try {
    res = await fetch(apiUrl(`${SITE_META_API}?url=${encodeURIComponent(url)}`), {
      cache: 'no-cache',
      headers: getAuthHeaders()
    });
    data = await readJsonResponse(res);
  } catch (err) {
    setStatus(`自动匹配失败：${err?.message || '网络请求失败'}`, 'error');
    return;
  }

  if (!res.ok) {
    setStatus(data.error || `自动匹配失败：${res.status}`, 'error');
    return;
  }

  const item = section.items[itemIndex];
  const iconCandidates = Array.isArray(data.iconCandidates) ? data.iconCandidates.filter(Boolean) : [];
  const fields = {
    title: data.title || item.title,
    icon: data.icon || iconCandidates[0] || data.fallbackIcon || item.icon || '',
    desc: data.description || item.desc || '',
    'data-desc': data.keywords || data.description || item['data-desc'] || ''
  };

  Object.entries(fields).forEach(([field, value]) => {
    const input = card.querySelector(`[data-field="${field}"]`);
    if (input && value) {
      input.value = value;
      item[field] = value;
    }
  });

  setSaveProgress(false);
  const aiText = data.aiUsed ? 'AI 已补全简介和图标候选' : '已使用网页元信息和图标候选';
  setStatus(`已匹配站点信息：${fields.title || url}，${aiText}。记得保存配置。`, 'ok');
}

function syncActiveSectionFromEditor() {
  const section = currentLinks[selectedSectionIndex];
  if (!section || sectionNameInput.disabled) return;

  section.section = sectionNameInput.value.trim();
  section.items = Array.from(siteList.querySelectorAll('.site-card')).map(card => {
    const item = {};
    card.querySelectorAll('[data-field]').forEach(input => {
      item[input.dataset.field] = input.value.trim();
    });
    return item;
  });
}

async function loadTools() {
  if (!adminToken) {
    tools = [];
    toolUsage = createEmptyToolUsage();
    renderToolsList();
    renderToolUsage();
    return;
  }

  const res = await fetch(apiUrl(ADMIN_TOOLS_API), {
    cache: 'no-cache',
    headers: getAuthHeaders()
  });
  const data = await readJsonResponse(res);

  if (!res.ok) {
    setStatus(data.error || `小工具列表读取失败：${res.status}`, 'error');
    return;
  }

  tools = Array.isArray(data.tools) ? data.tools : [];
  toolUsage = normalizeToolUsage(data.usage, tools);
  renderToolsList();
  renderToolUsage();
  requestPublishChecklistUpdate();
}

function renderToolsList() {
  toolsList.innerHTML = '';

  if (!tools.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-editor-state';
    empty.textContent = adminToken ? '暂无小工具。' : '登录 Worker 后可管理小工具。';
    toolsList.appendChild(empty);
    return;
  }

  tools.forEach(tool => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `tool-list-item${tool.slug === selectedToolSlug ? ' active' : ''}`;
    item.innerHTML = `
      <span class="tool-meta">
        <strong>${escapeHtml(tool.title || tool.slug)}</strong>
        <span>/tools/${escapeHtml(tool.slug)}/</span>
      </span>
      <span>编辑</span>
    `;
    item.addEventListener('click', () => selectTool(tool));
    toolsList.appendChild(item);
  });
}

async function selectTool(tool) {
  selectedToolSlug = tool.slug || '';
  document.getElementById('toolSlug').value = tool.slug || '';
  document.getElementById('toolTitle').value = tool.title || '';
  document.getElementById('toolDescription').value = tool.description || '';
  document.getElementById('toolHtml').value = tool.html || createDefaultToolHtml();
  document.getElementById('toolAddToNav').checked = true;
  updateToolLink();
  renderToolDraftSize();
  renderToolsList();
}

async function saveTool() {
  if (!adminToken) {
    setStatus('请先登录后台。小工具需要保存到 Worker/KV。', 'warn');
    return;
  }

  clearToolValidation();
  const tool = readToolForm();
  const invalidField = validateToolForm(tool);
  if (invalidField) {
    invalidField.focus();
    setStatus('工具 Slug、名称和 HTML 内容都要填写。Slug 例如 bmi-calculator。', 'warn');
    return;
  }

  const res = await fetch(apiUrl(ADMIN_TOOLS_API), {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...tool,
      addToNav: document.getElementById('toolAddToNav').checked
    })
  });
  const data = await readJsonResponse(res);

  if (!res.ok) {
    setStatus(data.error || `小工具保存失败：${res.status}`, 'error');
    return;
  }

  if (Array.isArray(data.links)) {
    currentLinks = sanitizeLinks(data.links);
    renderLinksEditor();
  }

  selectedToolSlug = data.tool?.slug || tool.slug;
  if (data.usage) {
    toolUsage = normalizeToolUsage(data.usage, tools);
    renderToolUsage();
  }
  await loadTools();
  updateToolLink();
  setSaveProgress(true);
  setStatus(`小工具已保存：/tools/${selectedToolSlug}/`, 'ok');
}

async function deleteTool() {
  if (!adminToken) {
    setStatus('请先登录后台。', 'warn');
    return;
  }

  const slug = document.getElementById('toolSlug').value.trim();
  if (!slug) {
    setStatus('请输入要删除的小工具 Slug。', 'warn');
    return;
  }

  if (!confirmDanger(`删除小工具「${slug}」？这个操作会移除 /tools/${slug}/ 的 Worker 页面。`)) {
    return;
  }

  const res = await fetch(apiUrl(`${ADMIN_TOOLS_API}/${encodeURIComponent(slug)}`), {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  const data = await readJsonResponse(res);

  if (!res.ok) {
    setStatus(data.error || `小工具删除失败：${res.status}`, 'error');
    return;
  }

  selectedToolSlug = '';
  selectTool({ slug: '', title: '', description: '', html: createDefaultToolHtml() });
  await loadTools();
  setSaveProgress(true);
  setStatus(`已删除小工具：${slug}`, 'ok');
}

function readToolForm() {
  return {
    slug: normalizeSlug(toolSlugInput.value),
    title: toolTitleInput.value.trim(),
    description: document.getElementById('toolDescription').value.trim(),
    html: toolHtmlInput.value
  };
}

function validateToolForm(tool) {
  if (!tool.slug) return markInvalid(toolSlugInput);
  if (!tool.title) return markInvalid(toolTitleInput);
  if (!tool.html.trim()) return markInvalid(toolHtmlInput);
  return null;
}

function markInvalid(input) {
  input?.setAttribute('aria-invalid', 'true');
  return input;
}

function clearToolValidation() {
  [toolSlugInput, toolTitleInput, toolHtmlInput].forEach(input => {
    input?.removeAttribute('aria-invalid');
  });
}

function renderToolUsage() {
  const usage = normalizeToolUsage(toolUsage, tools);
  const countPercent = clampPercent(usage.countPercent);
  const bytesPercent = clampPercent(usage.bytesPercent);

  if (toolUsageSummary) {
    toolUsageSummary.textContent = adminToken
      ? `${usage.toolCount} 个小工具，已用 ${formatBytes(usage.totalBytes)} / ${formatBytes(usage.maxTotalBytes)}`
      : '登录后读取 Worker 小工具配额。';
  }
  if (toolLargestValue) {
    const largest = usage.largestTool;
    toolLargestValue.textContent = largest?.bytes
      ? `最大：${largest.title || largest.slug} ${formatBytes(largest.bytes)}`
      : '最大工具 --';
  }
  if (toolCountValue) toolCountValue.textContent = `${usage.toolCount} / ${usage.maxTools}`;
  if (toolCountBar) toolCountBar.style.width = `${countPercent}%`;
  if (toolCountPercent) toolCountPercent.textContent = `${countPercent}%`;
  if (toolBytesValue) toolBytesValue.textContent = `${formatBytes(usage.totalBytes)} / ${formatBytes(usage.maxTotalBytes)}`;
  if (toolBytesBar) toolBytesBar.style.width = `${bytesPercent}%`;
  if (toolBytesPercent) toolBytesPercent.textContent = `${bytesPercent}%`;

  renderToolDraftSize();
}

function renderToolDraftSize() {
  const hint = document.getElementById('toolHtmlHint');
  if (!hint || !toolHtmlInput) return;
  const size = byteLength(toolHtmlInput.value);
  const max = Number(toolUsage?.maxToolHtmlLength) || 250000;
  hint.textContent = `工具页会被 sandbox 隔离；当前 HTML ${formatBytes(size)} / ${formatBytes(max)}。`;
}

function normalizeToolUsage(usage, sourceTools = []) {
  const maxTools = Number(usage?.maxTools) || 50;
  const maxTotalBytes = Number(usage?.maxTotalBytes) || 5 * 1024 * 1024;
  const maxToolHtmlLength = Number(usage?.maxToolHtmlLength) || 250000;
  const toolCount = Number(usage?.toolCount);
  const totalBytes = Number(usage?.totalBytes);

  return {
    toolCount: Number.isFinite(toolCount) ? toolCount : sourceTools.length,
    maxTools,
    totalBytes: Number.isFinite(totalBytes) ? totalBytes : estimateToolsBytes(sourceTools),
    maxTotalBytes,
    maxToolHtmlLength,
    countPercent: Number.isFinite(Number(usage?.countPercent))
      ? Number(usage.countPercent)
      : percent(sourceTools.length, maxTools),
    bytesPercent: Number.isFinite(Number(usage?.bytesPercent))
      ? Number(usage.bytesPercent)
      : percent(estimateToolsBytes(sourceTools), maxTotalBytes),
    largestTool: usage?.largestTool || getLargestLocalTool(sourceTools)
  };
}

function createEmptyToolUsage() {
  return normalizeToolUsage(null, []);
}

function estimateToolsBytes(sourceTools) {
  return Array.isArray(sourceTools)
    ? sourceTools.reduce((sum, tool) => sum + byteLength(JSON.stringify(tool)), 0)
    : 0;
}

function getLargestLocalTool(sourceTools) {
  if (!Array.isArray(sourceTools)) return { slug: '', title: '', bytes: 0 };
  return sourceTools.reduce((largest, tool) => {
    const bytes = byteLength(JSON.stringify(tool));
    return bytes > largest.bytes
      ? { slug: tool.slug || '', title: tool.title || tool.slug || '', bytes }
      : largest;
  }, { slug: '', title: '', bytes: 0 });
}

function byteLength(value) {
  return new TextEncoder().encode(String(value || '')).length;
}

function percent(value, max) {
  if (!max) return 0;
  return Math.min(Math.round((Number(value) / Number(max)) * 100), 100);
}

function clampPercent(value) {
  return Math.max(0, Math.min(Number(value) || 0, 100));
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value} B`;
}

function updateToolLink() {
  const slug = normalizeSlug(document.getElementById('toolSlug').value);
  const link = document.getElementById('openToolLink');
  link.href = slug ? workerPathUrl(`/tools/${slug}/`) : '#';
}

function fillForm(config) {
  form.querySelectorAll('[name]').forEach(input => {
    const value = getByPath(config, input.name);
    if (input.type === 'checkbox') {
      input.checked = Boolean(value);
      return;
    }
    if (Array.isArray(value)) {
      input.value = value.join('，');
      return;
    }
    input.value = value ?? '';
  });
}

function syncConfigFromForm() {
  form.querySelectorAll('[name]').forEach(input => {
    const value = readInputValue(input);
    setByPath(currentConfig, input.name, value);
  });
}

function readInputValue(input) {
  if (input.type === 'checkbox') {
    return input.checked;
  }

  if (input.type === 'number') {
    if (input.name === 'analytics.popularLimit') {
      return Math.min(Math.max(Number(input.value) || 16, 1), 16);
    }

    if (input.name === 'aiSiteMeta.temperature') {
      return Math.min(Math.max(Number(input.value) || 0, 0), 1);
    }

    return Number(input.value);
  }

  return input.value.trim();
}

function updateJsonEditor() {
  jsonEditor.value = JSON.stringify(currentConfig, null, 2);
}

function updateAuthUi() {
  loginPanel.hidden = Boolean(adminToken);
  logoutBtn.hidden = !adminToken;
  [reloadToolsBtn, saveToolBtn, deleteToolBtn].forEach(button => {
    if (button) button.disabled = !adminToken;
  });
  updateSetupMode();
  requestPublishChecklistUpdate();
}

function updateSetupMode() {
  if (!setupModeTitle || !setupModeText || !setupRemoteStep) return;

  if (adminToken) {
    setupModeTitle.textContent = '线上保存';
    setupModeText.textContent = '保存写入 Worker/KV，前台刷新后读取线上配置。';
    setupRemoteStep.textContent = 'Worker 已登录';
    setupRemoteStep.classList.add('active');
    setupRemoteStep.classList.remove('warn');
    return;
  }

  setupModeTitle.textContent = '本地预览';
  setupModeText.textContent = '保存写入当前浏览器，适合部署前调试。';
  setupRemoteStep.textContent = 'Worker 未登录';
  setupRemoteStep.classList.remove('active');
  setupRemoteStep.classList.add('warn');
}

function setSaveProgress(saved) {
  saveProgressSaved = Boolean(saved);
  if (!setupSavedStep) return;
  setupSavedStep.textContent = saved ? '已保存' : '等待保存';
  setupSavedStep.classList.toggle('active', saved);
  setupSavedStep.classList.toggle('warn', !saved);
  requestPublishChecklistUpdate();
}

function requestPublishChecklistUpdate() {
  const publishPage = document.querySelector('[data-admin-page="publish"]');
  if (publishPage?.classList.contains('active')) {
    renderPublishChecklist();
  }
}

async function checkWorkerStatus() {
  workerStatus = null;
  workerStatusError = '';

  try {
    const res = await fetch(apiUrl(STATUS_API), { cache: 'no-cache' });
    const data = await readJsonResponse(res);

    if (!res.ok) {
      throw new Error(data.error || `状态接口返回 ${res.status}`);
    }

    workerStatus = data;
    renderPublishChecklist();
    setStatus(data.ok ? 'Worker 状态正常。' : 'Worker 状态已读取，但仍有发布项需要处理。', data.ok ? 'ok' : 'warn');
  } catch (err) {
    workerStatusError = err.message || '状态接口不可用';
    renderPublishChecklist();
    setStatus(`Worker 状态检测失败：${workerStatusError}`, 'error');
  }
}

function renderPublishChecklist() {
  if (!publishChecklist || !currentConfig) return;

  const stats = getLinkStats();
  const backgroundCheck = getBackgroundCheck();
  const faviconCheck = getFaviconCheck();
  const workerCheck = getWorkerStatusCheck();
  const analyticsCheck = getAnalyticsCheck();
  const mobileLive2dEnabled = Boolean(currentConfig.live2d?.mobileEnabled);
  const toolCount = Array.isArray(tools) ? tools.length : 0;
  const currentToolUsage = normalizeToolUsage(toolUsage, tools);
  const items = [
    {
      state: adminToken ? 'ok' : 'warn',
      title: '保存位置',
      value: adminToken ? 'Worker/KV 线上保存' : '本地浏览器预览',
      detail: adminToken ? '点击保存后前台刷新会读取线上配置。' : '未登录时不会写入线上 Worker，部署前需要登录保存一次。'
    },
    workerCheck,
    {
      state: saveProgressSaved ? 'ok' : 'warn',
      title: '保存状态',
      value: saveProgressSaved ? '当前编辑已保存' : '等待保存',
      detail: saveProgressSaved ? '上次保存流程已完成。' : '修改配置、分类或站点后，需要点击右上角“保存配置”。'
    },
    {
      state: stats.siteCount > 0 && stats.invalidSiteCount === 0 ? (stats.emptySectionCount ? 'warn' : 'ok') : 'error',
      title: '分类和站点',
      value: `${stats.sectionCount} 个分类 / ${stats.siteCount} 个站点`,
      detail: getLinksCheckDetail(stats)
    },
    {
      state: faviconCheck.state,
      title: '站点图标',
      value: faviconCheck.value,
      detail: faviconCheck.detail
    },
    {
      state: backgroundCheck.state,
      title: '背景和一言',
      value: backgroundCheck.value,
      detail: backgroundCheck.detail
    },
    {
      state: analyticsCheck.state,
      title: '统计和常用',
      value: analyticsCheck.value,
      detail: analyticsCheck.detail
    },
    {
      state: mobileLive2dEnabled ? 'warn' : 'ok',
      title: '手机端策略',
      value: mobileLive2dEnabled ? '看板娘允许手机显示' : '手机端隐藏看板娘',
      detail: mobileLive2dEnabled ? '建议保持关闭，手机端优先保证滚动、点击和搜索性能。' : '符合当前要求，页面特效也会在手机或低动效模式下降级。'
    },
    {
      state: adminToken ? (toolCount ? 'ok' : 'warn') : 'warn',
      title: '小工具',
      value: adminToken
        ? `${toolCount} / ${currentToolUsage.maxTools} 个，${formatBytes(currentToolUsage.totalBytes)} / ${formatBytes(currentToolUsage.maxTotalBytes)}`
        : '登录后读取小工具',
      detail: adminToken ? '小工具保存后可自动加入导航“小工具”分类，超过配额会被 Worker 拒绝。' : '小工具必须写入 Worker/KV，本地预览模式不能发布工具页面。'
    },
    {
      state: 'ok',
      title: '备份',
      value: '完整备份可复制',
      detail: '备份包含页面配置、分类站点和小工具列表，适合发布前留存。'
    },
    {
      state: 'ok',
      title: '接口文档',
      value: '流程和 AI 接口已提供',
      detail: 'AI 创建小工具时可直接参考 docs/ai-tool-api.md。'
    }
  ];

  publishChecklist.innerHTML = items.map(renderChecklistItem).join('');
}

function getWorkerStatusCheck() {
  if (workerStatusError) {
    return {
      state: 'error',
      title: 'Worker 状态',
      value: '检测失败',
      detail: workerStatusError
    };
  }

  if (!workerStatus) {
    return {
      state: 'warn',
      title: 'Worker 状态',
      value: '未检测',
      detail: `点击“检测 Worker”读取 ${getApiBase() ? 'Worker 域名' : '当前域名'} 的 /api/status，确认环境变量、KV 和线上数据。`
    };
  }

  const checks = workerStatus.checks ?? {};
  const list = [
    checks.adminPassword,
    checks.kvBinding,
    checks.config,
    checks.links,
    checks.tools
  ].filter(Boolean);
  const passed = list.filter(item => item.ok).length;
  const total = list.length || 5;
  const links = checks.links;
  const tools = checks.tools;
  const countText = links
    ? `${links.sections || 0} 个分类 / ${links.sites || 0} 个站点 / ${tools?.count || 0} 个小工具`
    : `${passed}/${total} 项通过`;

  return {
    state: workerStatus.ok ? 'ok' : 'warn',
    title: 'Worker 状态',
    value: workerStatus.ok ? '部署状态正常' : `${passed}/${total} 项通过`,
    detail: `${countText}。${getWorkerIssueText(checks)}`
  };
}

function getWorkerIssueText(checks) {
  const messages = [
    checks.adminPassword,
    checks.kvBinding,
    checks.config,
    checks.links,
    checks.tools
  ]
    .filter(item => item && !item.ok)
    .map(item => item.message);

  if (!messages.length) return '状态接口未发现阻塞项。';
  return messages.join('；');
}

function getLinkStats() {
  const sections = Array.isArray(currentLinks) ? currentLinks : [];
  let siteCount = 0;
  let invalidSiteCount = 0;
  let emptySectionCount = 0;

  sections.forEach(section => {
    const items = Array.isArray(section.items) ? section.items : [];
    if (!items.length) emptySectionCount += 1;
    siteCount += items.length;
    items.forEach(item => {
      if (!String(item.title || '').trim() || !String(item.url || '').trim()) {
        invalidSiteCount += 1;
      }
    });
  });

  return {
    sectionCount: sections.length,
    siteCount,
    invalidSiteCount,
    emptySectionCount
  };
}

function getLinksCheckDetail(stats) {
  if (!stats.sectionCount) return '当前没有分类，前台导航会缺少主要内容。';
  if (!stats.siteCount) return '当前没有站点，至少需要添加一个可访问站点。';
  if (stats.invalidSiteCount) return `${stats.invalidSiteCount} 个站点缺少标题或外网地址。`;
  if (stats.emptySectionCount) return `${stats.emptySectionCount} 个分类为空，可以删除或补充站点。`;
  return '分类和站点数据完整，前台可以正常渲染。';
}

function getBackgroundCheck() {
  const background = currentConfig.background ?? {};
  const quote = currentConfig.quote ?? {};
  const mode = background.mode || 'image-api';
  const missing = [];

  if (mode === 'image-api' && !background.desktopImageApi) missing.push('桌面图片接口');
  if (mode === 'fixed-image' && !background.fixedImage) missing.push('固定图片');
  if (mode === 'video-api' && !background.videoApi) missing.push('视频接口');
  if (mode === 'fixed-video' && !background.fixedVideo) missing.push('固定视频');
  if (quote.enabled && !quote.endpoint) missing.push('一言接口');

  return {
    state: missing.length ? 'warn' : 'ok',
    value: `${getBackgroundModeLabel(mode)} / ${quote.enabled ? '一言开启' : '一言关闭'}`,
    detail: missing.length ? `缺少：${missing.join('、')}。` : '背景来源和一言配置已有可用值。'
  };
}

function getFaviconCheck() {
  const favicon = currentConfig.favicon ?? {};
  const provider = ['duckduckgo', 'google'].includes(favicon.provider) ? favicon.provider : 'duckduckgo';
  const providerLabel = provider === 'google' ? 'Google' : 'DuckDuckGo';
  const proxy = String(favicon.proxy || '').trim();

  return {
    state: 'ok',
    value: `${providerLabel}${proxy ? ' / Worker 代理' : ' / 直连'}`,
    detail: proxy
      ? '图标会通过代理地址加载，适合国内访问不稳定的场景。'
      : '图标会直接从源站加载；如果大量图标失败，可以填写 Worker 代理地址。'
  };
}

function getAnalyticsCheck() {
  const analytics = currentConfig.analytics ?? {};
  const enabled = analytics.enabled !== false;
  const statsVisible = analytics.visitStatsEnabled !== false;
  const limit = Math.min(Math.max(Number(analytics.popularLimit) || 16, 1), 16);

  if (!enabled) {
    return {
      state: 'warn',
      value: '统计已关闭',
      detail: '关闭后访问统计和动态常用都不会更新。'
    };
  }

  return {
    state: 'ok',
    value: `常用最多 ${limit} 个 / ${statsVisible ? '显示访问统计' : '隐藏访问统计'}`,
    detail: '常用由点击次数自动生成，不再由分类站点手动维护。'
  };
}

function getBackgroundModeLabel(mode) {
  const labels = {
    'image-api': '图片接口',
    'fixed-image': '固定图片',
    'video-api': '视频接口',
    'fixed-video': '固定视频'
  };
  return labels[mode] || mode || '未设置';
}

function renderChecklistItem(item) {
  return `
    <article class="publish-check-card" data-state="${escapeAttr(item.state)}">
      <div class="publish-check-head">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="publish-check-badge">${getStateLabel(item.state)}</span>
      </div>
      <p class="publish-check-value">${escapeHtml(item.value)}</p>
      <p class="publish-check-detail">${escapeHtml(item.detail)}</p>
    </article>
  `;
}

function getStateLabel(state) {
  if (state === 'ok') return '正常';
  if (state === 'error') return '需处理';
  return '注意';
}

function createPublishBackup() {
  return {
    exportedAt: new Date().toISOString(),
    mode: adminToken ? 'worker' : 'local-preview',
    config: currentConfig,
    links: readLinksFromEditor(),
    workerStatus,
    tools: tools.map(tool => ({
      slug: tool.slug,
      title: tool.title,
      description: tool.description,
      url: workerPathUrl(tool.url || `/tools/${tool.slug}/`),
      updatedAt: tool.updatedAt
    }))
  };
}

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${adminToken}`
  };
}

async function readJsonResponse(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function mergeConfig(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override ?? base;
  }

  const merged = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    merged[key] = isPlainObject(value)
      ? mergeConfig(base[key] ?? {}, value)
      : value;
  });
  return merged;
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function setByPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((acc, key) => {
    acc[key] ??= {};
    return acc[key];
  }, obj);
  target[last] = value;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function setStatus(message, type = '') {
  statusBar.textContent = message;
  statusBar.className = `status-bar ${type}`.trim();
  statusBar.dataset.type = type || 'info';
}

function refreshPreview() {
  if (!previewFrame) return;
  previewFrame.src = `index.html?adminPreview=${Date.now()}`;
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createDefaultToolHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>小工具</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #101820; color: #fff; }
    main { width: min(720px, calc(100% - 32px)); }
    input, button { font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid #335; }
    button { cursor: pointer; background: #2f855a; color: #fff; }
  </style>
</head>
<body>
  <main>
    <h1>小工具</h1>
    <p>在这里实现工具功能。</p>
  </main>
</body>
</html>`;
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
