import { extend, ResponseError } from 'umi-request';
import { Alert, Snackbar } from '@mui/material';
import { createRoot } from 'react-dom/client';

/**
 * 定义响应数据的通用接口
 * @template T 响应数据的类型
 * @property {number} code 状态码
 * @property {T} data 响应数据
 * @property {string} message 响应消息
 * @property {boolean} success 请求是否成功
 */
export interface ResponseData<T = any> {
  code: number;
  data: T;
  message: string;
  success: boolean;
}

/**
 * HTTP状态码对应的错误信息映射表
 * 用于在发生错误时提供友好的错误提示
 */
const codeMessage: Record<number, string> = {
  200: '服务器成功返回请求的数据。',
  201: '新建或修改数据成功。',
  202: '一个请求已经进入后台排队（异步任务）。',
  204: '删除数据成功。',
  400: '发出的请求有错误，服务器没有进行新建或修改数据的操作。',
  401: '用户没有权限（令牌、用户名、密码错误）。',
  403: '用户得到授权，但是访问是被禁止的。',
  404: '发出的请求针对的是不存在的记录，服务器没有进行操作。',
  406: '请求的格式不可得。',
  410: '请求的资源被永久删除，且不会再得到。',
  422: '当创建一个对象时，发生一个验证错误。',
  500: '服务器发生错误，请检查服务器。',
  502: '网关错误。',
  503: '服务不可用，服务器暂时过载或维护。',
  504: '网关超时。',
};

// 使用 MUI 的 Snackbar 显示通知
const showNotification = (message: string, description: string, severity: 'error' | 'warning' | 'info' | 'success' = 'error') => {
  // 创建一个容器用于挂载通知组件
  // 创建一个新的 div 元素作为通知的容器
  const container = document.createElement('div');
  // 将容器添加到文档的主体中
  document.body.appendChild(container);

  // 创建 React 18 的根节点，用于渲染通知组件
  const root = createRoot(container);

  // 定义关闭通知的逻辑
  const handleClose = () => {
    // 卸载根节点，移除容器
    root.unmount();
    container.remove();
  };

  // 使用现代 API 渲染 Snackbar 组件
  root.render(
    <Snackbar
      open={true} // 设置通知为打开状态
      autoHideDuration={6000} // 设置自动关闭的持续时间为6000毫秒
      onClose={handleClose} // 关闭时调用 handleClose 函数
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }} // 设置通知显示的位置
    >
      <Alert onClose={handleClose} severity={severity} sx={{ width: '100%' }}>
        {/* 显示通知的标题 */}
        <div style={{ fontWeight: 'bold' }}>{message}</div>
        {/* 显示通知的描述 */}
        <div>{description}</div>
      </Alert>
    </Snackbar>
  );
}

/**
 * 自定义错误处理函数
 * 处理HTTP请求过程中发生的错误
 * @param {ResponseError} error 错误对象
 * @returns {Promise<never>} 返回被拒绝的Promise
 */
// 自定义错误处理函数
// 处理HTTP请求过程中发生的错误
const errorHandler = (error: ResponseError) => {
  const { response } = error; // 获取响应对象
  
  // 检查响应是否存在且状态码有效
  if (response && response.status) {
    // 根据状态码获取对应的错误信息
    const errorText = codeMessage[response.status] || response.statusText;
    const { status, url } = response; // 获取状态码和请求的URL
    
    // 显示请求错误的通知
    showNotification(
      `请求错误 ${status}: ${url}`, // 通知标题
      errorText, // 通知描述
      'error' // 通知的严重性
    );
    
    // 401 未授权时跳转到登录页
    if (status === 401) {
      localStorage.removeItem('token'); // 移除本地存储的token
      window.location.href = '/login'; // 跳转到登录页面
    }
  } 
  
  return Promise.reject(error); // 返回被拒绝的Promise
};

/**
 * 创建默认配置的请求实例
 * 配置基础URL、超时时间和默认请求头
 */
const request = extend({
  prefix: process.env.API_URL || 'http://localhost:3006',
  timeout: 10000,
  errorHandler,
  credentials: 'include', // 默认携带 cookie
});

/**
 * 请求拦截器
 * 在发送请求前对请求配置进行处理
 */
// 请求拦截器
// 在发送请求前对请求配置进行处理
request.interceptors.request.use((url, options) => {
  // 从本地存储中获取token
  const token = localStorage.getItem('token');
  
  // 设置Authorization头部，如果token存在则使用Bearer模式
  const authHeader = { Authorization: token ? `Bearer ${token}` : '' };
  
  // 返回修改后的请求配置
  return {
    url,
    options: {
      ...options,
      headers: {
        ...options.headers,
        ...authHeader, // 将Authorization头部添加到请求头中
      },
    },
  };
});

// 添加刷新 token 的接口
export async function refreshToken(refreshTokenStr: string) {
  try {
    const response = await fetch(`${process.env.API_URL || 'http://localhost:3006'}/api/users/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: refreshTokenStr }),
    });
    
    if (!response.ok) {
      throw new Error('刷新token失败');
    }
    
    const data = await response.json();
    console.log('刷新token响应:', data);
    return data;
  } catch (error) {
    console.error('刷新token出错:', error);
    throw error;
  }
}

// 是否正在刷新 token，用于响应拦截器
let isRefreshing = false;
// 等待 token 刷新的请求队列
let refreshSubscribers: ((token: string) => void)[] = [];

// 将请求添加到队列
// cb 是回调函数，用于在 token 刷新后执行队列中的请求
const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

// 刷新 token 后执行队列中的请求
const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

/**
 * 响应拦截器
 * 在接收到响应后对响应数据进行处理
 */
request.interceptors.response.use(async (response) => {
  // 克隆响应以避免多次读取 body，因为响应流只能被读取一次，克隆后可以多次使用
  const res = response.clone();
  
  console.log('响应状态码:', res.status);
  
  // 检查响应状态码
  if (res.status === 401) {
    console.log('检测到401错误，尝试刷新token');
    
    // 获取原始请求的URL和选项
    const url = response.url;
    const options = {
      method: response.request?.method || 'GET',
      headers: {
        ...Object.fromEntries(response.clone().headers.entries())
      },
      body: response.request?.body
    };
    
    // 如果是刷新 token 的请求失败，则清除 token 并跳转到登录页
    if (url.includes('/refresh-token')) {
      console.log('刷新token请求失败');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
      return Promise.reject({ message: '刷新 token 失败，请重新登录' });
    }
    
    // 获取 refreshToken
    const refreshTokenStr = localStorage.getItem('refreshToken');
    if (!refreshTokenStr) {
      console.log('没有找到refreshToken，跳转到登录页');
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject({ message: '未找到刷新令牌，请重新登录' });
    }
    
    // 如果当前没有在刷新 token，则开始刷新
    if (!isRefreshing) {
      isRefreshing = true;
      console.log('开始刷新token');
      
      try {
        // 调用刷新 token 的接口
        const refreshRes = await refreshToken(refreshTokenStr);
        console.log('刷新token响应:', refreshRes);
        
        if (refreshRes && refreshRes.accessToken) {
          console.log('刷新token成功:', refreshRes);
          
          // 更新本地存储的 token
          const newToken = refreshRes.accessToken;
          localStorage.setItem('token', newToken);
          console.log('已更新token:', newToken);
          
          // 通知所有等待的请求
          onTokenRefreshed(newToken);
          
          // 重置刷新状态
          isRefreshing = false;
          
          // 使用新 token 重新发送原始请求
          console.log('使用新token重新发送请求');
          const newOptions = {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${newToken}`,
            },
          };
          
          // 返回重新发送的请求
          return request(url, newOptions);
        } else {
          // 刷新失败，清除 token 并跳转到登录页
          console.error('刷新token失败，响应不包含新token');
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          isRefreshing = false;
          return Promise.reject({ message: '刷新 token 失败，请重新登录' });
        }
      } catch (error) {
        // 刷新出错，清除 token 并跳转到登录页
        console.error('刷新token过程中出错:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        isRefreshing = false;
        return Promise.reject(error);
      }
    } else {
      // 如果已经在刷新 token，则将请求加入队列
      console.log('已有刷新token请求在进行中，将当前请求加入队列');
      return new Promise((resolve) => {
        subscribeTokenRefresh((token) => {
          const newOptions = {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${token}`,
            },
          };
          resolve(request(url, newOptions));
        });
      });
    }
  }
  
  // 处理正常响应
  try {
    // 尝试解析响应数据
    const data = await response.clone().json();
    
    // 如果响应中包含错误信息，则显示通知
    if (data && !data.success && data.message) {
      showNotification('请求错误', data.message, 'error');
    } else if (data && data.success && data.message) {
      // 成功响应包含消息时，显示成功通知
      showNotification('操作成功', data.message, 'success');
    }
    
    return response;
  } catch (error) {
    // 如果响应不是JSON格式，直接返回原始响应
    return response;
  }
});

// 自定义一个简单的类型，或者使用 any
interface CustomRequestConfig {
  errorConfig: {
    adaptor: (resData: any) => any; // 适配器函数
  };
  middlewares: Array<(ctx: any, next: () => Promise<void>) => Promise<void>>; // 中间件数组
  requestInterceptors: Array<(url: string, options: any) => { url: string; options: any }>; // 请求拦截器数组
  responseInterceptors: Array<(response: any) => any>; // 响应拦截器数组
}

// 更新 requestConfig 的类型
export const requestConfig: CustomRequestConfig = {
  errorConfig: {
    adaptor: (resData) => {
      return {
        ...resData,
        success: resData.code === 200, // 判断请求是否成功
        errorMessage: resData.message, // 错误信息
      };
    },
  },
  middlewares: [
    async (ctx, next) => {
      // 请求前处理
      await next(); // 继续执行下一个中间件
      // 请求后处理
    },
  ],
  requestInterceptors: [
    (url, options) => {
      return { url, options }; // 返回请求的url和options
    },
  ],
  responseInterceptors: [
    (response) => {
      return response; // 返回响应
    },
  ],
};

const token = localStorage.getItem('token');
console.log('toke2333n:', token);
// 首先，我们检查是否存在 token
if (token) {
  try {
    // 将 token 按照 '.' 分割，获取第二部分，这部分通常是 JWT 的负载部分
    const base64Url = token.split('.')[1];
    
    // 将 base64Url 中的字符进行替换，以符合 base64 的标准格式
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // 使用 atob 函数将 base64 字符串解码为原始字符串
    // 然后使用 decodeURIComponent 处理字符串中的编码
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    // 将解码后的 JSON 字符串解析为对象
    const payload = JSON.parse(jsonPayload);
    
    // 输出 token 的过期时间，乘以 1000 是因为 JavaScript 的时间戳是以毫秒为单位
    // exp 是 token 的过期时间，单位为秒。以下是 token 过期时间的输出。
    console.log('Token 过期时间:', new Date(payload.exp * 1000));
    
    // 输出当前时间
    console.log('当前时间:', new Date());
    
    // 计算并输出 token 剩余的有效时间（以秒为单位）
    console.log('剩余时间(秒):', payload.exp - Math.floor(Date.now() / 1000));
  } catch (error) {
    // 如果解析过程中发生错误，输出错误信息
    console.error('解析 token 失败:', error);
  }
}

export default request; // 确保这里是默认导出
