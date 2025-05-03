// 定义缓存名称和版本
const CACHE_NAME = 'chat-app-cache-v1'; // 主缓存名称
const STATIC_CACHE = 'static-cache-v1'; // 静态资源缓存名称
const DATA_CACHE = 'data-cache-v1'; // 数据缓存名称

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/', // 网站根目录
  '/index.html', // 首页
  '/static/js/main.chunk.js', // 主 JavaScript 文件
  '/static/js/bundle.js', // 打包后的 JavaScript 文件
  '/static/css/main.chunk.css', // 主 CSS 文件
  // 添加其他需要缓存的静态资源
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
  // event.waitUntil 是一个用于指示 Service Worker 在安装或激活期间，直到传入的 Promise 完成后才会完成该事件的 API。
  // 这意味着在 Promise 完成之前，Service Worker 不会被激活或安装，从而确保所有的异步操作（如缓存静态资源）都能完成。
  event.waitUntil(
    Promise.all([
      // 缓存静态资源
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('缓存静态资源'); // 日志输出
        return cache.addAll(STATIC_ASSETS); // 将静态资源添加到缓存
      }),
      // 创建数据缓存
      caches.open(DATA_CACHE).then((cache) => {
        console.log('创建数据缓存'); // 日志输出
      }),
      self.skipWaiting() // 立即激活新的 Service Worker
    ])
  );
});

// 激活 Service Worker，清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧的缓存
          if (cacheName !== STATIC_CACHE && cacheName !== DATA_CACHE) {
            console.log('删除旧缓存:', cacheName); // 日志输出
            return caches.delete(cacheName); // 删除不再需要的缓存
          }
        })
      );
    // self.clients.claim() 用于使当前的 Service Worker 立即控制所有已打开的客户端。
    // 这意味着在 Service Worker 激活后，所有页面都将使用新的 Service Worker，而不需要重新加载页面。
    // 这样可以确保新的 Service Worker 能够立即接管并处理所有请求。
    }).then(() => self.clients.claim()) // 确保控制所有客户端
  );
});

// 拦截请求并处理
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url); // 获取请求的 URL
  
  // 处理 API 请求，特别关注消息相关的 API
  if (url.pathname.includes('/api/messages')) {
    // respondWith 是 Service Worker API 中的一个方法，用于拦截请求并提供自定义的响应。
    // 它允许开发者在处理请求时，选择返回网络响应、缓存响应或自定义响应。
    event.respondWith(
      // 使用网络优先策略，网络失败时回退到缓存
      networkFirstWithCache(event.request) // 调用网络优先策略
    );
  } 
  // 静态资源使用缓存优先策略
  else {
    event.respondWith(
      cacheFirstWithNetwork(event.request) // 调用缓存优先策略
    );
  }
});

// 网络优先获取策略，失败时使用缓存
async function networkFirstWithCache(request) {
  const cache = await caches.open(DATA_CACHE); // 打开数据缓存
  
  try {
    // 尝试从网络获取响应
    const networkResponse = await fetch(request.clone()); // 克隆请求以避免流被消耗
    if (networkResponse.ok) {
      // 网络响应成功，更新缓存
      cache.put(request, networkResponse.clone()); // 将网络响应存入缓存
      return networkResponse; // 返回网络响应
    }
    throw new Error('网络响应失败'); // 抛出错误
  } catch (error) {
    console.log('网络请求失败，尝试从缓存获取:', request.url); // 日志输出
    
    // 网络请求失败，尝试从缓存获取
    const cachedResponse = await cache.match(request); // 从缓存中匹配请求
    
    // 尝试使用更宽松的匹配方式查找缓存
    if (!cachedResponse) {
      // 提取URL中的关键参数
      const url = new URL(request.url);
      const params = new URLSearchParams(url.search);
      const sender = params.get('sender'); // 获取发送者参数
      const receiver = params.get('receiver'); // 获取接收者参数
      
      if (sender && receiver) {
        // 使用正则表达式进行更宽松的缓存匹配
        const cachedRequests = await cache.keys(); // 获取缓存中的所有请求
        for (const cachedRequest of cachedRequests) {
          // new URL API 用于解析和构造 URL 对象，方便获取 URL 的各个部分
          const cachedUrl = new URL(cachedRequest.url); // 解析缓存请求的 URL
          // new URLSearchParams API 用于处理 URL 查询参数，方便获取和操作查询字符串
          const cachedParams = new URLSearchParams(cachedUrl.search); // 解析 URL 中的查询参数
          const cachedSender = cachedParams.get('sender'); // 获取缓存请求的发送者
          const cachedReceiver = cachedParams.get('receiver'); // 获取缓存请求的接收者
          
          // 如果找到发送者和接收者匹配的缓存，无论顺序如何
          if ((cachedSender === sender && cachedReceiver === receiver) || 
              (cachedSender === receiver && cachedReceiver === sender)) {
            return await cache.match(cachedRequest); // 返回匹配的缓存响应
          }
        }
      }
    }
    
    // 如果没有找到缓存响应，返回一个空的 JSON 响应
    return cachedResponse || new Response(JSON.stringify([]), { 
      headers: { 'Content-Type': 'application/json' }, // 设置响应头
      status: 200 // 设置状态码
    });
  }
}

// 缓存优先获取策略
async function cacheFirstWithNetwork(request) {
  const cache = await caches.open(STATIC_CACHE); // 打开静态缓存
  const cachedResponse = await cache.match(request); // 使用缓存中的响应进行匹配
  
  if (cachedResponse) {
    return cachedResponse; // 如果缓存中有响应，直接返回
  }
  
  try {
    const networkResponse = await fetch(request); // 从网络获取响应
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone()); // clone 是为了避免流被消耗，确保可以多次使用网络响应
    }
    return networkResponse; // 返回网络响应
  } catch (error) {
    console.error('获取资源失败:', error); // 日志输出错误
    return new Response('网络错误', { status: 408 }); // 返回网络错误响应
  }
}

// 监听来自主线程的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_MESSAGES') {
    const { messages, userId, chatWithUserId } = event.data; // 解构消息数据
    cacheMessages(messages, userId, chatWithUserId); // 调用缓存消息的方法
  }
});

// 缓存消息的方法，确保更好的缓存命中率
async function cacheMessages(messages, userId, chatWithUserId) {
  if (!messages || !messages.length) return; // 如果没有消息，直接返回
  
  try {
    const cache = await caches.open(DATA_CACHE); // 打开数据缓存
    
    // 构建获取发送消息的请求对象
    const sentRequest = new Request(`/api/messages?sender=${userId}&receiver=${chatWithUserId}`);
    
    // 构建获取接收消息的请求对象
    const receivedRequest = new Request(`/api/messages?sender=${chatWithUserId}&receiver=${userId}`);
    
    // 构建带有更多查询参数的请求，以增加缓存命中率
    const allMessagesRequest = new Request(`/api/messages?conversation=${userId}_${chatWithUserId}`);
    
    // 筛选出发送的消息和接收的消息
    const sentMessages = messages.filter(msg => msg.sender === userId && msg.receiver === chatWithUserId);
    const receivedMessages = messages.filter(msg => msg.sender === chatWithUserId && msg.receiver === userId);
    
    // 创建响应对象并存入缓存
    const sentResponse = new Response(JSON.stringify(sentMessages), {
      headers: { 'Content-Type': 'application/json' } // 设置响应头
    });
    
    const receivedResponse = new Response(JSON.stringify(receivedMessages), {
      headers: { 'Content-Type': 'application/json' } // 设置响应头
    });
    
    const allMessagesResponse = new Response(JSON.stringify(messages), {
      headers: { 'Content-Type': 'application/json' } // 设置响应头
    });
    
    await cache.put(sentRequest, sentResponse.clone()); // 缓存发送消息的响应
    await cache.put(receivedRequest, receivedResponse.clone()); // 缓存接收消息的响应
    await cache.put(allMessagesRequest, allMessagesResponse.clone()); // 缓存所有消息的响应
    
    // 额外保存一个没有查询参数的版本，作为备用
    const baseRequest = new Request('/api/messages');
    await cache.put(baseRequest, allMessagesResponse); // 缓存基础请求的响应
    
    console.log('消息已缓存，会话:', userId, chatWithUserId, '消息数量:', messages.length); // 日志输出缓存信息
  } catch (error) {
    console.error('缓存消息失败:', error); // 日志输出错误
  }
} 