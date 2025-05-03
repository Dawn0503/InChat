import request from '@/util/https';
import { ResponseData } from '@/util/https';

// 定义登录接口返回的数据类型
export interface LoginResponse {
  accessToken?: string; // 可选字段
  token?: string;       // 可选字段，某些后端API可能使用token替代accessToken
  refreshToken?: string; // 可选字段
  user?: {
    id: string;
    username: string;
    avatar: string;
    status: string;
  };
}

// 定义注册接口返回的数据类型
export interface RegisterResponse {
  message: string;
  userId: string;
}

/**
 * 登录API
 * @param username 用户名
 * @param password 密码
 * @returns 返回包含 token 和用户信息的响应
 */
export async function loginAPI(username: string, password: string) {
  return request<ResponseData<LoginResponse>>('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }), // 将 username 和 password 放入 body 中
    headers: {
      'Content-Type': 'application/json', // 设置请求头，指明请求体的格式
    },
  });
}

/**
 * 注册API
 * @param username 用户名
 * @param password 密码
 * @returns 返回包含用户ID的响应
 */
export async function registerAPI(username: string, password: string) {
  return request<ResponseData<RegisterResponse>>('/api/users/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * 退出登录API
 * @returns 返回退出登录的响应
 */
export async function logoutAPI() {
  return request<ResponseData<null>>('/api/users/logout', {
    method: 'POST'
  });
}
 