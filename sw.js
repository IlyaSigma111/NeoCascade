const CACHE_NAME = 'neocascade-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/firebase-config.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage-compat.js'
];

// Установка SW
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Активация - очистка старых кешей
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегия: Network First, затем Cache
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET' || 
        event.request.url.startsWith('chrome-extension://') ||
        event.request.url.includes('firebaseio.com') ||
        event.request.url.includes('googleapis.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                const responseClone = response.clone();
                
                if (response.status === 200) {
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, responseClone));
                }
                
                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then(response => {
                        if (response) return response;
                        
                        if (event.request.headers.get('accept')?.includes('text/html')) {
                            return caches.match('/');
                        }
                    });
            })
    );
});

// Push уведомления
self.addEventListener('push', event => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        
        const options = {
            body: data.body || 'Новое сообщение в NeoCascade',
            icon: 'https://img.icons8.com/fluency/96/000000/chat.png',
            badge: 'https://img.icons8.com/fluency/96/000000/chat.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            },
            actions: [
                { action: 'open', title: '📱 Открыть' },
                { action: 'close', title: '❌ Закрыть' }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification('NeoCascade', options)
        );
        
    } catch (e) {
        console.error('Push error:', e);
    }
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/')
        );
    }
});
