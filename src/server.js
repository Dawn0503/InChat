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
// 导入文件系统模块，用于文件操作
import fs from 'fs';
// 导入路径模块，用于处理文件路径
import path from 'path';
// 导入 URL 模块，用于处理 URL
import { fileURLToPath } from 'url';
// 导入 Protobuf.js，用于处理 Protobuf 数据
import protobufjs from 'protobufjs';

// 获取当前文件的目录
// fileURLToPath 是一个用于将模块的 URL 转换为文件系统路径的 API，
// 这里使用 import.meta.url 获取当前模块的 URL，并将其转换为完整的文件路径。
const __filename = fileURLToPath(import.meta.url); // 获取当前文件的完整路径

// dirname 是一个用于获取给定路径的目录名的 API，
// 这里使用 path.dirname 方法获取 __filename 的目录名，即当前文件所在的目录。
const __dirname = path.dirname(__filename); // 获取当前文件所在的目录

// 加载 Protobuf 定义
let root; // 用于存储 Protobuf 根对象
let HeartbeatMessage; // 用于存储心跳消息的类型

// 异步函数：加载 Protobuf 定义
async function loadProtobuf() {
  try {
    // 构建 Protobuf 文件的路径
    const protoPath = path.join(__dirname, 'config', 'message.proto');
    console.log('加载 Protobuf 文件:', protoPath); // 输出加载信息
    
    // 检查 Protobuf 文件是否存在
    if (!fs.existsSync(protoPath)) {
      console.error('Protobuf 文件不存在:', protoPath); // 输出错误信息
      return false; // 返回 false，表示加载失败
    }
    
    // 加载 Protobuf 文件
    root = await protobufjs.load(protoPath);
    HeartbeatMessage = root.lookupType('HeartbeatMessage'); // 查找心跳消息类型
    console.log('Protobuf 定义加载成功'); // 输出成功信息
    return true; // 返回 true，表示加载成功
  } catch (error) {
    console.error('Protobuf 定义加载失败:', error); // 输出错误信息
    return false; // 返回 false，表示加载失败
  }
}

// 设置服务器端口，优先使用环境变量中的 PORT，默认为 3006
const PORT = process.env.PORT || 3006; // 获取端口号

// 创建 HTTP 服务器，并将应用程序传入
const server = http.createServer(app); // 创建 HTTP 服务器实例

// 存储用户 ID 和 socket ID 的映射关系
const userSocketMap = new Map(); // 创建一个映射关系，用于存储用户 ID 和 socket ID

// 创建 Socket.IO 服务器
const io = new Server(server, {
  cors: { // 配置跨域资源共享
    origin: "*", // 允许所有来源
    methods: ["GET", "POST"] // 允许的请求方法
  },
  path: '/socket.io' // Socket.IO 的路径
});

// 在 Socket.IO 连接处理前加载 Protobuf
await loadProtobuf(); // 加载 Protobuf 定义

// 添加 Socket.IO 中间件
// io.use 是 Socket.IO 提供的中间件 API，用于在处理连接之前对每个 socket 进行处理。
// 通过这个中间件，我们可以在用户连接时进行认证、授权等操作。
// 中间件函数接收两个参数：socket 和 next。
// socket 是当前连接的 socket 实例，next 是一个函数，用于调用下一个中间件或处理程序。
// 如果在中间件中发生错误，可以通过调用 next 函数并传入错误对象来终止连接。
// 这样可以确保只有通过认证的用户才能继续进行后续操作。
io.use(async (socket, next) => {
  try {
    // 从 Socket.IO 的握手过程中获取认证信息
    // handshake 是 Socket.IO 在建立连接时进行的初始交互过程
    // auth 是一个包含认证信息的对象，这里我们从中提取 token
    const token = socket.handshake.auth.token; // 从握手中获取 token
    if (!token) {
      return next(new Error('认证失败')); // 如果没有 token，返回认证失败
    }

    // 验证 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // 验证 token 并解码
    socket.userId = decoded.id; // 将用户 ID 存储在 socket 对象中

    // 更新用户状态为在线
    await User.findByIdAndUpdate(decoded.id, {
      status: 'online', // 设置用户状态为在线
      lastActive: new Date() // 更新最后活跃时间
    });

    next(); // 继续执行下一个中间件
  } catch (error) {
    return next(new Error('认证失败')); // 如果验证失败，返回认证失败
  }
});

// 添加用户最后心跳时间记录
const userLastHeartbeat = new Map(); // 创建一个映射关系，用于存储用户最后心跳时间

// 监听 Socket.io 连接事件
// io.on 是 Socket.IO 提供的一个 API，用于监听客户端的连接事件。当一个客户端成功连接到服务器时，这个事件会被触发。
// 这个函数接收一个回调函数作为参数，回调函数的参数是当前连接的 socket 实例。
// 在这个回调函数中，我们可以处理与该客户端的交互，例如存储用户信息、广播消息等。
io.on('connection', async (socket) => {
  const userId = socket.userId; // 获取用户 ID
  console.log(`用户 ${userId} 已连接，Socket ID 是: ${socket.id}server.js`); // 输出连接信息

  // 存储用户 ID 和 socket ID 的映射关系
  userSocketMap.set(userId, socket.id); // 将用户 ID 和 socket ID 存储在映射中

  // 广播用户上线状态
  socket.broadcast.emit('user_status_change', { // 向其他用户广播上线状态
    userId,
    status: 'online' // 设置状态为在线
  });
  //------------------

  // 处理心跳包
  // socket.on 是 Socket.IO 提供的一个 API，用于监听特定事件。监听名为 'heartbeat' 的事件。
  // 当客户端发送心跳事件时，回调函数将被触发，并接收传入的数据。
  socket.on('heartbeat', (data) => { // 监听心跳事件
    try {
      const now = Date.now(); // 获取当前时间
      const lastHeartbeatTime = userLastHeartbeat.get(userId) || 0; // 获取最后心跳时间
      
      // 如果两次心跳间隔小于5秒，则忽略
      if (now - lastHeartbeatTime < 5000) {
        console.log(`忽略用户 ${userId} 的频繁心跳请求，间隔: ${now - lastHeartbeatTime}ms`); // 输出忽略信息
        return; // 返回，结束处理
      }
      
      // 更新最后心跳时间
      userLastHeartbeat.set(userId, now); // 更新用户最后心跳时间
      
      console.log(`收到用户 ${userId} 的心跳数据server.js:`, typeof data); // 输出心跳数据类型
      
      let heartbeatData; // 定义心跳数据变量
      
      // 尝试解析 Protobuf 数据
      if (HeartbeatMessage && (data instanceof Buffer || data instanceof Uint8Array)) {
        try {
          heartbeatData = HeartbeatMessage.decode(data); // 解码 Protobuf 数据
          console.log('解码 Protobuf 心跳成功server.js:', heartbeatData); // 输出解码成功信息
        } catch (protoError) {
          console.error('Protobuf 解码失败server.js:', protoError); // 输出解码失败信息
          heartbeatData = data; // 降级为 JSON
        }
      } else {
        // JSON 格式
        heartbeatData = data; // 如果不是 Protobuf 数据，直接使用 JSON 数据
      }
      
      // 更新用户最后活跃时间
      // User.findByIdAndUpdate 是 Mongoose 提供的一个 API，用于根据用户 ID 查找用户并更新其字段。
      // 它接受用户 ID 和一个更新对象作为参数，执行更新操作并返回更新后的文档。
      // 这个方法可以用于修改用户的状态或其他信息。
      User.findByIdAndUpdate(userId, {
        lastActive: new Date() // 更新最后活跃时间
      }).then(() => {
        // 准备响应数据
        const response = {
          userId: userId, // 用户 ID
          timestamp: Date.now(), // 当前时间戳
          type: 1, // PONG 类型
          retryCount: 0 // 重试次数
        };
        
        // 尝试使用 Protobuf 编码响应
        if (HeartbeatMessage && heartbeatData instanceof Object && !(heartbeatData instanceof Buffer)) {
          try {
            const buffer = HeartbeatMessage.encode(HeartbeatMessage.create(response)).finish(); // 编码为 Protobuf 数据
            socket.emit('heartbeat', buffer); // 发送心跳响应
            console.log(`已向用户 ${userId} 发送 Protobuf 心跳响应server.js`); // 输出发送成功信息
            return; // 返回，结束处理
          } catch (encodeError) {
            console.error('Protobuf 编码失败server.js:', encodeError); // 输出编码失败信息
          }
        }
        
        // 降级为 JSON
        socket.emit('heartbeat', response); // 发送 JSON 响应
        console.log(`已向用户 ${userId} 发送 JSON 心跳响应server.js`); // 输出发送成功信息
      }).catch(err => {
        console.error(`更新用户 ${userId} 最后活跃时间失败server.js:`, err); // 输出更新失败信息
      });
    } catch (error) {
      console.error('心跳处理错误server.js:', error); // 输出处理错误信息
    }
  });

  // 处理输入状态
  socket.on('typing_status', async ({ targetUserId, isTyping }) => { // 监听输入状态事件
    try {
      // 获取目标用户的 socket ID
      const targetSocketId = userSocketMap.get(targetUserId); // 从映射中获取目标用户的 socket ID
      if (targetSocketId) {
        // 只向目标用户发送输入状态
        io.to(targetSocketId).emit('user_typing', { // 向目标用户发送输入状态
          userId,
          isTyping // 输入状态
        });
      }
    } catch (error) {
      console.error('处理输入状态时出错server.js:', error); // 输出处理错误信息
    }
  });

  // 监听用户断开连接事件
  socket.on('disconnect', async () => {
    console.log(`用户 ${userId} 已断开连接server.js`); // 输出断开连接信息
    //------------------

    // 移除映射关系
    userSocketMap.delete(userId); // 从映射中删除用户 ID

    // 更新用户状态为离线
    await User.findByIdAndUpdate(userId, {
      status: 'offline', // 设置用户状态为离线
      lastActive: new Date() // 更新最后活跃时间
    });

    // 广播用户离线状态
    socket.broadcast.emit('user_status_change', { // 向其他用户广播离线状态
      userId,
      status: 'offline' // 设置状态为离线
    });
  });

  // 手动设置状态事件处理
  socket.on('set_status', async ({ status }) => { // 监听设置状态事件
    if (!['online', 'offline', 'away'].includes(status)) { // 检查状态是否合法
      return; // 如果不合法，返回
    }

    // 更新用户状态
    await User.findByIdAndUpdate(userId, {
      status, // 更新状态
      lastActive: new Date() // 更新最后活跃时间
    });

    // 广播用户状态变化
    socket.broadcast.emit('user_status_change', { // 向其他用户广播状态变化
      userId,
      status // 新状态
    });
  });
});

// 将 io 实例添加到 app 对象，以便在其他地方使用
app.set('io', io); // 将 Socket.IO 实例添加到应用程序中

// 导出 getUserSocket 函数
export const getUserSocket = (userId) => {
  return userSocketMap.get(userId); // 根据用户 ID 获取对应的 socket ID
};

// 直接在这里添加用户状态路由
app.get('/api/users/:userId/status', async (req, res) => { // 定义获取用户状态的 API 路由
  try {
    const { userId } = req.params; // 从请求参数中获取用户 ID
    
    const user = await User.findById(userId); // 根据用户 ID 查找用户
    if (!user) {
      return res.status(404).json({ // 如果用户不存在，返回 404 状态
        message: '用户不存在' // 返回错误信息
      });
    }

    return res.status(200).json({ // 返回 200 状态和用户状态信息
      userId: user._id, // 用户 ID
      status: user.status || 'offline', // 用户状态，默认为离线
      lastActive: user.lastActive, // 用户最后活跃时间
      // 如果需要其他字段，可以在这里添加
    });
  } catch (error) {
    console.error('获取用户状态失败:', error); // 输出获取失败信息
    return res.status(500).json({ // 返回 500 状态
      message: '获取用户状态失败', // 返回错误信息
      error: error.message // 返回错误详情
    });
  }
});

// 启动服务器并监听指定端口
server.listen(PORT, () => { // 启动服务器
  console.log(`服务器运行在 http://localhost:${PORT}`); // 输出服务器运行信息
});