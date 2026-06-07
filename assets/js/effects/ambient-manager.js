const MOBILE_RE = /Mobi|Android|iPhone|iPad/i;
const MOBILE_WIDTH_MEDIA = '(max-width: 720px)';
const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';

export function initAmbientEffect(config) {
  const effectConfig = normalizeConfig(config.ambientEffect ?? {});
  const layer = document.getElementById('ambientLayer');

  if (!layer || !effectConfig.enabled || effectConfig.type === 'none') {
    setAmbientState({ enabled: false, reason: 'disabled' });
    return;
  }

  if (prefersReducedMotion()) {
    setAmbientState({ enabled: false, reason: 'reduced-motion' });
    return;
  }

  if (!effectConfig.mobileEnabled && isMobileViewport()) {
    setAmbientState({ enabled: false, reason: 'mobile-disabled' });
    return;
  }

  layer.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const count = Math.round(effectConfig.maxParticles * effectConfig.intensity);

  for (let i = 0; i < count; i++) {
    fragment.appendChild(createParticle(effectConfig, i));
  }

  layer.appendChild(fragment);
  setAmbientState({
    enabled: true,
    type: effectConfig.type,
    particles: count
  });

  return () => {
    layer.innerHTML = '';
    setAmbientState({ enabled: false, reason: 'stopped' });
  };
}

function normalizeConfig(config) {
  return {
    enabled: Boolean(config.enabled),
    type: config.type || 'sakura',
    intensity: clamp(config.intensity ?? 0.65, 0.1, 1),
    maxParticles: clamp(config.maxParticles ?? 70, 10, 140),
    speed: clamp(config.speed ?? 1, 0.2, 3),
    opacity: clamp(config.opacity ?? 0.82, 0.1, 1),
    wind: clamp(config.wind ?? 0.35, -2, 2),
    mobileEnabled: Boolean(config.mobileEnabled)
  };
}

function createParticle(config, index) {
  const el = document.createElement('span');
  el.className = `ambient-particle ${config.type}`;

  const x = random(-8, 108);
  const drift = config.type === 'rain'
    ? random(-160, -60) * config.speed
    : random(20, 80) * (config.wind || 0.35);
  const durationBase = config.type === 'rain' ? random(0.75, 1.55) : random(9, 18);
  const duration = durationBase / config.speed;
  const delay = -random(0, duration);
  const size = config.type === 'rain' ? random(22, 42) : config.type === 'snow' ? random(2, 5) : random(9, 18);

  el.style.setProperty('--x', `${x}vw`);
  el.style.setProperty('--drift', `${drift}px`);
  el.style.setProperty('--duration', `${duration}s`);
  el.style.setProperty('--size', `${size}px`);
  el.style.setProperty('--opacity', String(random(0.35, config.opacity)));
  el.style.setProperty('--rotate', `${random(160, 420)}deg`);
  el.style.animationDelay = `${delay}s`;
  el.dataset.index = String(index);

  return el;
}

function setAmbientState(value) {
  const layer = document.getElementById('ambientLayer');
  if (!layer) return;
  ['enabled', 'reason', 'type', 'particles'].forEach(key => {
    delete layer.dataset[key];
  });
  Object.entries(value).forEach(([key, item]) => {
    layer.dataset[key] = String(item);
  });
}

function isMobileViewport() {
  return MOBILE_RE.test(navigator.userAgent)
    || window.matchMedia?.(MOBILE_WIDTH_MEDIA).matches
    || window.innerWidth <= 720;
}

function prefersReducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION_MEDIA).matches === true;
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
