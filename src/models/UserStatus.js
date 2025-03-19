/**
 * 用户状态模型 - 用于跟踪用户的在线状态和活动
 * 
 * 这个模块定义了用户状态的数据结构，包括在线状态、自定义状态消息、
 * 最后在线时间以及正在输入的状态等信息。
 */

// 引入mongoose库，用于创建MongoDB数据模型
const mongoose = require('mongoose');

/**
 * 用户状态数据模式定义
 */
const userStatusSchema = new mongoose.Schema({
  // 用户ID - 关联到User模型
  userId: {
    type: mongoose.Schema.Types.ObjectId, // MongoDB的对象ID类型
    ref: 'User',                          // 引用User模型
    required: true,                       // 必填字段
    unique: true                          // 每个用户只能有一个状态记录
  },
  
  // 用户状态 - 表示用户当前的可用性
  status: {
    type: String,
    enum: ['online', 'offline', 'away', 'busy'], // 只允许这四种状态值
    default: 'offline'                           // 默认为离线状态
  },
  
  // 自定义状态消息 - 用户可以设置的个性化状态信息
  customStatus: {
    type: String,
    maxLength: 100                        // 最多100个字符
  },
  
  // 最后在线时间 - 记录用户最后活跃的时间
  lastSeen: {
    type: Date,
    default: Date.now                     // 默认为当前时间
  },
  
  // 存储该用户与其他用户的输入状态
  // 例如：当用户A正在给用户B发消息时，这里会记录用户A对B的输入状态
  typingTo: {
    type: Map,                            // 使用Map类型存储多个用户ID的输入状态
    of: {                                 // Map中每个值的结构
      isTyping: Boolean,                  // 是否正在输入
      timestamp: Date                     // 状态更新时间
    },
    default: new Map()                    // 默认为空Map
  }
}, { 
  timestamps: true                        // 自动添加createdAt和updatedAt字段
});

/**
 * 导出用户状态模型
 * 
 * API使用说明:
 * - 创建新状态: const status = new UserStatus({userId: '用户ID', ...})
 * - 查找用户状态: UserStatus.findOne({userId: '用户ID'})
 * - 更新状态: UserStatus.findOneAndUpdate({userId: '用户ID'}, {status: 'online'})
 * - 设置输入状态: 
 *   status.typingTo.set('接收者ID', {isTyping: true, timestamp: new Date()})
 *   status.save()
 */
module.exports = mongoose.model('UserStatus', userStatusSchema); 