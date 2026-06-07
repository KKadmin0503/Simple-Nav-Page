import { workerPathUrl } from '../api-client.js';

export function createNetMode({ getDomain }) {
  let isIntranet = localStorage.getItem('netMode') === 'intranet';

  function getCardUrl(item) {
    const url = isIntranet && item.intranet ? item.intranet : item.url;
    return workerPathUrl(url);
  }

  function toggleNetMode() {
    isIntranet = !isIntranet;
    localStorage.setItem('netMode', isIntranet ? 'intranet' : 'internet');
    updateNetToggleBtn();

    document.querySelectorAll('.card[data-url][data-intranet]').forEach(card => {
      const url = workerPathUrl(isIntranet ? card.dataset.intranet : card.dataset.url);
      card.href = url;

      const popup = card.querySelector('.info-popup');
      if (popup) popup.textContent = getDomain(url) ?? url;

      const badge = card.querySelector('.net-badge');
      if (badge) badge.textContent = isIntranet ? '内' : '外';
    });
  }

  function updateNetToggleBtn() {
    const btn = document.getElementById('netToggleBtn');
    if (!btn) return;
    btn.textContent = isIntranet ? '🏠 内网' : '🌐 外网';
    btn.classList.toggle('intranet-active', isIntranet);
  }

  function injectNetToggleBtn() {
    if (document.getElementById('netToggleBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'netToggleBtn';
    btn.className = 'net-toggle-btn';
    btn.addEventListener('click', toggleNetMode);
    document.body.appendChild(btn);
  }

  return {
    getCardUrl,
    injectNetToggleBtn,
    updateNetToggleBtn,
    toggleNetMode
  };
}
