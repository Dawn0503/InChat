// 注册 Service Worker 的函数, 用于 index.tsx 中注册 Service Worker
export function registerServiceWorker() {
  console.log('调用了registerServiceWorker函数');
  
  if ('serviceWorker' in navigator) {
    console.log('浏览器支持 Service Worker');
    
    // 高级消息日志函数
    const logSWMessage = (source: string, type: string, data: any): void => {
      const timestamp = new Date().toISOString();
      const message = `[${timestamp}] ${source}: ${type} - ${JSON.stringify(data)}`;
      console.log('%c' + message, 'color: #0066cc; font-weight: bold;');
    };
    
    // 全局消息处理器
    const messageHandler = (event: MessageEvent): void => {
      const data = event.data;
      if (!data) return;
      
      logSWMessage('SW→主线程', data.type, data);
      
      // 根据消息类型处理
      switch (data.type) {
        case 'SW_LOADED':
          console.log('确认Service Worker已加载:', data.message);
          break;
        
        case 'SW_ACTIVATED':
          console.log('确认Service Worker已激活:', data.message);
          break;
          
        case 'SW_MESSAGE_RECEIVED':
          console.log('Service Worker确认收到消息:', data.originalMessage);
          break;
          
        case 'CACHE_MESSAGES_RECEIVED':
          console.log('收到Service Worker缓存确认:', data);
          // 触发自定义事件，通知应用其他部分
          window.dispatchEvent(new CustomEvent('sw-cache-complete', { 
            detail: data 
          }));
          break;
          
        case 'CACHE_MESSAGES_ERROR':
          console.error('Service Worker缓存消息失败:', data.error);
          break;
          
        case 'SW_LOG':
          console.log(`Service Worker日志: ${data.message}`, data.data);
          break;
          
        default:
          console.log('收到未知类型的Service Worker消息:', data);
      }
    };
    
    // 移除旧的监听器（如果存在）
    if (window._swMessageListener) {
      navigator.serviceWorker.removeEventListener('message', window._swMessageListener);
    }
    
    // 保存新的监听器引用
    window._swMessageListener = messageHandler;
    
    // 监听来自Service Worker的消息
    navigator.serviceWorker.addEventListener('message', messageHandler);
    
    // 检查是否已存在控制页面的Service Worker
    if (navigator.serviceWorker.controller) {
      console.log('页面已被Service Worker控制:', navigator.serviceWorker.controller);
      
      // 向现有Service Worker发送问候
      navigator.serviceWorker.controller.postMessage({
        type: 'HELLO_FROM_PAGE',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('页面当前未被Service Worker控制');
    }
    
    // 当页面加载完成后执行
    window.addEventListener('load', () => {
      console.log('页面加载完成，准备注册 Service Worker');
      
      // 使用正确的Service Worker路径
      // 确保路径是绝对的，并且以/开头
      const swPath = '/simple-sw.js';
      
      console.log('使用Service Worker路径:', swPath);
      
      // 检查Service Worker文件是否可访问
      fetch(swPath)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Service Worker文件不可访问: ${response.status} ${response.statusText}`);
          }
          console.log('Service Worker文件可访问，状态:', response.status);
          
          // 注册 Service Worker
          return navigator.serviceWorker.register(swPath, {
            scope: '/'  // 明确指定scope为根目录
          });
        })
        .then(registration => {
          // 注册成功后输出注册信息
          console.log('Service Worker 注册成功:', registration.scope);
          
          // 监听 Service Worker 状态变化
          if (registration.installing) {
            const sw = registration.installing;
            sw.addEventListener('statechange', () => {
              console.log('Service Worker 状态变化:', sw.state);
              
              // 如果Service Worker已激活，尝试发送测试消息
              if (sw.state === 'activated') {
                console.log('Service Worker已激活，发送测试消息');
                if (navigator.serviceWorker.controller) {
                  try {
                    navigator.serviceWorker.controller.postMessage({
                      type: 'TEST_MESSAGE',
                      message: '这是一条测试消息',
                      time: new Date().toISOString()
                    });
                  } catch (err) {
                    console.error('发送测试消息失败:', err);
                  }
                }
              }
            });
          }
          
          // 检查当前状态
          if (registration.installing) {
            console.log('Service Worker 正在安装');
          } else if (registration.waiting) {
            console.log('Service Worker 等待激活');
          } else if (registration.active) {
            console.log('Service Worker 已激活');
            
            // 如果Service Worker已激活，尝试发送测试消息
            if (navigator.serviceWorker.controller) {
              console.log('Service Worker已激活并控制页面，发送测试消息');
              try {
                navigator.serviceWorker.controller.postMessage({
                  type: 'TEST_MESSAGE',
                  message: '这是一条测试消息',
                  time: new Date().toISOString()
                });
              } catch (err) {
                console.error('发送测试消息失败:', err);
              }
            }
          }
          
          // 监听更新事件
          registration.addEventListener('updatefound', () => {
            console.log('发现Service Worker更新');
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                console.log('更新的Service Worker状态变化:', newWorker.state);
              });
            }
          });
        })
        .catch(error => {
          // 注册失败时输出详细错误信息
          console.error('Service Worker 注册失败:', error);
          console.error('错误详情:', error.message);
          console.error('错误堆栈:', error.stack);
          
          // 尝试使用备用方法注册
          console.log('尝试使用备用方法注册Service Worker...');
          navigator.serviceWorker.register(swPath)
            .then(reg => console.log('备用方法注册成功:', reg.scope))
            .catch(err => console.error('备用方法也失败:', err));
        });
        
      // 检查当前是否有控制页面的service worker
      if (navigator.serviceWorker.controller) {
        console.log('页面当前由Service Worker控制');
      } else {
        console.log('页面当前未由Service Worker控制');
      }
      
      // 监听控制权变化
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('页面控制权已转移到新的Service Worker');
        
        // 发送测试消息
        if (navigator.serviceWorker.controller) {
          console.log('控制权变化后发送测试消息');
          try {
            navigator.serviceWorker.controller.postMessage({
              type: 'CONTROLLER_CHANGED',
              message: '控制权已变更',
              time: new Date().toISOString()
            });
          } catch (err) {
            console.error('发送控制权变化消息失败:', err);
          }
        }
      });
    });
  } else {
    console.log('浏览器不支持 Service Worker');
  }

  // 延迟3秒后执行诊断，确保有足够时间注册和激活
  setTimeout(() => {
    console.log('执行Service Worker诊断...');
    debugServiceWorker();
  }, 3000);
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
    console.log('尝试缓存消息，消息数量:', messages.length);
    
    // 先保存到本地存储作为备用
    try {
      // 将消息保存到本地存储
      localStorage.setItem(`chat_${userId}_${chatWithUserId}`, JSON.stringify(messages));
      console.log('消息已成功保存到本地存储作为备份');
    } catch (e) {
      // 输出保存到本地存储失败的错误信息
      console.error('保存到本地存储失败:', e);
    }
    
    // 创建缓存消息的包
    const messagePackage = {
      type: 'CACHE_MESSAGES',
      messages,
      userId,
      chatWithUserId,
      timestamp: new Date().toISOString()
    };
    
    console.log('尝试通过所有可能的方式发送缓存消息...');
    
    let messageSent = false;
    
    // 1. 通过controller发送(如果存在)
    if (navigator.serviceWorker.controller) {
      console.log('通过controller发送缓存消息');
      try {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
          console.log('收到缓存确认回复:', event.data);
        };
        
        navigator.serviceWorker.controller.postMessage(messagePackage, [messageChannel.port2]);
        console.log('通过controller发送缓存消息成功');
        messageSent = true;
      } catch (error) {
        console.error('通过controller发送缓存消息失败:', error);
        
        // 尝试不使用MessageChannel发送
        try {
          navigator.serviceWorker.controller.postMessage(messagePackage);
          console.log('通过常规方式发送缓存消息成功');
          messageSent = true;
        } catch (err) {
          console.error('通过常规方式发送也失败:', err);
        }
      }
    } else {
      console.log('没有活动的Service Worker controller');
    }
    
    // 2. 获取所有已注册的Service Worker并发送消息
    navigator.serviceWorker.getRegistrations().then(registrations => {
      console.log(`找到 ${registrations.length} 个Service Worker注册`);
      
      if (registrations.length > 0 && !messageSent) {
        console.log(`尝试发送缓存请求到 ${registrations.length} 个Service Worker`);
        
        let workerMessageSent = false;
        
        registrations.forEach((registration, index) => {
          // 找出激活的Service Worker
          const activeWorker = registration.active;
          
          if (activeWorker) {
            console.log(`向Service Worker ${index+1} (${registration.scope}) 发送缓存消息`);
            try {
              // 直接向worker发送消息
              activeWorker.postMessage(messagePackage);
              console.log(`向 ${registration.scope} 发送缓存消息成功`);
              workerMessageSent = true;
            } catch (error) {
              console.error(`向 ${registration.scope} 发送消息失败:`, error);
            }
          } else {
            console.log(`Service Worker ${index+1} 没有激活的worker`);
          }
        });
        
        if (!workerMessageSent) {
          console.warn('未能发送缓存消息到任何Service Worker，仅使用localStorage备份');
          // 尝试注册一个新的Service Worker
          if (!messageSent) {
            registerFallbackServiceWorker(userId, chatWithUserId, messages);
          }
        } else {
          console.log('消息缓存已尝试通过Service Worker保存');
        }
      } else if (!messageSent) {
        console.warn('没有找到已激活的Service Worker');
        registerFallbackServiceWorker(userId, chatWithUserId, messages);
      }
    }).catch(error => {
      console.error('获取Service Worker注册列表失败:', error);
      if (!messageSent) {
        registerFallbackServiceWorker(userId, chatWithUserId, messages);
      }
    });
  } else {
    console.log('浏览器不支持 Service Worker，无法缓存消息');
  }
}

// 注册一个后备的Service Worker
function registerFallbackServiceWorker(userId: string, chatWithUserId: string, messages: any[]) {
  console.log('正在注册一个后备Service Worker...');
  
  navigator.serviceWorker.register('/simple-sw.js')
    .then(registration => {
      console.log('后备Service Worker注册成功:', registration.scope);
      
      // 等待激活
      if (registration.active) {
        sendMessageToServiceWorker(registration.active, userId, chatWithUserId, messages);
      } else if (registration.installing) {
        registration.installing.addEventListener('statechange', event => {
          // @ts-ignore
          if (event.target.state === 'activated') {
            console.log('后备Service Worker已激活');
            sendMessageToServiceWorker(registration.active!, userId, chatWithUserId, messages);
          }
        });
      }
    })
    .catch(error => {
      console.error('后备Service Worker注册失败:', error);
    });
}

// 向Service Worker发送消息
function sendMessageToServiceWorker(worker: ServiceWorker, userId: string, chatWithUserId: string, messages: any[]) {
  try {
    worker.postMessage({
      type: 'CACHE_MESSAGES',
      messages,
      userId,
      chatWithUserId,
      timestamp: new Date().toISOString()
    });
    console.log('已向后备Service Worker发送缓存消息');
  } catch (error) {
    console.error('向后备Service Worker发送消息失败:', error);
  }
}

// 添加到Window类型
declare global {
  interface Window {
    _swMessageListener?: (event: MessageEvent) => void;
  }
}

// 从本地存储获取缓存的消息， chat 页面：getLocalCachedMessages(currentUserId, chatWithUserId);
export function getLocalCachedMessages(userId: string, chatWithUserId: string): any[] {
  try {
    // 优先尝试从Service Worker缓存获取
    const cached = localStorage.getItem(`chat_${userId}_${chatWithUserId}`);
    if (cached) {
      console.log(`从本地存储获取到 ${JSON.parse(cached).length} 条消息`);
      return JSON.parse(cached);
    }
    return [];
  } catch (e) {
    console.error('获取缓存消息失败:', e);
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

// 新增：检查Service Worker状态的函数
export function checkServiceWorkerStatus(): {isSupported: boolean, isRegistered: boolean, isActive: boolean} {
  const status = {
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isActive: false
  };
  
  console.log('Service Worker 支持状态:', status.isSupported);
  
  if (status.isSupported) {
    // 检查是否已控制页面（已激活）
    status.isActive = !!navigator.serviceWorker.controller;
    console.log('Service Worker 是否已激活控制页面:', status.isActive);
    
    // 检查是否已注册
    navigator.serviceWorker.getRegistration().then(reg => {
      status.isRegistered = !!reg;
      console.log('Service Worker 是否已注册:', status.isRegistered);
      
      if (reg) {
        console.log('Service Worker 注册范围:', reg.scope);
        console.log('Service Worker 状态:',
          reg.installing ? '安装中' : 
          reg.waiting ? '等待激活' : 
          reg.active ? '已激活' : '未知'
        );
      }
    });
  }
  
  return status;
}

// 暴露一个直接调用用于测试的函数
export function debugServiceWorker() {
  console.log('======= Service Worker 调试信息 =======');
  const status = checkServiceWorkerStatus();
  
  // 检查serviceWorker.js文件是否可访问
  fetch('/simple-sw.js')
    .then(response => {
      console.log('simple-sw.js 访问状态:', response.status, response.statusText);
      if (!response.ok) {
        throw new Error(`无法访问Service Worker文件: ${response.status}`);
      }
      return response.text();
    })
    .then(text => {
      console.log('simple-sw.js 文件大小:', text.length, '字节');
      if (text.length === 0) {
        console.error('服务工作器文件为空！');
      } else {
        console.log('服务工作器文件内容预览:', text.substring(0, 100) + '...');
      }
    })
    .catch(error => {
      console.error('simple-sw.js 访问失败:', error);
      
      // 尝试其他可能的路径
      console.log('尝试其他可能的路径...');
      const origin = window.location.origin;
      fetch(`${origin}/simple-sw.js`)
        .then(response => {
          console.log('从完整URL访问结果:', response.status, response.statusText);
        })
        .catch(e => console.error('完整URL访问也失败:', e));
        
      fetch(`/public/simple-sw.js`)
        .then(response => {
          console.log('从/public路径访问结果:', response.status, response.statusText);
        })
        .catch(e => console.error('/public路径访问也失败:', e));
    });
    
  // 主动尝试注册Service Worker
  try {
    if (status.isSupported && !status.isRegistered) {
      console.log('尝试主动注册Service Worker...');
      navigator.serviceWorker.register('/simple-sw.js')
        .then(registration => {
          console.log('主动注册Service Worker成功:', registration.scope);
        })
        .catch(error => {
          console.error('主动注册Service Worker失败:', error);
        });
    }
  } catch (e) {
    console.error('注册Service Worker时出错:', e);
  }
  
  // 检查Service Worker是否响应
  if (navigator.serviceWorker.controller) {
    console.log('尝试与Service Worker通信...');
    try {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        console.log('收到Service Worker响应:', event.data);
      };
      
      navigator.serviceWorker.controller.postMessage({
        type: 'DEBUG_REQUEST',
        timestamp: new Date().toISOString()
      }, [messageChannel.port2]);
    } catch (err) {
      console.error('与Service Worker通信失败:', err);
    }
  }
}

// 添加一个函数，手动请求Service Worker清理缓存
export function clearServiceWorkerCache() {
  if ('serviceWorker' in navigator) {
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      console.log('请求Service Worker清理缓存');
      controller.postMessage({
        type: 'CLEAR_CACHE',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('没有活动的Service Worker控制器');
    }
  }
}

// 添加一个函数，验证与Service Worker的通信
export function testServiceWorkerCommunication() {
  if ('serviceWorker' in navigator) {
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      console.log('发送测试消息到Service Worker');
      
      // 发送消息并等待回复
      const messageChannel = new MessageChannel();
      
      return new Promise((resolve, reject) => {
        // 设置接收消息的处理程序
        messageChannel.port1.onmessage = event => {
          if (event.data && event.data.type === 'TEST_RESPONSE') {
            console.log('收到Service Worker测试回复:', event.data);
            resolve(true);
          } else {
            reject(new Error('收到意外的回复'));
          }
        };
        
        // 设置超时
        const timeout = setTimeout(() => {
          reject(new Error('Service Worker通信测试超时'));
        }, 3000);
        
        try {
          // 发送消息
          controller.postMessage(
            { type: 'TEST_COMMUNICATION', timestamp: Date.now() },
            [messageChannel.port2]
          );
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    }
  }
  
  return Promise.reject(new Error('Service Worker不可用'));
} 