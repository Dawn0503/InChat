// 定义缓存名称和需要缓存的资源
const CACHE_NAME = 'inchat-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/media/',
  '/favicon.ico',
  '/manifest.json'
];

// API缓存配置
const API_CACHE_NAME = 'inchat-api-cache-v1';
const API_ROUTES = [
  '/api/user',
  '/api/friends',
  '/api/messages'
];

// 消息缓存
const MESSAGE_CACHE_NAME = 'inchat-messages-v1';

// 调试日志函数
function logWithTimestamp(message, data) {
  const timestamp = new Date().toISOString();
  const fullMessage = `[SW ${timestamp}] ${message}`;
  console.log(fullMessage, data ? data : '');
  
  // 尝试向所有客户端发送日志
  sendToAllClients({
    type: 'SW_LOG',
    timestamp,
    message,
    data: data || null
  }).catch(err => {
    console.error('[SW] 发送日志消息失败:', err);
  });
}

// 向所有客户端发送消息的辅助函数
function sendToAllClients(message) {
  return self.clients.matchAll({ 
    includeUncontrolled: true, 
    type: 'window' 
  })
  .then(clients => {
    if (!clients || clients.length === 0) {
      console.log('[SW] 没有找到可发送消息的客户端');
      return Promise.resolve();
    }
    
    const sendPromises = clients.map(client => {
      return new Promise((resolve, reject) => {
        try {
          client.postMessage(message);
          resolve();
        } catch (err) {
          console.error('[SW] 发送消息到客户端失败:', err);
          reject(err);
        }
      });
    });
    
    return Promise.allSettled(sendPromises);
  });
}

// 向所有客户端发送通知
function notifyAllClients(message) {
  return sendToAllClients(message)
    .then(() => {
      // 延迟2秒再次发送确认消息，确保通信正常
      setTimeout(() => {
        sendToAllClients({
          type: 'SW_CONFIRMATION',
          originalMessage: message.type,
          timestamp: new Date().toISOString()
        });
      }, 2000);
    });
}

// 安装后的自检函数
function performSelfCheck() {
  logWithTimestamp('执行Service Worker自检...');

  // 检查缓存API
  if ('caches' in self) {
    logWithTimestamp('缓存API可用');
    
    // 列出所有缓存
    caches.keys().then(keys => {
      logWithTimestamp(`已有 ${keys.length} 个缓存:`, keys);
    }).catch(err => {
      logWithTimestamp('获取缓存列表失败:', err);
    });
  } else {
    logWithTimestamp('警告: 缓存API不可用');
  }
  
  // 检查客户端控制
  self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    logWithTimestamp(`找到 ${clients.length} 个客户端`);
    clients.forEach((client, index) => {
      const controlled = client.url ? (client.type + (self.registration.scope ? '受控' : '未受控')) : '未知';
      logWithTimestamp(`客户端 ${index+1}: ${client.url} (${controlled})`);
    });
  }).catch(err => {
    logWithTimestamp('获取客户端列表失败:', err);
  });
  
  // 向所有客户端发送自检消息
  sendToAllClients({
    type: 'SW_SELF_CHECK',
    timestamp: new Date().toISOString(),
    result: 'OK'
  });
}

// 直接向主线程发送消息
self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
  .then(clients => {
    if (clients.length > 0) {
      logWithTimestamp(`找到 ${clients.length} 个客户端，准备发送消息`);
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_LOADED',
          message: '简化版Service Worker已加载',
          timestamp: new Date().toISOString()
        });
      });
    } else {
      logWithTimestamp('没有找到客户端，消息将在客户端连接后发送');
      
      // 设置间隔，尝试在客户端连接后发送消息
      const checkInterval = setInterval(() => {
        self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
          .then(clients => {
            if (clients.length > 0) {
              logWithTimestamp(`现在找到了 ${clients.length} 个客户端，发送延迟消息`);
              clients.forEach(client => {
                client.postMessage({
                  type: 'SW_LOADED_DELAYED',
                  message: '简化版Service Worker已加载(延迟通知)',
                  timestamp: new Date().toISOString()
                });
              });
              clearInterval(checkInterval);
            }
          });
      }, 3000);
    }
  });

// 捕获全局错误
self.addEventListener('error', (event) => {
  logWithTimestamp('简化版Service Worker发生错误:', event.error);
});

// 捕获未处理的promise拒绝
self.addEventListener('unhandledrejection', (event) => {
  logWithTimestamp('简化版Service Worker有未处理的Promise拒绝:', event.reason);
});

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
  logWithTimestamp('简化版Service Worker正在安装');
  
  // 立即接管页面，不等待页面刷新
  self.skipWaiting();
  
  // 预缓存核心资源
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        logWithTimestamp('正在缓存静态资源');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {mode: 'no-cors'})))
          .then(() => logWithTimestamp('静态资源缓存完成'))
          .catch(err => {
            logWithTimestamp('缓存部分静态资源失败', err);
            // 单个资源失败不应阻止安装，继续进行
            return Promise.resolve();
          });
      })
  );
});

// 激活事件 - 清理旧缓存并控制所有客户端
self.addEventListener('activate', (event) => {
  logWithTimestamp('简化版Service Worker已激活');
  
  // 清理旧版本缓存并控制所有打开的客户端
  event.waitUntil(
    Promise.all([
      // 清理旧缓存
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== API_CACHE_NAME && 
                cacheName !== MESSAGE_CACHE_NAME) {
              logWithTimestamp('删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // 立即接管所有打开的页面
      self.clients.claim().then(() => {
        logWithTimestamp('简化版Service Worker已接管所有客户端');
        
        // 执行自检
        setTimeout(performSelfCheck, 1000);
        
        // 通知所有客户端Service Worker已激活
        return notifyAllClients({
          type: 'SW_ACTIVATED',
          message: '简化版Service Worker已激活并控制页面',
          timestamp: new Date().toISOString()
        });
      })
    ])
  );
});

// 消息事件处理
self.addEventListener('message', (event) => {
  logWithTimestamp('简化版Service Worker收到消息:', event.data);
  
  // 获取消息的源和数据
  const source = event.source;
  const data = event.data;
  
  // 如果消息包含ports，说明是使用MessageChannel发送的
  const ports = event.ports || (event.data && event.data.ports);
  
  // 立即回复确认消息已收到(基本确认)
  if (source) {
    source.postMessage({
      type: 'SW_MESSAGE_RECEIVED',
      originalMessage: data,
      timestamp: new Date().toISOString()
    });
  }
  
  // 根据消息类型处理
  if (data) {
    switch (data.type) {
      case 'TEST_MESSAGE':
        logWithTimestamp('收到测试消息:', data);
        // 发送详细的测试消息回复
        if (source) {
          source.postMessage({
            type: 'TEST_RESPONSE',
            originalMessage: data,
            timestamp: new Date().toISOString(),
            status: 'success'
          });
        }
        break;
        
      case 'HELLO_FROM_PAGE':
        logWithTimestamp('收到页面问候:', data);
        // 回复问候
        if (source) {
          source.postMessage({
            type: 'HELLO_FROM_SW',
            message: '服务工作器向页面问好!',
            timestamp: new Date().toISOString()
          });
        }
        break;
        
      case 'TEST_COMMUNICATION':
        logWithTimestamp('收到通信测试请求:', data);
        // 使用MessageChannel回复
        if (event.ports && event.ports[0]) {
          logWithTimestamp('通过MessageChannel port回复');
          event.ports[0].postMessage({
            type: 'TEST_RESPONSE',
            message: '使用MessageChannel成功通信',
            timestamp: new Date().toISOString()
          });
        } else if (source) {
          // 退回到常规回复
          logWithTimestamp('通过source回复(MessageChannel失败)');
          source.postMessage({
            type: 'TEST_RESPONSE',
            message: '使用常规通信',
            timestamp: new Date().toISOString()
          });
        }
        break;
        
      case 'CACHE_MESSAGES':
        const { messages, userId, chatWithUserId } = data;
        logWithTimestamp(`收到缓存消息请求，消息数量: ${messages.length}`);
        
        // 缓存聊天消息
        caches.open(MESSAGE_CACHE_NAME).then(cache => {
          const url = `/chat-messages/${userId}-${chatWithUserId}`;
          const response = new Response(JSON.stringify(messages), {
            headers: { 'Content-Type': 'application/json' }
          });
          
          cache.put(url, response).then(() => {
            logWithTimestamp(`已缓存 ${messages.length} 条消息到 ${url}`);
            
            // 返回确认消息
            if (source) {
              source.postMessage({
                type: 'CACHE_MESSAGES_RECEIVED',
                count: messages.length,
                userId,
                chatWithUserId,
                success: true,
                timestamp: new Date().toISOString()
              });
              
              // 发送额外的通知消息确保通信成功
              setTimeout(() => {
                if (source) {
                  source.postMessage({
                    type: 'SW_NOTIFICATION',
                    message: `已缓存 ${messages.length} 条消息`,
                    timestamp: new Date().toISOString()
                  });
                }
              }, 500);
            }
          }).catch(error => {
            logWithTimestamp('缓存消息失败:', error);
            
            if (source) {
              source.postMessage({
                type: 'CACHE_MESSAGES_ERROR',
                error: error.message,
                timestamp: new Date().toISOString()
              });
            }
          });
        });
        break;
        
      case 'CLEAR_CACHE':
        logWithTimestamp('收到清理缓存请求');
        Promise.all([
          caches.delete(CACHE_NAME),
          caches.delete(API_CACHE_NAME),
          caches.delete(MESSAGE_CACHE_NAME)
        ]).then(() => {
          logWithTimestamp('缓存已清理');
          if (source) {
            source.postMessage({
              type: 'CACHE_CLEARED',
              timestamp: new Date().toISOString()
            });
          }
        }).catch(error => {
          logWithTimestamp('清理缓存出错:', error);
          if (source) {
            source.postMessage({
              type: 'CACHE_CLEAR_ERROR',
              error: error.message,
              timestamp: new Date().toISOString()
            });
          }
        });
        break;
        
      case 'DEBUG_REQUEST':
        handleDebugRequest(source);
        break;
        
      default:
        logWithTimestamp('收到未知类型消息:', data);
        if (source) {
          source.postMessage({
            type: 'UNKNOWN_MESSAGE_TYPE',
            originalType: data.type,
            timestamp: new Date().toISOString()
          });
        }
    }
  }
});

// 处理调试请求
function handleDebugRequest(replyChannel) {
  logWithTimestamp('处理调试请求');
  
  // 收集诊断信息
  Promise.all([
    caches.keys(),
    self.clients.matchAll({ includeUncontrolled: true }),
    self.registration.scope ? Promise.resolve(self.registration.scope) : Promise.resolve(null)
  ])
  .then(([cacheKeys, clients, scope]) => {
    const diagnosticInfo = {
      caches: cacheKeys,
      clients: clients.map(client => client.url),
      scope,
      timestamp: new Date().toISOString()
    };
    
    logWithTimestamp('诊断信息:', diagnosticInfo);
    
    try {
      if (replyChannel) {
        replyChannel.postMessage({
          type: 'DEBUG_RESPONSE',
          info: diagnosticInfo,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[SW] 发送调试响应失败:', err);
    }
  })
  .catch(error => {
    logWithTimestamp('收集诊断信息失败:', error);
    
    try {
      if (replyChannel) {
        replyChannel.postMessage({
          type: 'DEBUG_ERROR',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[SW] 发送调试错误响应失败:', err);
    }
  });
}

// Fetch事件处理 - 缓存优先策略
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // 忽略非GET请求
  if (request.method !== 'GET') {
    return;
  }
  
  // 处理API请求 - 网络优先，失败时使用缓存
  if (API_ROUTES.some(route => url.pathname.includes(route))) {
    event.respondWith(
      fetchAndCache(request, API_CACHE_NAME)
        .catch(() => {
          logWithTimestamp(`API请求失败，尝试从缓存获取: ${url.pathname}`);
          return fromCache(request, API_CACHE_NAME);
        })
    );
    return;
  }
  
  // 处理聊天消息请求 - 特殊处理
  if (url.pathname.includes('/chat-messages/')) {
    event.respondWith(
      fromCache(request, MESSAGE_CACHE_NAME)
        .catch(err => {
          logWithTimestamp(`缓存中未找到消息: ${url.pathname}`, err);
          return new Response(JSON.stringify({ error: 'offline', message: '离线状态下无法获取消息' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // 处理静态资源 - 缓存优先
  event.respondWith(
    fromCache(request, CACHE_NAME)
      .catch(() => {
        logWithTimestamp(`缓存中未找到: ${url.pathname}，尝试网络请求`);
        return fetchAndCache(request, CACHE_NAME);
      })
  );
});

// 从缓存中获取响应
function fromCache(request, cacheName) {
  return caches.open(cacheName)
    .then(cache => {
      return cache.match(request)
        .then(matching => {
          if (matching) {
            return matching;
          }
          throw new Error('没有匹配的缓存');
        });
    });
}

// 从网络获取并缓存
function fetchAndCache(request, cacheName) {
  return fetch(request.clone())
    .then(response => {
      // 只缓存成功的返回
      if (!response || response.status !== 200) {
        return response;
      }
      
      // 复制响应存入缓存
      const responseToCache = response.clone();
      caches.open(cacheName)
        .then(cache => {
          return cache.put(request, responseToCache);
        })
        .catch(err => {
          console.error('[SW] 缓存响应失败:', err);
        });
        
      return response;
    });
}

// 当Service Worker加载时发送初始消息
self.addEventListener('message', () => {
  logWithTimestamp('Service Worker已加载并开始运行');
}, { once: true });

// 发送一条初始消息到所有客户端
sendToAllClients({
  type: 'SW_LOADED',
  message: 'Service Worker已加载',
  timestamp: new Date().toISOString()
}).catch(err => {
  console.error('[SW] 初始通知发送失败:', err);
});

// 定期清理过期缓存
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'clear-old-caches') {
    event.waitUntil(
      caches.open(MESSAGE_CACHE_NAME).then(cache => {
        // 这里可以添加清理过期消息的逻辑
        logWithTimestamp('执行定期缓存清理');
      })
    );
  }
});

// 处理缓存消息请求
function handleCacheMessages(data, replyChannel) {
  const { messages, userId, chatWithUserId } = data;
  
  if (!messages || !Array.isArray(messages) || !userId || !chatWithUserId) {
    const errorMsg = '缓存消息参数无效';
    logWithTimestamp(errorMsg, data);
    
    try {
      if (replyChannel) {
        replyChannel.postMessage({
          type: 'CACHE_MESSAGES_ERROR',
          error: errorMsg,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[SW] 发送缓存错误响应失败:', err);
    }
    return;
  }
  
  logWithTimestamp(`处理消息缓存请求，用户 ${userId} 与 ${chatWithUserId} 的 ${messages.length} 条消息`);
  
  // 缓存消息到Cache Storage
  caches.open(MESSAGE_CACHE_NAME)
    .then(cache => {
      const url = `/chat-messages/${userId}-${chatWithUserId}`;
      const response = new Response(JSON.stringify(messages), {
        headers: { 'Content-Type': 'application/json' }
      });
      
      return cache.put(url, response);
    })
    .then(() => {
      logWithTimestamp(`成功缓存 ${messages.length} 条消息`);
      
      // 尝试回复成功消息
      try {
        if (replyChannel) {
          replyChannel.postMessage({
            type: 'CACHE_MESSAGES_RECEIVED',
            count: messages.length,
            userId,
            chatWithUserId,
            success: true,
            timestamp: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('[SW] 发送缓存成功响应失败:', err);
      }
      
      // 通知所有客户端
      return sendToAllClients({
        type: 'MESSAGES_CACHED',
        userId,
        chatWithUserId,
        count: messages.length,
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      logWithTimestamp('缓存消息失败:', error);
      
      try {
        if (replyChannel) {
          replyChannel.postMessage({
            type: 'CACHE_MESSAGES_ERROR',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('[SW] 发送缓存错误响应失败:', err);
      }
    });
}

// 处理清理缓存请求
function handleClearCache(replyChannel) {
  logWithTimestamp('处理清理缓存请求');
  
  Promise.all([
    caches.delete(CACHE_NAME),
    caches.delete(API_CACHE_NAME),
    caches.delete(MESSAGE_CACHE_NAME)
  ])
  .then(results => {
    const success = results.every(result => result);
    logWithTimestamp(`缓存清理${success ? '成功' : '部分失败'}`);
    
    try {
      if (replyChannel) {
        replyChannel.postMessage({
          type: 'CACHE_CLEARED',
          success,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[SW] 发送缓存清理响应失败:', err);
    }
  })
  .catch(error => {
    logWithTimestamp('清理缓存出错:', error);
    
    try {
      if (replyChannel) {
        replyChannel.postMessage({
          type: 'CACHE_CLEAR_ERROR',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[SW] 发送缓存清理错误响应失败:', err);
    }
  });
}

// 修改消息事件处理函数，添加新的处理逻辑
self.addEventListener('message', event => {
  // 简单记录接收到的消息
  const data = event.data;
  const messageType = data && data.type ? data.type : 'unknown';
  
  logWithTimestamp(`收到消息: ${messageType}`, data);
  
  // 获取消息源
  const client = event.source;
  const ports = event.ports;
  
  // 如果有消息端口，使用端口回复
  const replyChannel = ports && ports[0] ? ports[0] : client;
  
  // 如果可能，立即确认收到消息
  try {
    if (replyChannel) {
      replyChannel.postMessage({
        type: 'SW_MESSAGE_RECEIVED',
        originalType: messageType,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('[SW] 无法确认消息接收:', err);
  }
  
  // 根据消息类型处理
  if (data) {
    switch (data.type) {
      case 'TEST_MESSAGE':
      case 'HELLO_FROM_PAGE':
      case 'TEST_COMMUNICATION':
        // 测试类消息统一回复
        try {
          if (replyChannel) {
            replyChannel.postMessage({
              type: 'TEST_RESPONSE',
              originalType: data.type,
              message: '通信测试成功',
              timestamp: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error('[SW] 回复测试消息失败:', err);
        }
        break;
        
      case 'CACHE_MESSAGES':
        handleCacheMessages(data, replyChannel);
        break;
        
      case 'CLEAR_CACHE':
        handleClearCache(replyChannel);
        break;
        
      case 'DEBUG_REQUEST':
        handleDebugRequest(replyChannel);
        break;
        
      default:
        logWithTimestamp('收到未知类型消息:', data);
        try {
          if (replyChannel) {
            replyChannel.postMessage({
              type: 'UNKNOWN_MESSAGE_TYPE',
              originalType: data.type,
              timestamp: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error('[SW] 回复未知消息失败:', err);
        }
    }
  }
}); 