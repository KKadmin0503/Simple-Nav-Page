const ANNOUNCEMENT_KEY = 'simple-nav-page-announcement';

export function initAnnouncement(config) {
  const announcement = config.announcement ?? {};
  if (!announcement.enabled) return;

  const title = String(announcement.title || '站点公告').trim();
  const content = String(announcement.content || '').trim();
  if (!title && !content) return;

  const version = createAnnouncementVersion(title, content);
  if (!announcement.showEveryVisit && safeStorageGet(ANNOUNCEMENT_KEY) === version) {
    return;
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'announcement-dialog';
  dialog.setAttribute('aria-labelledby', 'announcementTitle');
  dialog.innerHTML = `
    <form method="dialog" class="announcement-panel">
      <div class="announcement-head">
        <span class="announcement-mark" aria-hidden="true">i</span>
        <h2 id="announcementTitle">${escapeHtml(title)}</h2>
      </div>
      <div class="announcement-content">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
      <div class="announcement-actions">
        <button class="announcement-confirm" value="confirm" type="submit">${escapeHtml(announcement.buttonText || '我知道了')}</button>
      </div>
    </form>
  `;

  dialog.addEventListener('close', () => {
    if (!announcement.showEveryVisit) {
      safeStorageSet(ANNOUNCEMENT_KEY, version);
    }
    dialog.remove();
  }, { once: true });

  document.body.appendChild(dialog);
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function createAnnouncementVersion(title, content) {
  return encodeURIComponent(`${title}\n${content}`.slice(0, 500));
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
  } catch {
    // Ignore announcement persistence errors in restricted browser contexts.
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
