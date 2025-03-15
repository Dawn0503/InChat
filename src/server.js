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

// 设置服务器端口，优先使用环境变量中的 PORT，默认为 3006
const PORT = process.env.PORT || 3006;

// 创建 HTTP 服务器，并将应用程序传入
const server = http.createServer(app);

// 存储用户 ID 和 socket ID 的映射关系
const userSocketMap = new Map();

// 创建 Socket.io 服务器，并配置 CORS
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:8000', 'http://localhost:3006', '*'],
    methods: ['GET', 'POST'],
    credentials: true
  },
});

// 中间件：验证用户身份
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

  // 监听用户断开连接事件
  socket.on('disconnect', async () => {
    console.log(`用户 ${userId} 已断开连接`);
    
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

// 启动服务器并监听指定端口
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});