import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * 创建 axios 实例
 * 配置基础URL、超时时间和默认请求头
 */
const instance = axios.create({
  baseURL: process.env.API_URL || 'http://localhost:3006', // 根据环境设置基础URL
  timeout: 10000, // 请求超时时间
  headers: {
    'Content-Type': 'application/json', // 默认内容类型为JSON
  },
});

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

/**
 * 自定义错误处理函数
 * 处理HTTP请求过程中发生的错误
 * @param {any} error 错误对象
 * @returns {Promise<never>} 返回被拒绝的Promise
 */
const errorHandler = (error: any) => {
  const { response } = error;
  if (response && response.status) {
    const errorText = codeMessage[response.status] || response.statusText;
    const { status, url } = response;
    
    console.error(`请求错误 ${status}: ${url}`);
    console.error(errorText);
    
    // 401 未授权时跳转到登录页
    if (status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  } else if (!response) {
    console.error('网络异常，无法连接服务器');
  }
  
  return Promise.reject(error);
};

/**
 * 请求拦截器
 * 在发送请求前对请求配置进行处理
 */
instance.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token');
    
    // 如果有 token 就携带上
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('请求错误');
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 * 在接收到响应后对响应数据进行处理
 */
instance.interceptors.response.use(
  (response: AxiosResponse<ResponseData>) => {
    const res = response.data;
    
    // 根据自定义错误码判断请求是否成功
    if (res.code !== 200) {
      // 处理错误
      console.error(res.message || '请求失败');
      
      // 401: 未登录或 token 过期
      if (res.code === 401) {
        // 清除用户信息并跳转到登录页
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      
      return Promise.reject(new Error(res.message || '请求失败'));
    }
    
    // 请求成功直接返回数据部分
    return res.data;
  },
  (error: AxiosError) => {
    return errorHandler(error);
  }
);

/**
 * 封装 GET 请求
 * @template T 响应数据的类型
 * @param {string} url 请求地址
 * @param {any} [params] 请求参数
 * @param {AxiosRequestConfig} [config] 请求配置
 * @returns {Promise<T>} 返回Promise对象
 */
export function get<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> {
  return instance.get(url, { params, ...config });
}

/**
 * 封装 POST 请求
 * @template T 响应数据的类型
 * @param {string} url 请求地址
 * @param {any} [data] 请求体数据
 * @param {AxiosRequestConfig} [config] 请求配置
 * @returns {Promise<T>} 返回Promise对象
 */
export function post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return instance.post(url, data, config);
}

/**
 * 封装 PUT 请求
 * @template T 响应数据的类型
 * @param {string} url 请求地址
 * @param {any} [data] 请求体数据
 * @param {AxiosRequestConfig} [config] 请求配置
 * @returns {Promise<T>} 返回Promise对象
 */
export function put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return instance.put(url, data, config);
}

/**
 * 封装 DELETE 请求
 * @template T 响应数据的类型
 * @param {string} url 请求地址
 * @param {any} [params] 请求参数
 * @param {AxiosRequestConfig} [config] 请求配置
 * @returns {Promise<T>} 返回Promise对象
 */
export function del<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> {
  return instance.delete(url, { params, ...config });
}

/**
 * 导出默认请求实例
 * 可以直接使用此实例发起自定义请求
 */
export default instance;