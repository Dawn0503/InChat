import request from '@/util/https';
import { ResponseData } from '@/util/https';

// 用户接口
export interface User {
  _id: string;
  username: string;
  avatar: string;
  createdAt?: string;
  relationship?: string;
}

// 好友接口
export interface Friend {
  id: string;
  username: string;
  avatar: string;
  friendshipId: string;
}

// 好友请求接口
export interface FriendRequest {
  id: string;
  requester: {
    id: string;
    username: string;
    avatar: string;
  };
  createdAt: string;
}

// 好友关系状态
export interface Friendship {
  _id: string;
  requester: string;
  recipient: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

/**
 * 获取所有平台用户
 * @returns 返回除当前用户外的所有用户列表
 */
export async function getAllUsersAPI() {
  return request<ResponseData<User[]>>('/api/users/all', {
    method: 'GET'
  });
}

/**
 * 获取用户详情
 * @param userId 用户ID
 * @returns 返回用户详细信息
 */
export async function getUserDetailAPI(userId: string) {
  return request<ResponseData<User>>(`/api/users/${userId}`, {
    method: 'GET'
  });
}

/**
 * 搜索用户
 * @param keyword 搜索关键词
 * @returns 返回匹配的用户列表
 */
export async function searchUsersAPI(keyword: string) {
  return request<ResponseData<User[]>>('/api/users/search', {
    method: 'GET',
    params: { keyword }
  });
}

/**
 * 发送好友请求
 * @param recipientId 接收者ID
 * @returns 返回创建的好友请求信息
 */
export async function sendFriendRequestAPI(recipientId: string) {
  return request<ResponseData<Friendship>>('/api/friends/request', {
    method: 'POST',
    data: { recipientId }
  });
}

/**
 * 接受好友请求
 * @param requestId 好友请求ID
 * @returns 返回更新后的好友关系
 */
export async function acceptFriendRequestAPI(requestId: string) {
  return request<ResponseData<Friendship>>(`/api/friends/accept/${requestId}`, {
    method: 'PUT'
  });
}

/**
 * 拒绝好友请求
 * @param requestId 好友请求ID
 * @returns 返回更新后的好友关系
 */
export async function rejectFriendRequestAPI(requestId: string) {
  return request<ResponseData<Friendship>>(`/api/friends/reject/${requestId}`, {
    method: 'PUT'
  });
}

/**
 * 获取好友列表
 * @returns 返回当前用户的所有好友
 */
export async function getFriendsAPI() {
  return request<ResponseData<Friend[]>>('/api/friends', {
    method: 'GET'
  });
}

/**
 * 获取待处理的好友请求
 * @returns 返回当前用户收到的所有待处理好友请求
 */
export async function getPendingFriendRequestsAPI() {
  return request<ResponseData<FriendRequest[]>>('/api/friends/pending', {
    method: 'GET'
  });
}

/**
 * 删除好友
 * @param friendId 好友ID
 * @returns 返回删除结果
 */
export async function deleteFriendAPI(friendId: string) {
  return request<ResponseData<{ message: string }>>(`/api/friends/${friendId}`, {
    method: 'DELETE'
  });
}











