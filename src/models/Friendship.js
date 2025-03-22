import mongoose from 'mongoose'; // 导入 mongoose 库，用于与 MongoDB 交互

// 定义好友关系状态枚举
const STATUS = {
  PENDING: 'pending',    // 等待接受
  ACCEPTED: 'accepted',  // 已接受
  REJECTED: 'rejected'   // 已拒绝
};

// 定义好友关系模式
// 在这里，我们定义了一个名为 friendshipSchema 的 Mongoose 模式（Schema），
// 它用于描述好友关系的数据结构和约束。Schema 是 Mongoose 中的一个重要概念，
// 它定义了文档的形状，包括字段的类型、是否必填、默认值等。通过定义 Schema，
// 我们可以确保存储在 MongoDB 中的数据符合预期的格式和规则。
const friendshipSchema = new mongoose.Schema({
  requester: {
    type: String, 
    required: true, // 请求者字段为必填
    ref: 'User'  // 引用用户模型
  },
  recipient: { 
    type: String, 
    required: true, // 接收者字段为必填
    ref: 'User'  // 引用用户模型
  },
  status: { 
    type: String, 
    required: true, // 状态字段为必填
    enum: Object.values(STATUS), // 状态值必须是 STATUS 中的一个
    default: STATUS.PENDING // 默认状态为 PENDING
  },
  createdAt: { 
    type: Date, 
    default: Date.now // 创建时间默认为当前时间
  },
  updatedAt: { 
    type: Date, 
    default: Date.now // 更新时间默认为当前时间
  }
}, {
  timestamps: true  // 自动管理 createdAt 和 updatedAt 字段
});

// 添加复合索引，确保不会有重复的好友请求
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true }); // 确保请求者和接收者的组合唯一

// 导出状态枚举供其他模块使用
export const FRIENDSHIP_STATUS = STATUS; // 导出好友关系状态

// 创建好友关系模型
const Friendship = mongoose.model('Friendship', friendshipSchema); // 创建模型

// 导出好友关系模型
export default Friendship; // 导出模型