import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// 存储用户 ID 和 socket ID 的映射关系
const userSocketMap = new Map();

// 初始化 Socket.IO 服务器
const initSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ['http://localhost:8000', 'http://localhost:3006', '*'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // 中间件：验证用户身份
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token; // 从握手中获取 token
      if (!token) {
        return next(new Error('认证失败')); // 如果没有 token，认证失败
      }

      // 验证 token
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // 验证 JWT
      socket.userId = decoded.id; // 将用户 ID 存储在 socket 中
      
      // 更新用户状态为在线
      await User.findByIdAndUpdate(decoded.id, { 
        status: 'online', // 设置状态为在线
        lastActive: new Date() // 更新最后活动时间
      });
      
      next(); // 继续执行下一个中间件
    } catch (error) {
      return next(new Error('认证失败')); // 捕获错误并返回认证失败
    }
  });

  // 连接事件处理
  io.on('connection', async (socket) => {
    const userId = socket.userId; // 获取用户 ID
    console.log(`用户 ${userId} 已连接，Socket ID: ${socket.id}`); // 输出连接信息
    
    // 存储用户 ID 和 socket ID 的映射关系
    userSocketMap.set(userId, socket.id);
    
    // 广播用户上线状态
    socket.broadcast.emit('user_status_change', {
      userId,
      status: 'online' // 广播用户上线
    });

    // 断开连接事件处理
    socket.on('disconnect', async () => {
      console.log(`用户 ${userId} 已断开连接`); // 输出断开连接信息
      
      // 移除映射关系
      userSocketMap.delete(userId);
      
      // 更新用户状态为离线
      await User.findByIdAndUpdate(userId, { 
        status: 'offline', // 设置状态为离线
        lastActive: new Date() // 更新最后活动时间
      });
      
      // 广播用户离线状态
      socket.broadcast.emit('user_status_change', {
        userId,
        status: 'offline' // 广播用户离线
      });
    });

    // 手动设置状态事件处理
    socket.on('set_status', async ({ status }) => {
      if (!['online', 'offline', 'away'].includes(status)) {
        return; // 如果状态不在允许的范围内，返回
      }
      
      // 更新用户状态
      await User.findByIdAndUpdate(userId, { 
        status, // 更新状态
        lastActive: new Date() // 更新最后活动时间
      });
      
      // 广播用户状态变化
      socket.broadcast.emit('user_status_change', {
        userId,
        status // 广播状态变化
      });
    });
  });

  return io; // 返回 io 实例
};

// 获取用户的 socket
const getUserSocket = (userId) => {
  const socketId = userSocketMap.get(userId); // 获取 socket ID
  return socketId; // 返回 socket ID
};

export { initSocketServer, getUserSocket }; 