// 오프라인 지원 서비스 워커
// - 페이지 파일(HTML/CSS/JS/데이터): 네트워크 우선, 느리거나 끊기면 저장본
// - 지도 타일·사진·폰트: 한 번 본 것은 저장해두고 저장본 우선 (바다 위에서도 보이게)
// 파일을 고친 뒤 배포할 때 VERSION 을 올리면 예전 저장본이 정리됩니다.
const VERSION = 'v3';
const SHELL_CACHE = `shell-${VERSION}`;
const TILE_CACHE = 'tiles-v1';
const MEDIA_CACHE = 'media-v1';
const MAX_TILES = 1500;

const SHELL = [
  './',
  'styles.css',
  'app.js',
  'data.js',
  'manifest.webmanifest',
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/leaflet.js',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('shell-') && k !== SHELL_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 네트워크 우선 + 시간 제한 (신호가 약하면 3.5초 후 저장본)
async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  const net = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, 3500));
  try {
    const res = await Promise.race([net, timeout]);
    if (res) return res;
  } catch {}
  const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
  if (cached) return cached;
  if (req.mode === 'navigate') {
    const shell = await cache.match('./');
    if (shell) return shell;
  }
  return net; // 저장본도 없으면 네트워크 결과(또는 오류)를 그대로
}

// 저장본 우선 (없으면 받아와서 저장)
async function cacheFirst(req, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    await cache.put(req, res.clone());
    if (limit) trim(cache, limit);
  }
  return res;
}
async function trim(cache, limit) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/data/routes.json')) return; // 없을 수도 있는 선택 파일
    e.respondWith(networkFirst(req));
  } else if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(cacheFirst(req, TILE_CACHE, MAX_TILES));
  } else if (/(^|\.)wikimedia\.org$/.test(url.hostname) || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req, MEDIA_CACHE));
  }
});
