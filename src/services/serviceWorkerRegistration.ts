// 注册 Service Worker 的函数, 用于 index.tsx 中注册 Service Worker
export function registerServiceWorker() {
  // 检查浏览器是否支持 Service Worker
  // 检查浏览器是否支持 Service Worker
  // navigator 是一个全局对象，提供有关浏览器的各种信息和功能。
  // 这里通过检查 'serviceWorker' 属性来判断当前浏览器是否支持 Service Worker。
  if ('serviceWorker' in navigator) {
    // 当页面加载完成后执行
    window.addEventListener('load', () => {
      // 注册 Service Worker，传入 Service Worker 文件的路径
      // register 是一个用于注册 Service Worker 的 API，允许浏览器在后台运行脚本，以便处理网络请求、缓存资源等功能。
      navigator.serviceWorker.register('/serviceWorker.js')
        .then(registration => {
          // 注册成功后输出注册信息
          console.log('Service Worker 注册成功:', registration.scope);
        })
        .catch(error => {
          // 注册失败时输出错误信息
          console.error('Service Worker 注册失败:', error);
        });
    });
  }
}

// 注销 Service Worker 的函数
// export function unregisterServiceWorker() {
//   // 检查浏览器是否支持 Service Worker
//   if ('serviceWorker' in navigator) {
//     // 等待 Service Worker 准备就绪
//     navigator.serviceWorker.ready
//       .then(registration => {
//         // 注销 Service Worker
//         registration.unregister();
//       })
//       .catch(error => {
//         // 输出注销过程中的错误信息
//         console.error(error.message);
//       });
//   }
// }

// 增强缓存消息功能，确保能在刷新后离线时访问
//  chat 页面 cacheMessages(allMessages, currentUserId, chatWithUserId);
export function cacheMessages(messages: any[], userId: string, chatWithUserId: string) {
  // 检查浏览器是否支持 Service Worker
  if ('serviceWorker' in navigator) {
    // 检查 Service Worker 是否已激活
    // navigator.serviceWorker.controller 是当前页面控制的 Service Worker 实例。
    // 如果存在，表示 Service Worker 已经激活并可以处理消息。
    if (navigator.serviceWorker.controller) {
      console.log('通过 Service Worker 缓存消息');
      // 通过 Service Worker 发送消息，缓存聊天记录
      // postMessage 方法用于向 Service Worker 发送消息，这里用于缓存聊天记录。
      // 虽然 postMessage 通常用于跨窗口通信
      // 但在这里它也用于主线程与 Service Worker 之间的通信。
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_MESSAGES', // 消息类型
        messages, // 要缓存的消息
        userId, // 当前用户 ID
        chatWithUserId // 聊天对象的用户 ID
      });
    } else {
      // 如果 Service Worker 还未激活，等待激活后再缓存
      console.log('等待 Service Worker 激活后缓存消息');
      navigator.serviceWorker.ready.then(registration => {
        // 确保 Service Worker 已激活
        const messageInterval = setInterval(() => {
          // 检查 Service Worker 是否已激活
          if (navigator.serviceWorker.controller) {
            clearInterval(messageInterval); // 清除定时器
            // 通过 Service Worker 发送消息，缓存聊天记录
            navigator.serviceWorker.controller.postMessage({
              type: 'CACHE_MESSAGES',
              messages,
              userId,
              chatWithUserId
            });
          }
        }, 500); // 每 500 毫秒检查一次
        
        // 设置超时，避免无限等待
        setTimeout(() => clearInterval(messageInterval), 10000); // 10 秒后停止检查
      });
    }
    
    // 同时在 IndexedDB 或 localStorage 中保存一份，作为备用
    try {
      // 将消息保存到本地存储
      localStorage.setItem(`chat_${userId}_${chatWithUserId}`, JSON.stringify(messages));
    } catch (e) {
      // 输出保存到本地存储失败的错误信息
      console.error('保存到本地存储失败:', e);
    }
  }
}

// 从本地存储获取缓存的消息， chat 页面：getLocalCachedMessages(currentUserId, chatWithUserId);
export function getLocalCachedMessages(userId: string, chatWithUserId: string): any[] {
  try {
    // 从本地存储中获取缓存的消息
    const cached = localStorage.getItem(`chat_${userId}_${chatWithUserId}`);
    // 如果缓存存在，则解析并返回消息，否则返回空数组
    // JSON.parse 是一个用于将 JSON 字符串转换为 JavaScript 对象的方法
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    // 输出从本地存储获取缓存消息失败的错误信息
    console.error('从本地存储获取缓存消息失败:', e);
    return []; // 返回空数组
  }
}

// 检查网络连接状态，在 chat 页面中判断获取信息的方式
export function isOnline(): boolean {
  // 返回浏览器的在线状态
  return navigator.onLine;
}

// 监听网络状态变化  用于 chat 页面的处理网络状态变化
/**
 * 设置网络状态监听器
 * @param onlineCallback - 当网络状态变为在线时调用的回调函数
 * @param offlineCallback - 当网络状态变为离线时调用的回调函数
 * 
 * 这两个回调函数用于处理网络状态变化的事件，分别在用户的网络连接恢复或断开时被触发。
 * 这些回调函数不是自带的 API，而是由开发者定义的，用于在网络状态变化时执行特定的逻辑。
 */
export function setupNetworkListeners(onlineCallback: () => void, offlineCallback: () => void) {
  // 添加在线状态变化的监听器
  window.addEventListener('online', onlineCallback);
  // 添加离线状态变化的监听器
  window.addEventListener('offline', offlineCallback);
  
  // 返回一个函数，用于移除监听器
  return () => {
    window.removeEventListener('online', onlineCallback);
    window.removeEventListener('offline', offlineCallback);
  };
} 