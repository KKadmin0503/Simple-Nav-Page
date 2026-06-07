const MOBILE_RE = /Mobi|Android|iPhone|iPad/i;
const REDUCED_MOTION_MEDIA = '(prefers-reduced-motion: reduce)';

export async function applyBackground(config) {
  const bgLayer = document.getElementById('bgLayer');
  const bgOverlay = document.getElementById('bgOverlay');
  const background = config.background ?? {};

  if (!bgLayer) return;

  bgLayer.style.filter = background.blur ? `blur(${background.blur}px)` : '';

  if (bgOverlay) {
    bgOverlay.style.background = `rgba(0, 0, 0, ${background.overlayOpacity ?? 0})`;
  }

  try {
    const reducedMotion = prefersReducedMotion();

    if (!reducedMotion && background.mode === 'fixed-video' && background.fixedVideo) {
      renderVideoBackground(bgLayer, background.fixedVideo);
      return;
    }

    if (!reducedMotion && background.mode === 'video-api' && background.videoApi) {
      const videoUrl = await resolveVideoApi(background);
      if (videoUrl) {
        renderVideoBackground(bgLayer, videoUrl);
        return;
      }
    }

    renderImageBackground(bgLayer, resolveImageUrl(background, reducedMotion));
  } catch (err) {
    console.warn('背景加载失败：', err);
    renderImageBackground(bgLayer, resolveImageUrl(background));
  }
}

function resolveImageUrl(background, preferFixedImage = false) {
  if ((preferFixedImage || background.mode === 'fixed-image') && background.fixedImage) {
    return background.fixedImage;
  }

  const isMobile = MOBILE_RE.test(navigator.userAgent);
  const api = isMobile ? background.mobileImageApi : background.desktopImageApi;
  if (!api) return '';

  const suffix = background.refreshOnReload === false ? '' : Date.now();
  return `${api}${suffix}`;
}

async function resolveVideoApi(background) {
  const res = await fetch(background.videoApi, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`视频背景接口失败：${res.status}`);
  }

  if (background.videoApiResponseType === 'json') {
    const data = await res.json();
    return data.url || data.video || data.src || '';
  }

  return (await res.text()).trim();
}

function renderImageBackground(bgLayer, imageUrl) {
  clearVideoBackground(bgLayer);
  bgLayer.style.backgroundImage = imageUrl ? `url('${imageUrl}')` : '';
}

function renderVideoBackground(bgLayer, videoUrl) {
  bgLayer.style.backgroundImage = '';
  bgLayer.innerHTML = '';

  const video = document.createElement('video');
  video.className = 'bg-video';
  video.src = videoUrl;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';

  bgLayer.appendChild(video);
}

function clearVideoBackground(bgLayer) {
  const video = bgLayer.querySelector('.bg-video');
  if (video) {
    video.pause();
    video.remove();
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.(REDUCED_MOTION_MEDIA).matches === true;
}
