// 导入 http 模块，用于创建 HTTP 服务器
import http from 'http';
// 导入应用程序实例
import app from './app.js';
// 导入 jwt 用于验证 token
import jwt from 'jsonwebtoken';
// 导入 User 模型
import User from './models/User.js';
// 导入 Socket.io 服务器
import { Server } from 'socket.io';
// 导入 express
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import protobufjs from 'protobufjs';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 Protobuf 定义
let root;
let HeartbeatMessage;

async function loadProtobuf() {
  try {
    const protoPath = path.join(__dirname, 'config', 'message.proto');
    console.log('加载 Protobuf 文件:', protoPath);
    
    if (!fs.existsSync(protoPath)) {
      console.error('Protobuf 文件不存在:', protoPath);
      return false;
    }
    
    root = await protobufjs.load(protoPath);
    HeartbeatMessage = root.lookupType('HeartbeatMessage');
    console.log('Protobuf 定义加载成功');
    return true;
  } catch (error) {
    console.error('Protobuf 定义加载失败:', error);
    return false;
  }
}

// 设置服务器端口，优先使用环境变量中的 PORT，默认为 3006
const PORT = process.env.PORT || 3006;

// 创建 HTTP 服务器，并将应用程序传入
const server = http.createServer(app);

// 存储用户 ID 和 socket ID 的映射关系
const userSocketMap = new Map();

// 创建 Socket.IO 服务器
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  path: '/socket.io'
});

// 在 Socket.IO 连接处理前加载 Protobuf
await loadProtobuf();

// 添加 Socket.IO 中间件
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('认证失败'));
    }

    // 验证 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;

    // 更新用户状态为在线
    await User.findByIdAndUpdate(decoded.id, {
      status: 'online',
      lastActive: new Date()
    });

    next();
  } catch (error) {
    return next(new Error('认证失败'));
  }
});

// 添加用户最后心跳时间记录
const userLastHeartbeat = new Map();

// 监听 Socket.io 连接事件
io.on('connection', async (socket) => {
  const userId = socket.userId;
  console.log(`用户 ${userId} 已连接，Socket ID: ${socket.id}`);

  // 存储用户 ID 和 socket ID 的映射关系
  userSocketMap.set(userId, socket.id);

  // 广播用户上线状态
  socket.broadcast.emit('user_status_change', {
    userId,
    status: 'online'
  });
  //------------------

  // 处理心跳包
  socket.on('heartbeat', (data) => {
    try {
      const now = Date.now();
      const lastHeartbeatTime = userLastHeartbeat.get(userId) || 0;
      
      // 如果两次心跳间隔小于5秒，则忽略
      if (now - lastHeartbeatTime < 5000) {
        console.log(`忽略用户 ${userId} 的频繁心跳请求，间隔: ${now - lastHeartbeatTime}ms`);
        return;
      }
      
      // 更新最后心跳时间
      userLastHeartbeat.set(userId, now);
      
      console.log(`收到用户 ${userId} 的心跳数据:`, typeof data);
      
      let heartbeatData;
      
      // 尝试解析 Protobuf 数据
      if (HeartbeatMessage && (data instanceof Buffer || data instanceof Uint8Array)) {
        try {
          heartbeatData = HeartbeatMessage.decode(data);
          console.log('解码 Protobuf 心跳成功:', heartbeatData);
        } catch (protoError) {
          console.error('Protobuf 解码失败:', protoError);
          heartbeatData = data; // 降级为 JSON
        }
      } else {
        // JSON 格式
        heartbeatData = data;
      }
      
      // 更新用户最后活跃时间
      User.findByIdAndUpdate(userId, {
        lastActive: new Date()
      }).then(() => {
        // 准备响应数据
        const response = {
          userId: userId,
          timestamp: Date.now(),
          type: 1, // PONG
          retryCount: 0
        };
        
        // 尝试使用 Protobuf 编码响应
        if (HeartbeatMessage && heartbeatData instanceof Object && !(heartbeatData instanceof Buffer)) {
          try {
            const buffer = HeartbeatMessage.encode(HeartbeatMessage.create(response)).finish();
            socket.emit('heartbeat', buffer);
            console.log(`已向用户 ${userId} 发送 Protobuf 心跳响应`);
            return;
          } catch (encodeError) {
            console.error('Protobuf 编码失败:', encodeError);
          }
        }
        
        // 降级为 JSON
        socket.emit('heartbeat', response);
        console.log(`已向用户 ${userId} 发送 JSON 心跳响应`);
      }).catch(err => {
        console.error(`更新用户 ${userId} 最后活跃时间失败:`, err);
      });
    } catch (error) {
      console.error('心跳处理错误:', error);
    }
  });

  // 处理输入状态
  socket.on('typing_status', async ({ targetUserId, isTyping }) => {
    try {
      // 获取目标用户的 socket ID
      const targetSocketId = userSocketMap.get(targetUserId);
      if (targetSocketId) {
        // 只向目标用户发送输入状态
        io.to(targetSocketId).emit('user_typing', {
          userId,
          isTyping
        });
      }
    } catch (error) {
      console.error('处理输入状态时出错:', error);
    }
  });

  // 监听用户断开连接事件
  socket.on('disconnect', async () => {
    console.log(`用户 ${userId} 已断开连接`);
    //------------------

    // 移除映射关系
    userSocketMap.delete(userId);

    // 更新用户状态为离线
    await User.findByIdAndUpdate(userId, {
      status: 'offline',
      lastActive: new Date()
    });

    // 广播用户离线状态
    socket.broadcast.emit('user_status_change', {
      userId,
      status: 'offline'
    });
  });

  // 手动设置状态事件处理
  socket.on('set_status', async ({ status }) => {
    if (!['online', 'offline', 'away'].includes(status)) {
      return;
    }

    // 更新用户状态
    await User.findByIdAndUpdate(userId, {
      status,
      lastActive: new Date()
    });

    // 广播用户状态变化
    socket.broadcast.emit('user_status_change', {
      userId,
      status
    });
  });
});

// 将 io 实例添加到 app 对象，以便在其他地方使用
app.set('io', io);

// 导出 getUserSocket 函数
export const getUserSocket = (userId) => {
  return userSocketMap.get(userId);
};

// 直接在这里添加用户状态路由
app.get('/api/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: '用户不存在'
      });
    }

    return res.status(200).json({
      userId: user._id,
      status: user.status || 'offline',
      lastActive: user.lastActive,
      // 如果需要其他字段，可以在这里添加
    });
  } catch (error) {
    console.error('获取用户状态失败:', error);
    return res.status(500).json({ 
      message: '获取用户状态失败',
      error: error.message 
    });
  }
});

// 启动服务器并监听指定端口
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});