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
