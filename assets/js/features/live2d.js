const MOBILE_RE = /Mobi|Android|iPhone|iPad/i;
const MOBILE_WIDTH_MEDIA = '(max-width: 720px)';
const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';

export async function initLive2D(config) {
  const live2dConfig = config.live2d ?? {};
  if (!live2dConfig.enabled) {
    setLive2DState({ enabled: false, reason: 'disabled' });
    return;
  }

  if (prefersReducedMotion()) {
    setLive2DState({ enabled: false, reason: 'reduced-motion' });
    return;
  }

  if (!live2dConfig.mobileEnabled && isMobileViewport()) {
    setLive2DState({ enabled: false, reason: 'mobile-disabled' });
    return;
  }

  const resources = live2dConfig.resources ?? {};
  if (!resources.css || !resources.script) {
    setLive2DState({ enabled: false, reason: 'missing-resources' });
    return;
  }

  try {
    patchImageCrossOrigin();
    await loadStylesheet(resources.css, 'live2d-widget-style');
    await loadScript(resources.script, 'live2d-widget-script', true);

    if (typeof window.initWidget !== 'function') {
      throw new Error('initWidget is unavailable');
    }

    window.initWidget(buildWidgetOptions(live2dConfig));
    document.body.classList.add('live2d-enabled');
    setLive2DState({ enabled: true, position: live2dConfig.position || 'right-bottom' });
  } catch (err) {
    console.warn('Live2D 加载失败：', err);
    setLive2DState({ enabled: false, reason: err?.message || 'load-failed' });
  }
}

function isMobileViewport() {
  return MOBILE_RE.test(navigator.userAgent)
    || window.matchMedia?.(MOBILE_WIDTH_MEDIA).matches
    || window.innerWidth <= 720;
}

function prefersReducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION_MEDIA).matches === true;
}

function buildWidgetOptions(config) {
  const resources = config.resources ?? {};
  return {
    waifuPath: resources.waifuPath,
    cdnPath: resources.cdnPath,
    cubism2Path: resources.cubism2Path,
    cubism5Path: resources.cubism5Path,
    modelId: config.modelId,
    tools: config.tools,
    drag: config.draggable !== false,
    logLevel: config.logLevel || 'warn'
  };
}

function loadStylesheet(href, id) {
  if (document.getElementById(id)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`stylesheet load failed: ${href}`));
    document.head.appendChild(link);
  });
}

function loadScript(src, id, module = false) {
  if (document.getElementById(id)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    if (module) {
      script.type = 'module';
    }
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`script load failed: ${src}`));
    document.head.appendChild(script);
  });
}

function setLive2DState(value) {
  window.__live2dWidgetState = value;
  document.documentElement.dataset.live2dEnabled = String(value.enabled);
  if (value.reason) {
    document.documentElement.dataset.live2dReason = value.reason;
  }
}

function patchImageCrossOrigin() {
  if (window.__live2dImagePatched) return;

  const OriginalImage = window.Image;
  window.Image = function (...args) {
    const img = new OriginalImage(...args);
    img.crossOrigin = 'anonymous';
    return img;
  };
  window.Image.prototype = OriginalImage.prototype;
  window.__live2dImagePatched = true;
}
