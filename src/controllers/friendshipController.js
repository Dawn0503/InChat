import Friendship, { FRIENDSHIP_STATUS } from '../models/Friendship.js'; // 导入好友关系模型和状态枚举
import User from '../models/User.js'; // 导入用户模型
import { 
  sendFriendRequestNotification,
  sendFriendRequestResponseNotification
} from '../services/notificationService.js';

// 发送好友请求的控制器函数
export const sendFriendRequest = async (req, res) => {
  try {
    const requesterId = req.user.id;  // 从JWT获取请求者ID
    const { recipientId } = req.body;  // 从请求体获取接收者ID

    // 验证接收者是否存在
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 检查是否已经发送过请求
    const existingRequest = await Friendship.findOne({
      requester: requesterId,
      recipient: recipientId
    });

    if (existingRequest) {
      return res.status(400).json({ message: '已经发送过好友请求' });
    }

    // 检查对方是否已经向你发送了请求
    const reverseRequest = await Friendship.findOne({
      requester: recipientId,
      recipient: requesterId
    });

    if (reverseRequest) {
      return res.status(400).json({ message: '对方已经向你发送了好友请求，请直接接受' });
    }

    // 创建新的好友请求
    const friendship = new Friendship({
      requester: requesterId,
      recipient: recipientId,
      status: FRIENDSHIP_STATUS.PENDING // 设置状态为等待接受
    });

    // 保存好友请求到数据库
    await friendship.save();

    // 获取请求者信息
    const requester = await User.findById(requesterId).select('username avatar');
    
    // 获取 io 实例
    const io = req.app.get('io');
    
    // 通过 WebSocket 通知接收者
    sendFriendRequestNotification(io, recipientId, {
      id: friendship._id,
      requester: {
        id: requester._id,
        username: requester.username,
        avatar: requester.avatar
      },
      createdAt: friendship.createdAt
    });

    // 返回成功响应
    res.status(201).json({
      message: '好友请求已发送',
      friendship
    });
  } catch (err) {
    // 捕获并处理错误
    res.status(500).json({ message: '发送好友请求失败', error: err.message });
  }
};

// 接受好友请求的控制器函数
export const acceptFriendRequest = async (req, res) => {
  try {
    const recipientId = req.user.id;  // 当前用户是接收者
    const { requestId } = req.params;  // 从URL参数获取请求ID

    // 查找并更新好友请求状态为已接受
    const friendship = await Friendship.findOneAndUpdate(
      { 
        _id: requestId,
        recipient: recipientId,
        status: FRIENDSHIP_STATUS.PENDING // 只能接受处于等待状态的请求
      },
      { status: FRIENDSHIP_STATUS.ACCEPTED }, // 更新状态为已接受
      { new: true } // 返回更新后的文档
    );

    // 如果请求不存在或已处理，返回错误
    if (!friendship) {
      return res.status(404).json({ message: '好友请求不存在或已处理' });
    }

    // 获取接收者信息
    const recipient = await User.findById(recipientId).select('username avatar');
    
    // 获取 io 实例
    const io = req.app.get('io');
    
    // 通过 WebSocket 通知请求者
    sendFriendRequestResponseNotification(io, friendship.requester, {
      id: friendship._id,
      recipient: {
        id: recipient._id,
        username: recipient.username,
        avatar: recipient.avatar
      },
      status: FRIENDSHIP_STATUS.ACCEPTED,
      updatedAt: friendship.updatedAt
    });

    // 返回成功响应
    res.status(200).json({
      message: '已接受好友请求',
      friendship
    });
  } catch (err) {
    // 捕获并处理错误
    res.status(500).json({ message: '接受好友请求失败', error: err.message });
  }
};

// 拒绝好友请求的控制器函数
export const rejectFriendRequest = async (req, res) => {
  try {
    const recipientId = req.user.id;  // 当前用户是接收者
    const { requestId } = req.params;  // 从URL参数获取请求ID

    // 查找并更新好友请求状态为已拒绝
    const friendship = await Friendship.findOneAndUpdate(
      { 
        _id: requestId,
        recipient: recipientId,
        status: FRIENDSHIP_STATUS.PENDING // 只能拒绝处于等待状态的请求
      },
      { status: FRIENDSHIP_STATUS.REJECTED }, // 更新状态为已拒绝
      { new: true } // 返回更新后的文档
    );

    // 如果请求不存在或已处理，返回错误
    if (!friendship) {
      return res.status(404).json({ message: '好友请求不存在或已处理' });
    }

    // 返回成功响应
    res.status(200).json({
      message: '已拒绝好友请求',
      friendship
    });
  } catch (err) {
    // 捕获并处理错误
    res.status(500).json({ message: '拒绝好友请求失败', error: err.message });
  }
};

// 获取好友列表的控制器函数
export const getFriends = async (req, res) => {
  try {
    const userId = req.user.id; // 获取当前用户ID

    // 查找当前用户的所有已接受的好友关系（作为请求者或接收者）
    const friendships = await Friendship.find({
      $or: [
        { requester: userId, status: FRIENDSHIP_STATUS.ACCEPTED },
        { recipient: userId, status: FRIENDSHIP_STATUS.ACCEPTED }
      ]
    }).populate('requester recipient', 'username avatar');  // 填充用户信息，只获取用户名和头像

    // 提取好友信息并格式化
    const friends = friendships.map(friendship => {
      // 如果当前用户是请求者，返回接收者信息；否则返回请求者信息
      const friend = friendship.requester._id.toString() === userId 
        ? friendship.recipient 
        : friendship.requester;
      
      // 返回格式化的好友信息
      return {
        id: friend._id,
        username: friend.username,
        avatar: friend.avatar,
        friendshipId: friendship._id
      };
    });

    // 返回好友列表
    res.status(200).json(friends);
  } catch (err) {
    // 捕获并处理错误
    res.status(500).json({ message: '获取好友列表失败', error: err.message });
  }
};

// 获取待处理的好友请求的控制器函数
export const getPendingRequests = async (req, res) => {
  try {
    const userId = req.user.id; // 获取当前用户ID

    // 查找发送给当前用户的待处理请求
    const pendingRequests = await Friendship.find({
      recipient: userId,
      status: FRIENDSHIP_STATUS.PENDING
    }).populate('requester', 'username avatar'); // 填充请求者信息，只获取用户名和头像

    // 格式化请求信息
    const requests = pendingRequests.map(request => ({
      id: request._id,
      requester: {
        id: request.requester._id,
        username: request.requester.username,
        avatar: request.requester.avatar
      },
      createdAt: request.createdAt
    }));

    // 返回待处理请求列表
    res.status(200).json(requests);
  } catch (err) {
    // 捕获并处理错误
    res.status(500).json({ message: '获取待处理请求失败', error: err.message });
  }
};

// 删除好友的控制器函数
export const removeFriend = async (req, res) => {
  try {
    const userId = req.user.id; // 获取当前用户ID
    const { friendId } = req.params; // 从URL参数获取好友ID

    // 查找并删除好友关系（无论当前用户是请求者还是接收者）
    const result = await Friendship.findOneAndDelete({
      $or: [
        { requester: userId, recipient: friendId, status: FRIENDSHIP_STATUS.ACCEPTED },
        { requester: friendId, recipient: userId, status: FRIENDSHIP_STATUS.ACCEPTED }
      ]
    });

    // 如果好友关系不存在，返回错误
    if (!result) {
      return res.status(404).json({ message: '好友关系不存在' });
    }

    // 返回成功响应
    res.status(200).json({ message: '已删除好友关系' });
  } catch (err) {
    // 捕获并处理错误
    res.status(500).json({ message: '删除好友失败', error: err.message });
  }
};