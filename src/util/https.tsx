import { extend, RequestOptionsInit, ResponseError } from 'umi-request';
import { Alert, Snackbar } from '@mui/material';
import React from 'react';
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

/**
 * 响应拦截器
 * 在接收到响应后对响应数据进行处理
 */
request.interceptors.response.use(async (response) => {
  const data = await response.clone().json();
  console.log('响应数据结构:', data);
  
  // 如果响应直接包含 token，说明是登录接口的返回
  if (data.token) {
    return {
      code: 200,
      data: data,
      message: '登录成功',
      success: true
    };
  }
  
  // 处理其他接口的返回
  if (!data.code) {
    return {
      code: 200,
      data: data,
      message: '操作成功',
      success: true
    };
  }
  
  // 处理标准格式的返回
  if (data.code !== 200) {
    showNotification(
      '请求失败',
      data.message || '未知错误',
      'error'
    );
    
    if (data.code === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    return Promise.reject(data);
  }
  
  return data;
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


export default request; // 确保这里是默认导出
