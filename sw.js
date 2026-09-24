/* ============================================================
   小熊工作台 · Service Worker
   离线缓存策略：缓存优先，网络更新（stale-while-revalidate）
   不依赖具体文件名，适配任意部署路径
   ============================================================ */
const CACHE_NAME = 'bear-workbench-v6';

// 逐个缓存（忽略不存在的文件，避免 addAll 全部失败）
function cacheIgnoreErrors(cache, urls){
  return Promise.all(urls.map(u =>
    cache.add(u).catch(() => {})
  ));
}

// 安装：预缓存可能的入口文件
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cacheIgnoreErrors(cache, ['./', './index.html', './个人全能工作台.html']))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// 拦截请求
self.addEventListener('fetch', e => {
  const req = e.request;
  // 导航请求：网络优先，失败再回退缓存（确保用户拿到最新 HTML）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(resp => {
          if (resp && resp.ok) {
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, respClone));
          }
          return resp;
        })
        .catch(() =>
          caches.match(req)
            .then(cached => cached || caches.match('./') || caches.match('./index.html'))
        )
    );
    return;
  }
  // 其他同源请求：缓存优先，回退网络（静态资源不需要每次最新）
  if (req.url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        if (resp && resp.ok) {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, respClone));
        }
        return resp;
      }).catch(() => cached))
    );
  }
});

// 接收消息：手动触发更新
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
