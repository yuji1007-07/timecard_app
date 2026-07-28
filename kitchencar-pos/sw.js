/* ボナペティ POS ── Service Worker
   目的：電波が弱くてもアプリが「即座に」開くようにする。
   ・アプリ本体（HTML/CSS/JS）は端末にキャッシュし、次回から瞬時に表示
   ・Firebaseの通信はキャッシュせず、常に最新を取得（売上データの取り違え防止）
*/
const VERSION = 'bonappetit-pos-v2.0.0';
const SHELL = [
  './',
  './index.html',
  './order.html',
  './style.css',
  './app-config.js',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase のデータ通信・認証は絶対にキャッシュしない
  if (/firebaseio\.com|firebasedatabase\.app|googleapis\.com|identitytoolkit/.test(url.hostname)) return;

  // Firebase SDK・QRライブラリ（CDN）は「あればキャッシュ、裏で更新」
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // 自サイトのページ：まずネットワーク、ダメならキャッシュ
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // 自サイトの静的ファイル：まずキャッシュ（=高速）、裏で更新
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
