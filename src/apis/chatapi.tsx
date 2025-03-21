import request from '@/util/https';

// 消息类型定义
export interface Message {
  id: string;
  sender: string;
  receiver: string;
  content: string;
  createdAt: string;
}

// 发送消息请求参数
interface SendMessageParams {
  receiver: string;
  content: string;
}

// 发送消息响应
interface SendMessageResponse {
  message: string;
  messageId: string;
}

// 获取消息列表参数
interface GetMessagesParams {
  sender?: string;
  receiver?: string;
}

// 用户状态类型定义
export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

// 更新用户状态请求参数
interface UpdateUserStatusParams {
  status: UserStatus;
  customStatus?: string;
}

// 更新用户状态响应
interface UpdateUserStatusResponse {
  message: string;
  status: UserStatus;
}

// 发送输入状态请求参数
interface SendTypingStatusParams {
  targetUserId: string;
  isTyping: boolean;
}

// 发送输入状态响应
interface SendTypingStatusResponse {
  message: string;
}

// 用户状态信息
export interface UserStatusInfo {
  userId: string;
  status: UserStatus;
  customStatus?: string;
  lastActive?: string;
  isTypingToYou?: boolean;
}

// 标准API响应结构
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
  success: boolean;
}

/**
 * 发送消息
 * @param params 消息参数，包含接收者ID和消息内容
 * @returns 发送结果
 */
export async function sendMessageAPI(params: SendMessageParams) {
  return request<SendMessageResponse>('/api/messages', {
    method: 'POST',
    data: params
  });
}

/**
 * 获取消息列表
 * @param params 可选的查询参数，包括发送者ID和接收者ID
 * @returns 消息列表
 */
export async function getMessagesAPI(params?: GetMessagesParams) {
  return request<Message[]>('/api/messages', {
    method: 'GET',
    params
  });
}

/**
 * 更新当前用户状态
 * @param params 状态参数，包含状态类型和可选的自定义状态消息
 * @returns 更新结果
 */
export async function updateUserStatusAPI(params: UpdateUserStatusParams) {
  return request<UpdateUserStatusResponse>('/api/users/status', {
    method: 'PUT',
    data: params
  });
}

/**
 * 发送正在输入状态
 * @param params 包含目标用户ID和是否正在输入的状态
 * @returns 发送结果
 */
export async function sendTypingStatusAPI(params: SendTypingStatusParams) {
  return request<SendTypingStatusResponse>('/api/users/typing', {
    method: 'POST',
    data: params
  });
}

/**
 * 获取指定用户的状态信息
 * @param userId 要查询的用户ID
 * @returns 用户状态信息
 */
export async function getUserStatusAPI(userId: string) {
  return request<ApiResponse<UserStatusInfo>>(`/api/users/${userId}/status`, {
    method: 'GET'
  });
}
