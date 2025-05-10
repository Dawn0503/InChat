// // 最简单Service Worker测试文件
// console.log('测试Service Worker加载');

// // 缓存名称
// const STATIC_CACHE_NAME = 'inchat-static-v1';
// const DATA_CACHE_NAME = 'inchat-data-v1';

// // 需要缓存的核心静态资源
// const STATIC_RESOURCES = [
//   '/',
//   '/index.html',
//   '/static/js/main.chunk.js',
//   '/static/js/vendors.chunk.js',
//   '/static/css/main.chunk.css',
//   '/static/media/logo.png',
//   '/manifest.json'
// ];

// // 用于存储缓存的消息
// let cachedMessages = {};

// // 安装
// self.addEventListener('install', (event) => {
//   console.log('测试Service Worker安装');
  
//   // 缓存静态资源
//   event.waitUntil(
//     caches.open(STATIC_CACHE_NAME)
//       .then(cache => {
//         console.log('缓存静态资源');
//         return cache.addAll(STATIC_RESOURCES).catch(error => {
//           console.error('缓存静态资源失败:', error);
//         });
//       })
//       .then(() => self.skipWaiting())
//   );
// });

// // 激活
// self.addEventListener('activate', (event) => {
//   console.log('测试Service Worker激活');
  
//   // 清理旧缓存
//   event.waitUntil(
//     caches.keys().then(cacheNames => {
//       return Promise.all(
//         cacheNames.map(cacheName => {
//           if (cacheName !== STATIC_CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
//             console.log('删除旧缓存:', cacheName);
//             return caches.delete(cacheName);
//           }
//         })
//       );
//     })
//     .then(() => {
//       // 立即控制所有页面
//       return self.clients.claim();
//     })
//     .then(() => {
//       // 通知所有页面
//       return self.clients.matchAll().then(clients => {
//         clients.forEach(client => {
//           client.postMessage({
//             type: 'SW_ACTIVATED',
//             message: '测试Service Worker已激活'
//           });
//         });
//       });
//     })
//   );
// });

// // 消息
// self.addEventListener('message', (event) => {
//   console.log('测试Service Worker收到消息', event.data);
  
//   // 处理缓存消息请求
//   if (event.data && event.data.type === 'CACHE_MESSAGES') {
//     const { userId, chatWithUserId, messages } = event.data;
    
//     if (userId && chatWithUserId && messages) {
//       // 缓存消息
//       const cacheKey = `chat_${userId}_${chatWithUserId}`;
//       cachedMessages[cacheKey] = {
//         messages,
//         timestamp: new Date().toISOString()
//       };
      
//       console.log(`缓存了 ${messages.length} 条消息，key: ${cacheKey}`);
      
//       // 同时存储到Cache API以提高持久性
//       caches.open(DATA_CACHE_NAME).then(cache => {
//         cache.put(new Request(`/api/cached-messages/${cacheKey}`), 
//           new Response(JSON.stringify(messages), {
//             headers: { 'Content-Type': 'application/json' }
//           })
//         ).then(() => {
//           console.log(`消息已存储到Cache API: ${cacheKey}`);
//         });
//       });
      
//       // 发送确认消息
//       if (event.source) {
//         event.source.postMessage({
//           type: 'CACHE_MESSAGES_RECEIVED',
//           count: messages.length,
//           cacheKey,
//           success: true
//         });
//       }
//     }
//   }
  
//   // 响应消息
//   if (event.source) {
//     event.source.postMessage({
//       type: 'SW_RESPONSE',
//       message: '已收到消息',
//       receivedType: event.data?.type || '未知'
//     });
//   }
// });

// // fetch处理
// self.addEventListener('fetch', (event) => {
//   const url = new URL(event.request.url);
  
//   // 处理API请求
//   if (url.pathname.startsWith('/api/')) {
//     // 网络优先策略处理API请求
//     event.respondWith(
//       fetch(event.request.clone())
//         .then(response => {
//           // 如果是消息API请求，缓存响应
//           if (url.pathname.includes('/api/messages') && response.ok) {
//             const responseClone = response.clone();
//             caches.open(DATA_CACHE_NAME).then(cache => {
//               cache.put(event.request, responseClone);
//             });
//           }
//           return response;
//         })
//         .catch(() => {
//           console.log('API请求失败，尝试使用缓存');
          
//           // 处理消息API请求
//           if (url.pathname.includes('/api/messages')) {
//             // 从URL中提取用户ID
//             const params = new URLSearchParams(url.search);
//             const sender = params.get('sender');
//             const receiver = params.get('receiver');
            
//             if (sender && receiver) {
//               // 尝试两种可能的缓存键
//               const key1 = `chat_${sender}_${receiver}`;
//               const key2 = `chat_${receiver}_${sender}`;
              
//               if (cachedMessages[key1]) {
//                 console.log(`使用内存缓存: ${key1}`);
//                 return new Response(JSON.stringify(cachedMessages[key1].messages), {
//                   headers: { 'Content-Type': 'application/json' }
//                 });
//               } else if (cachedMessages[key2]) {
//                 console.log(`使用内存缓存: ${key2}`);
//                 return new Response(JSON.stringify(cachedMessages[key2].messages), {
//                   headers: { 'Content-Type': 'application/json' }
//                 });
//               }
              
//               // 尝试从Cache API获取
//               return caches.match(event.request).then(response => {
//                 if (response) {
//                   console.log('使用Cache API缓存的API响应');
//                   return response;
//                 }
                
//                 // 尝试检查是否有专门缓存的消息
//                 return caches.match(new Request(`/api/cached-messages/chat_${sender}_${receiver}`))
//                   .then(cachedResponse => {
//                     if (cachedResponse) {
//                       console.log(`使用Cache API的消息缓存: chat_${sender}_${receiver}`);
//                       return cachedResponse;
//                     }
                    
//                     return caches.match(new Request(`/api/cached-messages/chat_${receiver}_${sender}`))
//                       .then(reverseCachedResponse => {
//                         if (reverseCachedResponse) {
//                           console.log(`使用Cache API的消息缓存: chat_${receiver}_${sender}`);
//                           return reverseCachedResponse;
//                         }
                        
//                         // 如果找不到缓存，返回空数组
//                         return new Response(JSON.stringify([]), {
//                           headers: { 'Content-Type': 'application/json' }
//                         });
//                       });
//                   });
//               });
//             }
//           }
          
//           // 尝试从缓存中获取其他API响应
//           return caches.match(event.request);
//         })
//     );
//   } else {
//     // 缓存优先策略处理静态资源
//     event.respondWith(
//       caches.match(event.request).then(response => {
//         // 如果在缓存中找到了响应，直接返回
//         if (response) {
//           return response;
//         }
        
//         // 如果没有找到，尝试从网络获取
//         return fetch(event.request.clone()).then(response => {
//           // 检查是否是有效的响应
//           if (!response || response.status !== 200 || response.type !== 'basic') {
//             return response;
//           }
          
//           // 缓存获取的资源
//           const responseToCache = response.clone();
          
//           caches.open(STATIC_CACHE_NAME).then(cache => {
//             cache.put(event.request, responseToCache);
//             console.log('缓存新的静态资源:', event.request.url);
//           });

          
//           return response;
//         }).catch(error => {
//           console.error('获取资源失败:', error);
//           // 对于导航请求，可以返回离线页面
//           if (event.request.mode === 'navigate') {
//             return caches.match('/offline.html').catch(() => {
//               return new Response('您当前处于离线状态。', {
//                 headers: { 'Content-Type': 'text/html;charset=utf-8' }
//               });
//             });
//           }
//           throw error;
//         });
//       })
//     );
//   }
// }); 