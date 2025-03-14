import request from '@/util/https';
import { ResponseData } from '@/util/https';

// 定义登录接口返回的数据类型
interface LoginResponse {
  token: string;
  user?: {
    // id: string;
    username: string;
  };
}

/**
 * 登录API
 * @param username 用户名
 * @param password 密码
 * @returns 返回包含token和用户信息的响应
 */
export async function loginAPI(username: string, password: string) {
  return request<ResponseData<LoginResponse>>('/api/users/login', {
    method: 'POST',
    data: {
      username,
      password
    }
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
 