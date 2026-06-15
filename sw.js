// Draft Advisor Service Worker
const CACHE = 'draft-advisor-v1';
const ASSETS = [
  '/draft-advisor/',
  '/draft-advisor/index.html',
  '/draft-advisor/manifest.json',
  '/draft-advisor/icon-192.png',
  '/draft-advisor/icon-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  // Network first for API calls, cache first for assets
  if(e.request.url.includes('anthropic.com') || 
     e.request.url.includes('fantasy.premierleague.com') ||
     e.request.url.includes('fonts.googleapis.com')){
    return; // Let these go straight to network
  }
  e.respondWith(
    caches.match(e.request).then(function(cached){
      return cached || fetch(e.request).then(function(response){
        // Cache new assets we haven't seen before
        if(response.status === 200){
          var clone = response.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
        }
        return response;
      });
    }).catch(function(){
      // Offline fallback - return cached index
      return caches.match('/draft-advisor/index.html');
    })
  );
});
