import * as protobuf from 'protobufjs'; // 导入protobuf库，用于处理消息的序列化和反序列化
import { io, Socket } from 'socket.io-client'; // 导入socket.io-client库，用于WebSocket连接

// 创建单例模式
let instance: WebSocketService | null = null; // 定义WebSocketService的单例实例

class WebSocketService {
  private socket: Socket | null = null; // WebSocket连接实例
  private proto: protobuf.Root | null = null; // Protobuf定义的根对象
  private userId: string; // 用户ID
  private token: string; // 用户认证token
  
  // 心跳相关
  private baseHeartbeatInterval: number = 30000; // 基础心跳间隔，单位为毫秒（30秒）
  private retryHeartbeatInterval: number = 5000; // 重试心跳间隔，单位为毫秒（5秒）
  private maxRetries: number = 3; // 最大重试次数
  private retryCount: number = 0; // 当前重试计数
  private baseHeartbeatTimer: NodeJS.Timeout | null = null; // 基础心跳定时器
  private retryHeartbeatTimer: NodeJS.Timeout | null = null; // 重试心跳定时器
  
  // 状态回调
  private statusListeners: Map<string, (status: any) => void> = new Map(); // 用户状态监听器
  private messageListeners: ((message: any) => void)[] = []; // 消息监听器
  
  // 添加一个连接状态标志
  private isConnecting: boolean = false; // 连接状态标志
  
  // 添加一个属性记录最后心跳时间
  private _lastHeartbeatTime: number = 0; // 最后心跳时间
  
  // 添加一个属性记录RTT历史
  private rttHistory: number[] = []; // RTT（往返时间）历史记录
  
  // 构造函数，用于初始化WebSocketService实例
  constructor() {
    // 确保单例模式
    if (instance) {
      return instance; // 如果实例已存在，返回现有实例
    }
    
    this.userId = localStorage.getItem('id') || ''; // 从本地存储获取用户ID
    this.token = localStorage.getItem('token') || ''; // 从本地存储获取用户token
    this.initProtobuf(); // 初始化Protobuf定义
    
    instance = this; // 设置单例实例
  }
  
  // 初始化Protobuf
  private async initProtobuf() {
    try {
      console.log('开始加载Protobuf定义...'); // 日志输出，表示开始加载Protobuf定义
      this.proto = await protobuf.load('./message.proto'); // 加载Protobuf定义文件
      console.log('Protobuf初始化成功，可用消息类型:', 
        this.proto.nested ? Object.keys(this.proto.nested) : '无'); // proto.nested表示Protobuf定义中的嵌套类型，输出可用的消息类型
    } catch (error) {
      console.error('Protobuf初始化失败:', error); // 输出错误信息
    }
  }
  
  // 断开连接
  public disconnect() {
    this.stopHeartbeat(); // 停止心跳机制
    
    if (this.socket) {
      console.log('断开现有WebSocket连接'); // 日志输出，表示正在断开连接
      this.socket.disconnect(); // 断开WebSocket连接
      this.socket = null; // 清空socket实例
    }
  }

  // 连接WebSocket
  public connect() {
    if (this.isConnecting) {
      console.log('WebSocket连接正在进行中，忽略重复连接请求'); // 如果正在连接，输出日志并返回
      return;
    }
    
    if (this.socket && this.socket.connected) {
      console.log('WebSocket已连接，无需重新连接'); // 如果已连接，输出日志并返回
      return;
    }
    
    this.isConnecting = true; // 设置连接状态为正在连接
    
    // 断开现有连接
    this.disconnect(); // 先断开现有连接
    
    console.log('开始建立WebSocket连接...'); // 日志输出，表示开始连接
    
    // 创建WebSocket连接
    this.socket = io('http://localhost:3006', {
      transports: ['websocket'], // 使用websocket传输
      autoConnect: true, // 自动连接
      path: '/socket.io', // socket.io的路径
      auth: {
        token: this.token // 认证token
      },
      query: {
        userId: this.userId // 用户ID
      }
    });
    
    this.setupEventListeners(); // 设置事件监听器
  }
  

  
  // 设置事件监听
  private setupEventListeners() {
    if (!this.socket) return; // 如果socket不存在，直接返回
    
    // 监听连接事件
    this.socket.on('connect', () => {
      console.log('WebSocket连接已建立，Socket ID:', this.socket?.id); // 日志输出，表示连接成功
      this.isConnecting = false; // 设置连接状态为已连接
      this.retryCount = 0; // 重置重试计数
      
      // 连接成功后开始心跳
      this.startHeartbeat(); // 启动心跳机制
    });
    
    // 监听断开事件
    this.socket.on('disconnect', (reason) => {
      console.log(`WebSocket连接已断开，原因: ${reason}`); // 日志输出，表示连接已断开
      this.stopHeartbeat(); // 停止心跳机制
      
      // 根据断开原因决定是否重连
      if (reason === 'io server disconnect') {
        // 服务器主动断开，可能是认证失败
        console.log('服务器主动断开连接，不自动重连'); // 日志输出，表示不自动重连
      } else {
        // 其他原因，尝试重连
        this.reconnect(); // 尝试重连
      }
    });
    
    // 监听连接错误事件
    this.socket.on('connect_error', (error) => {
      console.error('连接错误:', error); // 输出连接错误信息
      this.isConnecting = false; // 设置连接状态为未连接
    });
    
    // 处理心跳响应
    this.socket.on('heartbeat', async (data) => {
      if (!this.proto) return; // 如果proto未初始化，直接返回
      
      try {
        const HeartbeatMessage = this.proto.lookupType('HeartbeatMessage'); // 查找心跳消息类型
        let message; // 定义消息变量
        
        // 判断数据类型
        if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
          // 二进制数据
          const buffer = data instanceof ArrayBuffer ? new Uint8Array(data) : data; // 将ArrayBuffer转换为Uint8Array，以便于后续的解码操作
          message = HeartbeatMessage.decode(buffer); // 解码心跳消息  将二进制数据转换为消息！！！！
        } else {
          // JSON数据
          message = data; // 直接赋值
        }
        
        console.log('收到心跳响应:', message); // 日志输出，表示收到心跳响应
        
        // 重置重试计数
        this.retryCount = 0; // 重置重试计数
        this.stopRetryHeartbeat(); // 停止重试心跳
        
        // 记录网络延迟，但不重新启动心跳
        if (message.timestamp) {
          const rtt = Date.now() - message.timestamp; // 计算RTT
          console.log(`心跳往返时间: ${rtt}ms`); // 日志输出，表示RTT时间
          
          // 只记录RTT，不调整心跳间隔
          this.recordRTT(rtt); // 记录RTT
        }
      } catch (error) {
        console.error('心跳响应解析错误:', error); // 输出解析错误信息
      }
    });
    
    // 处理用户状态更新
    this.socket.on('user_status_update', async (data) => {
      if (!this.proto) return; // 如果proto未初始化，直接返回
      
      try {
        const UserStatusMessage = this.proto.lookupType('UserStatusMessage'); // 查找用户状态消息类型
        const statusMessage = UserStatusMessage.decode(new Uint8Array(data)); // 解码用户状态消息
        
        console.log('收到用户状态更新:', statusMessage); // 日志输出，表示收到用户状态更新
        
        // 通知所有注册的状态监听器
        const listener = this.statusListeners.get(statusMessage.userId); // 获取对应用户的状态监听器
        if (listener) {
          listener(statusMessage); // 调用监听器
        }
      } catch (error) {
        console.error('状态更新解析错误:', error); // 输出解析错误信息
      }
    });
    
    // 处理聊天消息
    this.socket.on('chat_message', async (data) => {
      if (!this.proto) return; // 如果proto未初始化，直接返回
      
      try {
        const ChatMessage = this.proto.lookupType('ChatMessage'); // 查找聊天消息类型
        const message = ChatMessage.decode(new Uint8Array(data)); // 解码聊天消息
        
        console.log('收到聊天消息:', message); // 日志输出，表示收到聊天消息
        
        // 通知所有消息监听器
        this.messageListeners.forEach(listener => listener(message)); // 调用所有消息监听器
      } catch (error) {
        console.error('消息解析错误:', error); // 输出解析错误信息
      }
    });
  }
  
  // 添加一个方法记录RTT，但不立即调整心跳间隔
  private recordRTT(rtt: number) {
    // 可以记录RTT历史，用于统计分析
    this.rttHistory.push(rtt); // 添加RTT到历史记录
    
    // 只保留最近10次的RTT记录
    if (this.rttHistory.length > 10) {
      this.rttHistory.shift(); // 移除最旧的RTT记录
    }
    
    // 计算平均RTT
    const avgRTT = this.rttHistory.reduce((sum, val) => sum + val, 0) / this.rttHistory.length; // 计算平均RTT
    console.log(`平均心跳往返时间: ${avgRTT.toFixed(2)}ms`); // 日志输出，表示平均RTT
    
    // 每10次心跳才调整一次间隔，避免频繁调整
    if (this.rttHistory.length === 10) {
      this.adjustHeartbeatInterval(avgRTT); // 调整心跳间隔
    }
  }
  
  // 开始基础心跳
  private startHeartbeat() {
    console.log('开始心跳机制...'); // 日志输出，表示开始心跳机制
    
    // 清除现有定时器
    this.stopHeartbeat(); // 停止现有心跳定时器
    
    // 设置新的基础心跳定时器
    this.baseHeartbeatTimer = setInterval(() => {
      // 检查上次心跳时间，避免频繁发送
      const now = Date.now(); // 当前时间
      const lastHeartbeatTime = this._lastHeartbeatTime || 0; // 上次心跳时间
      
      if (now - lastHeartbeatTime < 5000) { // 至少间隔5秒
        console.log('心跳间隔过短，跳过本次心跳'); // 日志输出，表示跳过心跳
        return;
      }
      
      if (this.socket && this.socket.connected) {
        this._lastHeartbeatTime = now; // 记录本次心跳时间
        this.sendHeartbeat('PING'); // 发送心跳
      } else {
        console.warn('心跳定时器触发，但WebSocket未连接'); // 日志输出，表示WebSocket未连接
        this.reconnect(); // 尝试重连
      }
    }, this.baseHeartbeatInterval); // 设置定时器间隔
    
    // 立即发送一次心跳，但也要检查时间间隔
    const now = Date.now(); // 当前时间
    const lastHeartbeatTime = this._lastHeartbeatTime || 0; // 上次心跳时间
    
    if (now - lastHeartbeatTime >= 5000 && this.socket && this.socket.connected) {
      this._lastHeartbeatTime = now; // 记录本次心跳时间
      this.sendHeartbeat('PING'); // 发送心跳
    }
  }
  
  // 开始重试心跳
  // private startRetryHeartbeat() {
  //   this.stopRetryHeartbeat(); // 清除现有重试定时器
    
  //   this.retryHeartbeatTimer = setInterval(() => {
  //     if (this.retryCount >= this.maxRetries) {
  //       this.stopRetryHeartbeat(); // 停止重试心跳
  //       this.socket?.disconnect(); // 断开连接，触发重连
  //       return;
  //     }
      
  //     this.retryCount++; // 增加重试计数
  //     this.sendHeartbeat('RETRY', this.retryCount); // 发送重试心跳
  //   }, this.retryHeartbeatInterval); // 设置重试心跳间隔
  // }
  
  // 发送心跳
  private async sendHeartbeat(type: 'PING' | 'RETRY', retryCount: number = 0) {
    console.log(`准备发送心跳 (类型: ${type}, 重试次数: ${retryCount})`); // 日志输出，表示准备发送心跳
    
    // 更严格的连接检查
    if (!this.socket) {
      console.error('WebSocket实例不存在，无法发送心跳'); // 输出错误信息
      this.reconnect(); // 尝试重连
      return;
    }
    
    if (!this.socket.connected) {
      console.error('WebSocket未连接，无法发送心跳'); // 输出错误信息
      this.reconnect(); // 尝试重连
      return;
    }
    
    try {
      // 检查proto是否已初始化
      if (!this.proto) {
        console.error('Protobuf未初始化，无法发送心跳'); // 输出错误信息
        return;
      }
      
      // 尝试查找HeartbeatMessage类型
      let HeartbeatMessage;
      try {
        HeartbeatMessage = this.proto.lookupType('HeartbeatMessage'); // 查找心跳消息类型
      } catch (error) {
        console.error('找不到HeartbeatMessage类型:', error); // 输出错误信息
        
        // 降级：直接发送JSON格式的心跳
        this.socket.emit('heartbeat', {
          userId: this.userId, // 用户ID
          timestamp: Date.now(), // 当前时间戳
          type: type === 'PING' ? 0 : 2, // 心跳类型
          retryCount: retryCount // 重试计数
        });
        console.log('JSON心跳已发送'); // 日志输出，表示已发送JSON心跳
        return; // 这里的return会导致后续代码不再执行
      }
      
      // 创建心跳消息
      const message = HeartbeatMessage.create({
        userId: this.userId, // 用户ID
        timestamp: Date.now(), // 当前时间戳
        type: type === 'PING' ? 0 : 2, // 心跳类型
        retryCount: retryCount // 重试计数
      });
      
      // 编码消息
      const buffer = HeartbeatMessage.encode(message).finish(); // 编码心跳消息  将消息转换为二进制数据！！！！
      
      // 发送心跳
      this.socket.emit('heartbeat', buffer); // 发送心跳消息  发送二进制数据！！！！
      console.log('心跳已发送'); // 日志输出，表示心跳已发送
    } catch (error) {
      console.error('发送心跳失败:', error); // 输出发送心跳失败的错误信息
      
      // 降级：直接发送JSON格式的心跳
      if (this.socket && this.socket.connected) {
        this.socket.emit('heartbeat', {
          userId: this.userId, // 用户ID
          timestamp: Date.now(), // 当前时间戳
          type: type === 'PING' ? 0 : 2, // 心跳类型
          retryCount: retryCount // 重试计数
        });
        console.log('降级JSON心跳已发送'); // 日志输出，表示已发送降级JSON心跳
      }
    }
  }
  
  // 动态调整心跳间隔
  private adjustHeartbeatInterval(rtt: number) {
    console.log(`调整心跳间隔，当前RTT: ${rtt}ms, 当前间隔: ${this.baseHeartbeatInterval}ms`); // 日志输出，表示正在调整心跳间隔
    
    // 根据RTT调整心跳间隔，但变化不要太剧烈
    if (rtt > 1000) { // 网络延迟大
      this.baseHeartbeatInterval = Math.min(this.baseHeartbeatInterval * 1.2, 60000); // 最大60秒
    } else if (rtt < 100) { // 网络良好
      this.baseHeartbeatInterval = Math.max(this.baseHeartbeatInterval * 0.8, 15000); // 最小15秒
    }
    
    console.log(`新的心跳间隔: ${this.baseHeartbeatInterval}ms`); // 日志输出，表示新的心跳间隔
    
    // 重新设置心跳定时器，但不立即发送心跳
    this.stopHeartbeat(); // 停止现有心跳定时器
    this.baseHeartbeatTimer = setInterval(() => {
      // 检查上次心跳时间，避免频繁发送
      const now = Date.now(); // 当前时间
      const lastHeartbeatTime = this._lastHeartbeatTime || 0; // 上次心跳时间
      
      if (now - lastHeartbeatTime < 5000) { // 至少间隔5秒
        console.log('心跳间隔过短，跳过本次心跳'); // 日志输出，表示跳过心跳
        return;
      }
      
      if (this.socket && this.socket.connected) {
        this._lastHeartbeatTime = now; // 记录本次心跳时间
        this.sendHeartbeat('PING'); // 发送心跳
      } else {
        console.warn('心跳定时器触发，但WebSocket未连接'); // 日志输出，表示WebSocket未连接
        this.reconnect(); // 尝试重连
      }
    }, this.baseHeartbeatInterval); // 设置定时器间隔
  }
  
  // 停止心跳
  private stopHeartbeat() {
    if (this.baseHeartbeatTimer) {
      clearInterval(this.baseHeartbeatTimer); // 清除心跳定时器
      this.baseHeartbeatTimer = null; // 清空定时器
    }
    this.stopRetryHeartbeat(); // 停止重试心跳
  }
  
  // 停止重试心跳
  private stopRetryHeartbeat() {
    if (this.retryHeartbeatTimer) {
      clearInterval(this.retryHeartbeatTimer); // 清除重试心跳定时器
      this.retryHeartbeatTimer = null; // 清空定时器
    }
  }
  
  // 重连
  private reconnect() {
    if (this.isConnecting) {
      console.log('已经在重连中，忽略重复重连请求'); // 日志输出，表示正在重连
      return;
    }
    
    console.log('尝试重新连接WebSocket...'); // 日志输出，表示尝试重连
    
    // 停止现有心跳
    this.stopHeartbeat(); // 停止现有心跳
    
    // 延迟重连，避免立即重连导致的问题
    setTimeout(() => {
      this.connect(); // 尝试连接
    }, 2000); // 延迟2秒
  }
  
  // 检查连接状态
  public isConnected(): boolean {
    return this.socket !== null && this.socket.connected; // 返回WebSocket连接状态
  }
  
  // 注册状态监听器
  public registerStatusListener(userId: string, callback: (status: any) => void) {
    this.statusListeners.set(userId, callback); // 将状态监听器注册到Map中
  }
  
  // 注销状态监听器
  public unregisterStatusListener(userId: string) {
    this.statusListeners.delete(userId); // 从Map中删除状态监听器
  }
  
  // 注册消息监听器
  public registerMessageListener(callback: (message: any) => void) {
    this.messageListeners.push(callback); // 将消息监听器添加到数组中
  }
  
  // 注销消息监听器
  public unregisterMessageListener(callback: (message: any) => void) {
    const index = this.messageListeners.indexOf(callback); // 查找监听器索引
    if (index !== -1) {
      this.messageListeners.splice(index, 1); // 从数组中删除监听器
    }
  }
  
  // 发送消息
  public async sendMessage(receiverId: string, content: string) {
    if (!this.socket || !this.socket.connected) {
      console.error('WebSocket未连接，无法发送消息'); // 输出错误信息
      return false; // 返回发送失败
    }
    
    if (!this.proto) {
      console.error('Protobuf未初始化，无法发送消息'); // 输出错误信息
      return false; // 返回发送失败
    }
    
    try {
      const ChatMessage = this.proto.lookupType('ChatMessage'); // 查找聊天消息类型
      const message = ChatMessage.create({
        userId: this.userId, // 用户ID
        content: content, // 消息内容
        timestamp: Date.now() // 当前时间戳
      });
      
      const buffer = ChatMessage.encode(message).finish(); // 编码聊天消息
      
      this.socket.emit('chat_message', buffer, receiverId); // 发送聊天消息
      return true; // 返回发送成功
    } catch (error) {
      console.error('发送消息失败:', error); // 输出发送消息失败的错误信息
      return false; // 返回发送失败
    }
  }
}

// 导出单例获取函数
export default function getWebSocketService(): WebSocketService {
  if (!instance) {
    instance = new WebSocketService(); // 创建新的WebSocketService实例
  }
  return instance; // 返回WebSocketService实例
}