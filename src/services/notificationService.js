import { getUserSocket } from '../server.js';

// 发送消息通知
export const sendMessageNotification = (io, recipientId, message) => {
  if (!io) return;
  
  // 获取接收者的 socket
  const socketId = getUserSocket(recipientId);
  if (socketId) {
    // io.to(socketId) 是用来指定要发送消息的目标 socket，socketId 是接收者的 socket ID。
    // emit('new_message', message) 是用来触发一个名为 'new_message' 的事件，并将 message 作为数据发送给接收者。
    // 这样，接收者就能通过监听 'new_message' 事件来处理收到的消息。
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