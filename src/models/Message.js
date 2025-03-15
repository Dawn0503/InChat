// 创建数据库模型
import mongoose from 'mongoose';

// 定义消息模式
const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true }, // 发送者
  receiver: { type: String, required: true }, // 接收者
  content: { type: String, required: true }, // 消息内容
  createdAt: { type: Date, default: Date.now }, // 创建时间
});

// 创建消息模型
const Message = mongoose.model('Message', messageSchema);

// 检查模型定义是否正确
console.log('Message模型定义:', mongoose.model('Message').schema.paths);

// 导出消息模型
export default Message;