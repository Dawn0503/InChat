import { getUserSocket } from '../server.js';

// 发送消息通知
export const sendMessageNotification = (io, recipientId, message) => {
  if (!io) return;
  
  // 获取接收者的 socket
  const socketId = getUserSocket(recipientId);
  if (socketId) {
    io.to(socketId).emit('new_message', message);
  }
};

// 发送好友请求通知
export const sendFriendRequestNotification = (io, recipientId, request) => {
  if (!io) return;
  
  // 获取接收者的 socket
  const socketId = getUserSocket(recipientId);
  if (socketId) {
    io.to(socketId).emit('friend_request', request);
  }
};

// 发送好友请求响应通知
export const sendFriendRequestResponseNotification = (io, recipientId, response) => {
  if (!io) return;
  
  // 获取接收者的 socket
  const socketId = getUserSocket(recipientId);
  if (socketId) {
    io.to(socketId).emit('friend_request_response', response);
  }
};