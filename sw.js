// Draft Advisor Service Worker
//
// SW_VERSION must be bumped every time this file changes. This is what actually makes a
// fix take effect: browsers only re-check/re-install a service worker when its own script
// bytes differ from what's already installed. Previously this file never changed between
// deploys, so a device that had already installed it kept running the same SW forever -
// completely independent of how many times a new index.html was pushed to GitHub Pages.
// Combined with the old cache-first strategy for the HTML shell below (serve whatever was
// cached at install time, never check the network), that meant new deploys could silently
// never reach a device at all. This version fixes both halves of that problem.
const SW_VERSION = 'v2';
const CACHE = 'draft-advisor-' + SW_VERSION;
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
  // Network first for API calls - always go straight to network, never touch the cache.
  if(e.request.url.includes('anthropic.com') ||
     e.request.url.includes('fantasy.premierleague.com') ||
     e.request.url.includes('fonts.googleapis.com')){
    return;
  }

  // Network first for the HTML shell itself (the actual page/navigation request), so a
  // fresh deploy is picked up on the very next load instead of being masked by a
  // long-lived cached copy. Falls back to the cached copy only if the network is
  // unreachable (offline use), which is the one case this app actually needs caching for.
  var isHTML = e.request.mode === 'navigate' ||
    e.request.url.endsWith('/draft-advisor/') ||
    e.request.url.endsWith('/draft-advisor/index.html');
  if(isHTML){
    e.respondWith(
      fetch(e.request).then(function(response){
        if(response.status === 200){
          var clone = response.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
        }
        return response;
      }).catch(function(){
        return caches.match(e.request).then(function(cached){
          return cached || caches.match('/draft-advisor/index.html');
        });
      })
    );
    return;
  }

  // Everything else (icons, manifest - static assets that essentially never change)
  // stays cache-first, for offline reliability and speed.
  e.respondWith(
    caches.match(e.request).then(function(cached){
      return cached || fetch(e.request).then(function(response){
        if(response.status === 200){
          var clone = response.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
        }
        return response;
      });
    }).catch(function(){
      return caches.match('/draft-advisor/index.html');
    })
  );
});
