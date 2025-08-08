// ===================================
// Focus Timer - Enhanced Service Worker
// Best in Class PWA Implementation
// ===================================

const CACHE_NAME = 'focus-timer-v1.0.2';
const STATIC_CACHE = 'focus-static-v1.0.2';
const AUDIO_CACHE = 'focus-audio-v1.0.2';

// Core app files that must be cached
const CORE_FILES = [
  './',
  './index.html',
  './css/main.css',
  './js/app.js',
  './manifest.json'
];

// Audio files for offline functionality
const AUDIO_FILES = [
  './audio/white.mp3',
  './audio/rain.mp3',
  './audio/lofi.mp3',
  './audio/lofi_study.mp3',
  './audio/lofi_movie.mp3',
  './audio/forest.mp3',
  './audio/brown.mp3',
  './audio/beethoven.mp3',
  './audio/bar.mp3',
  './audio/75hz.mp3'
];

// Install Event - Cache core files immediately
self.addEventListener('install', (event) => {
  console.log('🔧 Installing Focus Timer Service Worker v1.0.2');
  
  event.waitUntil(
    Promise.all([
      // Cache core application files
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📦 Caching core application files...');
        return cache.addAll(CORE_FILES);
      }),
      
      // Cache audio files (with error handling)
      caches.open(AUDIO_CACHE).then(cache => {
        console.log('🎵 Caching audio files...');
        const audioPromises = AUDIO_FILES.map(url => 
          cache.add(url).catch(err => {
            console.log(`⚠️ Could not cache audio file ${url}:`, err.message);
            return null; // Continue with other files
          })
        );
        return Promise.allSettled(audioPromises);
      })
    ]).then(() => {
      console.log('✅ Service Worker installation complete');
      // Force activation
      return self.skipWaiting();
    }).catch(error => {
      console.error('❌ Service Worker installation failed:', error);
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Activating Focus Timer Service Worker');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        const deletePromises = cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== AUDIO_CACHE) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        });
        return Promise.all(deletePromises);
      }),
      
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activation complete');
    })
  );
});

// Fetch Event - Intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and external URLs
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Different caching strategies based on resource type
  if (url.pathname.includes('/audio/')) {
    // Audio files: Cache First (for offline playback)
    event.respondWith(handleAudioRequest(request));
  } else if (CORE_FILES.includes(url.pathname) || url.pathname === '/') {
    // Core files: Stale While Revalidate
    event.respondWith(handleCoreFileRequest(request));
  } else {
    // Other files: Network First
    event.respondWith(handleNetworkFirstRequest(request));
  }
});

// Audio Request Handler - Cache First Strategy
async function handleAudioRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('🎵 Serving audio from cache:', request.url);
      return cachedResponse;
    }

    // If not in cache, try network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(AUDIO_CACHE);
      cache.put(request, networkResponse.clone());
      console.log('🎵 Cached new audio file:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('❌ Audio file unavailable:', request.url);
    
    // Return a placeholder response for failed audio requests
    return new Response(null, {
      status: 404,
      statusText: 'Audio file not available offline'
    });
  }
}

// Core File Request Handler - Stale While Revalidate
async function handleCoreFileRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  
  try {
    // Serve from cache immediately if available
    const cachedResponse = await cache.match(request);
    
    // Start network request in background
    const networkResponsePromise = fetch(request)
      .then(response => {
        if (response.ok) {
          // Update cache with fresh content
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => null);

    // Return cached version immediately, or wait for network if no cache
    if (cachedResponse) {
      // Don't await - update cache in background
      networkResponsePromise.catch(() => {}); 
      return cachedResponse;
    } else {
      // No cache available, wait for network
      const networkResponse = await networkResponsePromise;
      return networkResponse || createOfflineFallback();
    }
    
  } catch (error) {
    console.log('❌ Core file request failed:', request.url);
    return createOfflineFallback();
  }
}

// Network First Handler - For non-critical resources
async function handleNetworkFirstRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Last resort fallback
    return new Response('Resource temporarily unavailable', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Offline Fallback Page
function createOfflineFallback() {
  const offlineHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Focus Timer - Offline</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .container { 
          text-align: center; 
          max-width: 400px; 
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 { 
          font-size: 2rem; 
          margin-bottom: 1rem; 
          font-weight: 300;
          letter-spacing: 4px;
        }
        p { 
          line-height: 1.6; 
          margin-bottom: 2rem; 
          opacity: 0.9;
        }
        .btn { 
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 12px 24px;
          border-radius: 50px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          margin: 0 8px;
        }
        .btn:hover { 
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
        .status {
          display: inline-block;
          width: 8px;
          height: 8px;
          background: #ff4444;
          border-radius: 50%;
          margin-right: 8px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>FOCUS</h1>
        <p><span class="status"></span>You're currently offline</p>
        <p>Focus Timer needs an internet connection to load. Please check your connection and try again.</p>
        <button class="btn" onclick="location.reload()">Retry</button>
        <a href="./" class="btn">Go Home</a>
      </div>
      <script>
        // Auto-retry when online
        window.addEventListener('online', () => {
          location.reload();
        });
        
        // Update status
        function updateStatus() {
          const status = document.querySelector('.status');
          if (navigator.onLine) {
            status.style.background = '#44ff44';
            setTimeout(() => location.reload(), 1000);
          }
        }
        setInterval(updateStatus, 2000);
      </script>
    </body>
    </html>
  `;

  return new Response(offlineHTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// Background Sync - For future features
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === 'focus-session-sync') {
    event.waitUntil(syncFocusSessions());
  }
});

async function syncFocusSessions() {
  try {
    // Here you could sync completed sessions to a server
    console.log('📊 Syncing focus sessions...');
    
    // Get stored sessions from IndexedDB or localStorage
    const sessions = localStorage.getItem('pomodoroProgress');
    if (sessions) {
      // Could send to analytics or user dashboard
      console.log('📈 Sessions to sync:', sessions);
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('❌ Session sync failed:', error);
    throw error;
  }
}

// Push Notifications - For break reminders
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'Time for a focus session!',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'focus-reminder',
    requireInteraction: false,
    silent: false,
    actions: [
      {
        action: 'start',
        title: '▶️ Start Session'
      },
      {
        action: 'snooze',
        title: '⏰ Snooze 5min'
      }
    ],
    data: {
      url: './',
      timestamp: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification('🎯 Focus Timer', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('📱 Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'start') {
    // Open app and start session
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => {
          // Focus existing window or open new one
          const focusClient = clients.find(client => 
            client.url.includes(self.location.origin)
          );
          
          if (focusClient) {
            return focusClient.focus();
          } else {
            return clients.openWindow('./');
          }
        })
    );
  } else if (event.action === 'snooze') {
    // Re-schedule notification in 5 minutes
    console.log('⏰ Snoozing notification for 5 minutes');
  } else {
    // Default action - just open the app
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});

// Error Handler
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
});

// Message Handler - For communication with main app
self.addEventListener('message', (event) => {
  console.log('📬 Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    // Clear all caches (for debugging)
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
});

// Periodic Background Sync - For future features
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'focus-stats-sync') {
    event.waitUntil(syncUserStats());
  }
});

async function syncUserStats() {
  try {
    // Could sync user statistics and streak data
    console.log('📊 Syncing user statistics...');
    return Promise.resolve();
  } catch (error) {
    console.error('❌ Stats sync failed:', error);
  }
}

console.log('🚀 Focus Timer Service Worker loaded successfully - v1.0.2');
