// 实现控制器逻辑
import Message from '../models/Message.js'; // 导入消息模型
import { sendMessageNotification } from '../services/notificationService.js';
import User from '../models/User.js'; // 导入用户模型

// 发送消息的异步函数
export const sendMessage = async (req, res) => {
  const sender = req.user.id;  // 从 JWT token 中获取发送者ID
  // 从请求体中获取接收者和消息内容
  const { receiver, content } = req.body;

  // 添加验证
  if (!receiver || typeof receiver !== 'string' || receiver.length !== 24) {
    return res.status(400).json({ 
      error: '无效的接收者ID',
      details: '接收者ID必须是有效的MongoDB ObjectId'
    });
  }

  try {
    // 验证接收者是否存在
    const receiverExists = await User.findById(receiver);
    if (!receiverExists) {
      return res.status(404).json({ error: '接收者不存在' });
    }

    // 创建新的消息实例
    const message = new Message({ sender, receiver, content });
    // 保存消息到数据库
    await message.save();
    
    // 获取 io 实例
    const io = req.app.get('io');
    
    // 通过 WebSocket 通知接收者
    sendMessageNotification(io, receiver, {
      id: message._id,
      sender,
      content,
      createdAt: message.createdAt
    });
    
    // 返回成功响应
    res.status(201).json({ 
      message: '消息发送成功',
      messageId: message._id 
    });
  } catch (err) {
    // 捕获错误并返回错误响应
    res.status(500).json({ error: err.message });
  }
};

// 获取消息的异步函数
export const getMessages = async (req, res) => {
  const { sender, receiver } = req.query; // 从查询参数中获取发送者和接收者
  
  console.log('查询参数:', { sender, receiver });
  console.log('当前用户:', req.user.id);

  try {
    // 查找与发送者和接收者相关的消息
    const query = {
      $or: [
        { sender, receiver }, // 发送者是 sender，接收者是 receiver
        { sender: receiver, receiver: sender }, // 发送者是 receiver，接收者是 sender
      ],
    };
    
    console.log('查询条件:', JSON.stringify(query));
    
    const messages = await Message.find(query).sort({ createdAt: 1 }); // 按创建时间升序排序
    
    console.log('查询结果数量:', messages.length);
    
    // 返回成功响应和消息列表
    res.status(200).json(messages);
  } catch (err) {
    console.error('获取消息错误:', err);
    // 捕获错误并返回错误响应
    res.status(500).json({ error: err.message });
  }
};