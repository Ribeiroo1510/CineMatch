/**
 * CineMatch Service Worker
 * Service Worker básico para PWA (sem funcionalidade offline)
 * Apenas registo mínimo para tornar a aplicação instalável
 */

const CACHE_NAME = 'cinematch-v1.0.0';
const STATIC_CACHE_URLS = [
    '/',
    '/index.php',
    '/css/style.css',
    '/js/app.js',
    '/manifest.json',
    '/logo.png'
];

// Evento de instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando CineMatch Service Worker');

    // Força o Service Worker a tornar-se ativo imediatamente
    self.skipWaiting();

    // Pre-cache de recursos estáticos básicos (opcional)
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cache aberto');
                // Não fazemos cache agressivo para manter a aplicação sempre atualizada
                return cache.addAll([
                    '/manifest.json',
                    '/logo.png'
                ]);
            })
            .catch((error) => {
                console.error('[Service Worker] Erro ao fazer cache:', error);
            })
    );
});

// Evento de ativação do Service Worker
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando CineMatch Service Worker');

    // Remove caches antigos
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // Toma controlo de todas as abas
                return self.clients.claim();
            })
    );
});

// Evento de fetch - Estratégia Network First
self.addEventListener('fetch', (event) => {
    // Apenas interceptar requisições GET
    if (event.request.method !== 'GET') {
        return;
    }

    // Ignorar requisições para APIs externas
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        // Estratégia Network First: tenta sempre a rede primeiro
        fetch(event.request)
            .then((networkResponse) => {
                // Se a resposta da rede for bem-sucedida, retorna diretamente
                if (networkResponse && networkResponse.status === 200) {
                    // Opcionalmente, atualiza o cache para recursos estáticos
                    if (shouldCache(event.request.url)) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                    }
                }
                return networkResponse;
            })
            .catch(() => {
                // Em caso de erro de rede, tenta o cache apenas para recursos básicos
                if (shouldCache(event.request.url)) {
                    return caches.match(event.request);
                }

                // Para páginas HTML, retorna uma mensagem de erro simples
                if (event.request.headers.get('accept').includes('text/html')) {
                    return new Response(
                        `<!DOCTYPE html>
                        <html>
                        <head>
                            <title>CineMatch - Sem Ligação</title>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                                body { 
                                    font-family: Arial, sans-serif; 
                                    text-align: center; 
                                    padding: 50px; 
                                    background: #1a1a2e;
                                    color: white;
                                }
                                h1 { color: #e94560; }
                                button {
                                    background: #e94560;
                                    color: white;
                                    border: none;
                                    padding: 10px 20px;
                                    border-radius: 5px;
                                    cursor: pointer;
                                    margin-top: 20px;
                                }
                                button:hover { background: #d63447; }
                            </style>
                        </head>
                        <body>
                            <h1>🎬 CineMatch</h1>
                            <h2>Sem ligação à Internet</h2>
                            <p>O CineMatch precisa de uma ligação à Internet para funcionar.</p>
                            <p>Verifique a sua ligação e tente novamente.</p>
                            <button onclick="window.location.reload()">🔄 Tentar Novamente</button>
                        </body>
                        </html>`,
                        {
                            headers: { 'Content-Type': 'text/html' }
                        }
                    );
                }

                // Para outros tipos de requisições, falha
                return new Response('Sem ligação à Internet', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
    );
});

// Função para determinar se um recurso deve ser guardado em cache
function shouldCache(url) {
    // Apenas faz cache de recursos estáticos básicos
    return url.includes('/icons/') ||
        url.includes('/css/') ||
        url.includes('/js/') ||
        url.endsWith('/manifest.json');
}

// Evento para mostrar notificações (se necessário no futuro)
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow('/')
    );
});

// Evento de sincronização em background (placeholder para funcionalidades futuras)
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);

    // Placeholder para sincronização de dados quando voltar online
    if (event.tag === 'background-sync') {
        // Implementar lógica de sincronização aqui se necessário
    }
});

// Evento de push (placeholder para notificações push futuras)
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push recebido:', event);

    // Placeholder para notificações push
    // const options = {
    //     body: 'Nova atividade no CineMatch!',
    //     icon: '/icons/icon-192x192.png',
    //     badge: '/icons/icon-192x192.png'
    // };

    // event.waitUntil(
    //     self.registration.showNotification('CineMatch', options)
    // );
});

console.log('[Service Worker] CineMatch Service Worker carregado');