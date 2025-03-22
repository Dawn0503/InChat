// import { Server } from 'socket.io'; // 导入 Socket.IO 服务器
// import jwt from 'jsonwebtoken'; // 导入 JSON Web Token 库，用于用户身份验证
// import User from '../models/User.js'; // 导入用户模型，用于与数据库交互
// import protobufjs from 'protobufjs'; // 导入 Protobuf.js 库，用于处理 Protobuf 消息
// import fs from 'fs'; // 导入文件系统模块，用于文件操作
// import path from 'path'; // 导入路径模块，用于处理文件路径
// import { fileURLToPath } from 'url'; // 导入 URL 模块，用于处理文件 URL

// // 获取当前文件的目录
// const __filename = fileURLToPath(import.meta.url); // 获取当前文件的完整路径
// const __dirname = path.dirname(__filename); // 获取当前文件所在的目录

// // 存储用户连接信息
// const userConnections = new Map(); // 使用 Map 存储用户连接信息，键为用户 ID，值为连接信息
// // 存储用户状态订阅关系
// const userSubscriptions = new Map(); // 使用 Map 存储用户状态的订阅关系，键为用户 ID，值为订阅者集合

// // 加载 Protobuf 定义
// let HeartbeatMessage, UserStatusMessage; // 定义心跳消息和用户状态消息的变量

// // 异步函数：加载 Protobuf 定义
// async function loadProtobuf() {
//   try {
//     const protoPath = path.join(__dirname, 'message.proto'); // 构建 Protobuf 文件的路径
//     console.log('尝试加载 Protobuf 文件:', protoPath); // 输出加载信息
    
//     // 确保文件存在
//     if (!fs.existsSync(protoPath)) { // 检查文件是否存在
//       console.error('Protobuf 文件不存在:', protoPath); // 输出错误信息
//       return null; // 返回 null
//     }
    
//     const root = await protobufjs.load(protoPath); // 加载 Protobuf 文件
//     console.log('Protobuf 定义加载成功，可用消息类型:', 
//       root.nested ? Object.keys(root.nested) : '无'); // 输出可用的消息类型
    
//     return root; // 返回加载的根对象
//   } catch (error) {
//     console.error('Protobuf 定义加载失败:', error); // 输出错误信息
//     return null; // 返回 null
//   }
// }

// // 初始化Socket.IO服务器
// const initSocketServer = async (server) => {
//   await loadProtobuf(); // 加载 Protobuf 定义
  
//   const io = new Server(server, { // 创建 Socket.IO 服务器实例
//     cors: { // 配置跨域资源共享
//       origin: ['http://localhost:8000', 'http://localhost:3006', '*'], // 允许的来源
//       methods: ['GET', 'POST'], // 允许的请求方法
//       credentials: true // 允许携带凭证
//     },
//     path: '/socket.io' // Socket.IO 的路径
//   });

//   // 中间件：验证用户身份
//   io.use(async (socket, next) => { // 使用中间件处理每个连接
//     try {
//       const token = socket.handshake.auth.token; // 从握手中获取 token
//       if (!token) { // 如果没有 token
//         return next(new Error('认证失败')); // 返回认证失败的错误
//       }

//       const decoded = jwt.verify(token, process.env.JWT_SECRET); // 验证 token
//       socket.userId = decoded.id; // 将用户 ID 存储在 socket 对象中
      
//       next(); // 继续处理
//     } catch (error) {
//       return next(new Error('认证失败')); // 返回认证失败的错误
//     }
//   });

//   // 连接事件处理
//   io.on('connection', async (socket) => { // 处理新连接事件
//     const userId = socket.userId; // 获取用户 ID
//     console.log(`用户 ${userId} 已连接，Socket ID: ${socket.id}`); // 输出连接信息
    
//     // 存储用户连接信息
//     userConnections.set(userId, { // 将用户连接信息存储在 Map 中
//       socketId: socket.id, // 存储 Socket ID
//       lastHeartbeat: Date.now(), // 存储最后心跳时间
//       status: 'online' // 存储用户状态为在线
//     });
    
//     // 更新用户状态为在线
//     await User.findByIdAndUpdate(userId, { // 更新数据库中的用户状态
//       status: 'online',
//       lastActive: new Date() // 更新最后活跃时间
//     });
    
//     // 广播用户上线状态
//     broadcastUserStatus(io, userId, 'online'); // 广播用户上线状态

//     // 记录所有接收到的事件
//     socket.onAny((eventName, ...args) => { // 监听所有事件
//       console.log(`收到事件: ${eventName}，参数:`, args); // 输出事件名称和参数
//     });

//     // 处理心跳
//     socket.on('heartbeat', (data) => { // 监听心跳事件
//       try {
//         console.log(`收到用户 ${userId} 的心跳数据:`, typeof data, Buffer.isBuffer(data) ? 'Buffer' : '非Buffer'); // 输出心跳数据类型
        
//         // 处理不同格式的心跳数据
//         let heartbeatData; // 定义心跳数据变量
        
//         if (data instanceof Buffer || data instanceof Uint8Array) { // 如果数据是二进制格式
//           // 二进制 Protobuf 数据
//           try {
//             heartbeatData = HeartbeatMessage.decode(data); // 解码 Protobuf 心跳数据
//             console.log(`解码 Protobuf 心跳成功socket.js:`, heartbeatData); // 输出解码成功的信息
//           } catch (protoError) {
//             console.error('Protobuf 解码失败socket.js:', protoError); // 输出解码失败的错误
//           }
//         } else if (typeof data === 'object') { // 如果数据是对象格式
//           // JSON 格式数据
//           heartbeatData = data; // 直接使用 JSON 数据
//           console.log(`收到 JSON 心跳socket.js:`, heartbeatData); // 输出 JSON 心跳数据
//         }
        
//         // 更新用户最后活跃时间
//         const userInfo = userConnections.get(userId); // 获取用户连接信息
//         if (userInfo) { // 如果用户信息存在
//           userInfo.lastHeartbeat = Date.now(); // 更新最后心跳时间
//           userConnections.set(userId, userInfo); // 更新 Map 中的用户信息
//           console.log(`更新用户 ${userId} 的最后心跳时间为socket.js: ${new Date(userInfo.lastHeartbeat).toISOString()}`); // 输出更新信息
//         }
        
//         // 更新数据库中的最后活跃时间
//         User.findByIdAndUpdate(userId, { // 更新数据库中的最后活跃时间
//           lastActive: new Date() // 更新为当前时间
//         }).then(() => {
//           console.log(`已更新用户 ${userId} 在数据库中的最后活跃时间socket.js`); // 输出更新成功的信息
//         }).catch(err => {
//           console.error(`更新用户 ${userId} 最后活跃时间失败:`, err); // 输出更新失败的错误
//         });
        
//         // 发送心跳响应
//         try {
//           const response = { // 创建心跳响应对象
//             userId: userId, // 用户 ID
//             timestamp: Date.now(), // 当前时间戳
//             type: 1, // PONG 类型
//             retryCount: 0 // 重试计数
//           };
          
//           // 使用 Protobuf 编码响应
//           if (HeartbeatMessage) { // 如果存在 HeartbeatMessage
//             const buffer = HeartbeatMessage.encode(HeartbeatMessage.create(response)).finish(); // 编码为二进制
//             socket.emit('heartbeat', buffer); // 发送心跳响应
//           } else {
//             // 降级为 JSON
//             socket.emit('heartbeat', response); // 发送 JSON 格式的心跳响应
//           }
          
//           console.log(`已向用户 ${userId} 发送心跳响应socket.js`); // 输出发送成功的信息
//         } catch (responseError) {
//           console.error('发送心跳响应失败socket.js:', responseError); // 输出发送失败的错误
//           // 降级为 JSON
//           socket.emit('heartbeat', { // 发送 JSON 格式的心跳响应
//             userId: userId,
//             timestamp: Date.now(),
//             type: 1, // PONG 类型
//             retryCount: 0 // 重试计数
//           });
//         }
//       } catch (error) {
//         console.error('心跳处理错误socket.js:', error); // 输出心跳处理错误
//       }
//     });

//     // 订阅用户状态
//     socket.on('subscribe_user_status', ({ targetUserId }) => { // 监听订阅用户状态事件
//       if (!targetUserId) return; // 如果没有目标用户 ID，直接返回
      
//       // 获取或创建订阅列表
//       if (!userSubscriptions.has(targetUserId)) { // 如果没有目标用户的订阅列表
//         userSubscriptions.set(targetUserId, new Set()); // 创建新的订阅集合
//       }
      
//       // 添加订阅关系
//       userSubscriptions.get(targetUserId).add(userId); // 将当前用户添加到目标用户的订阅列表中
      
//       // 立即发送目标用户的当前状态
//       sendUserStatus(io, userId, targetUserId); // 发送目标用户的状态
//     });
    
//     // 取消订阅用户状态
//     socket.on('unsubscribe_user_status', ({ targetUserId }) => { // 监听取消订阅用户状态事件
//       if (!targetUserId || !userSubscriptions.has(targetUserId)) return; // 如果没有目标用户 ID 或者没有订阅，直接返回
      
//       // 移除订阅关系
//       userSubscriptions.get(targetUserId).delete(userId); // 从目标用户的订阅列表中移除当前用户
      
//       // 如果没有订阅者，清理Map
//       if (userSubscriptions.get(targetUserId).size === 0) { // 如果目标用户没有订阅者
//         userSubscriptions.delete(targetUserId); // 删除目标用户的订阅列表
//       }
//     });

//     // 断开连接事件处理
//     socket.on('disconnect', async () => { // 监听断开连接事件
//       console.log(`用户 ${userId} 已断开连接socket.js`); // 输出断开连接的信息
      
//       // 不立即移除，等待可能的重连
//       setTimeout(async () => { // 设置延时，等待可能的重连
//         // 检查用户是否已重连
//         const userInfo = userConnections.get(userId); // 获取用户连接信息
//         if (userInfo && userInfo.socketId === socket.id) { // 如果用户信息存在且 Socket ID 匹配
//           // 更新用户状态为离线
//           await User.findByIdAndUpdate(userId, { // 更新数据库中的用户状态
//             status: 'offline', // 设置状态为离线
//             lastActive: new Date() // 更新最后活跃时间
//           });
          
//           // 广播用户离线状态
//           broadcastUserStatus(io, userId, 'offline'); // 广播用户离线状态
          
//           // 移除连接信息
//           userConnections.delete(userId); // 从 Map 中删除用户连接信息
//         }
//       }, 5000); // 等待5秒，避免网络波动导致的误判
//     });

//     // 手动设置状态事件处理
//     socket.on('set_status', async ({ status }) => { // 监听设置状态事件
//       if (!['online', 'offline', 'away', 'busy'].includes(status)) { // 如果状态不在允许的状态中
//         return; // 直接返回
//       }
      
//       // 更新用户状态
//       await User.findByIdAndUpdate(userId, { // 更新数据库中的用户状态
//         status, // 设置状态
//         lastActive: new Date() // 更新最后活跃时间
//       });
      
//       // 更新连接信息
//       const userInfo = userConnections.get(userId); // 获取用户连接信息
//       if (userInfo) { // 如果用户信息存在
//         userInfo.status = status; // 更新用户状态
//         userConnections.set(userId, userInfo); // 更新 Map 中的用户信息
//       }
      
//       // 广播用户状态变化
//       broadcastUserStatus(io, userId, status); // 广播用户状态变化
//     });
//   });

//   // 定期检查心跳超时的连接
//   setInterval(() => { // 设置定时器
//     const now = Date.now(); // 获取当前时间
//     const heartbeatTimeout = 60000; // 60秒无心跳视为离线
    
//     userConnections.forEach(async (userInfo, userId) => { // 遍历所有用户连接信息
//       if (userInfo.status === 'online' && now - userInfo.lastHeartbeat > heartbeatTimeout) { // 如果用户在线且超时
//         // 标记用户为离线
//         userInfo.status = 'offline'; // 更新用户状态为离线
//         userConnections.set(userId, userInfo); // 更新 Map 中的用户信息
        
//         // 更新数据库状态
//         await User.findByIdAndUpdate(userId, { // 更新数据库中的用户状态
//           status: 'offline', // 设置状态为离线
//           lastActive: new Date() // 更新最后活跃时间
//         });
        
//         // 广播用户离线状态
//         broadcastUserStatus(io, userId, 'offline'); // 广播用户离线状态
        
//           console.log(`用户 ${userId} 心跳超时，标记为离线socket.js`); // 输出超时信息
//       }
//     });
//   }, 30000); // 每30秒检查一次

//   // 定期打印连接信息
//   setInterval(() => { // 设置定时器
//     console.log('当前连接数socket.js:', userConnections.size); // 输出当前连接数
//     userConnections.forEach((info, userId) => { // 遍历所有用户连接信息
//         console.log(`用户 ${userId}: 状态=${info.status}, 最后心跳=${new Date(info.lastHeartbeat).toISOString()}`); // 输出用户状态和最后心跳时间
//       });
//   }, 10000); // 每10秒打印一次

//   return io; // 返回 Socket.IO 服务器实例
// };

// // 广播用户状态变化
// function broadcastUserStatus(io, userId, status) { // 定义广播用户状态变化的函数
//   // 获取订阅了该用户状态的所有用户
//   const subscribers = userSubscriptions.get(userId) || new Set(); // 获取目标用户的订阅者集合，如果没有则创建新的集合
  
//   // 创建状态消息
//   const statusMessage = UserStatusMessage.create({ // 创建用户状态消息
//     userId: userId, // 用户 ID
//     status: status, // 用户状态
//     lastActive: Date.now() // 当前时间作为最后活跃时间
//   });
  
//   // 编码为二进制
//   const buffer = UserStatusMessage.encode(statusMessage).finish(); // 将状态消息编码为二进制
  
//   // 向所有订阅者发送状态更新
//   subscribers.forEach(subscriberId => { // 遍历所有订阅者
//     const socketId = userConnections.get(subscriberId)?.socketId; // 获取订阅者的 Socket ID
//     if (socketId) { // 如果 Socket ID 存在
//       io.to(socketId).emit('user_status_update', buffer); // 发送用户状态更新
//     }
//   });
// }

// // 发送用户状态给特定用户
// async function sendUserStatus(io, receiverId, targetUserId) { // 定义发送用户状态的函数
//   try {
//     // 获取目标用户的状态
//     const user = await User.findById(targetUserId, 'status lastActive'); // 从数据库中获取目标用户的状态
//     if (!user) return; // 如果用户不存在，直接返回
    
//     // 创建状态消息
//     const statusMessage = UserStatusMessage.create({ // 创建用户状态消息
//       userId: targetUserId, // 目标用户 ID
//       status: user.status || 'offline', // 用户状态，如果不存在则默认为离线
//       lastActive: user.lastActive?.getTime() || Date.now() // 最后活跃时间，如果不存在则使用当前时间
//     });
    
//     // 编码为二进制
//     const buffer = UserStatusMessage.encode(statusMessage).finish(); // 将状态消息编码为二进制
    
//     // 发送给接收者
//     const socketId = userConnections.get(receiverId)?.socketId; // 获取接收者的 Socket ID
//     if (socketId) { // 如果 Socket ID 存在
//       io.to(socketId).emit('user_status_update', buffer); // 发送用户状态更新
//     }
//   } catch (error) {
//     console.error('发送用户状态失败:', error); // 输出发送失败的错误
//   }
// }

// export { initSocketServer }; // 导出初始化 Socket.IO 服务器的函数