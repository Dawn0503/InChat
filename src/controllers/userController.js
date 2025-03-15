import bcrypt from 'bcryptjs'; // 导入 bcryptjs 库，用于密码加密
import jwt from 'jsonwebtoken'; // 导入 jsonwebtoken 库，用于生成 JWT
import User from '../models/User.js'; // 导入用户模型
import Friendship, { FRIENDSHIP_STATUS } from '../models/Friendship.js';

// 用户注册
export const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 检查用户名是否已存在
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    // 创建新用户
    const user = new User({
      username,
      password,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, // 使用 DiceBear API 生成头像
      status: 'online',
      lastActive: new Date()
    });

    // 保存用户到数据库
    await user.save();

    // 生成 JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 返回用户信息和 token
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ message: '注册失败', error: err.message });
  }
};

// 用户登录
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    // 验证密码
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    // 更新用户状态为在线
    user.status = 'online';
    user.lastActive = new Date();
    await user.save();

    // 生成 JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 返回用户信息和 token
    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ message: '登录失败', error: err.message });
  }
};

// 获取所有用户（包含与当前用户的好友关系状态）
export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    // 查询除了当前用户以外的所有用户
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select('_id username avatar createdAt')
      .sort({ username: 1 });
    
    // 查询当前用户的所有好友关系
    const friendships = await Friendship.find({
      $or: [
        { requester: currentUserId },
        { recipient: currentUserId }
      ]
    });
    
    // 构建好友关系映射
    const friendshipMap = {};
    friendships.forEach(friendship => {
      const otherUserId = friendship.requester.toString() === currentUserId 
        ? friendship.recipient.toString() 
        : friendship.requester.toString();
      
      friendshipMap[otherUserId] = {
        status: friendship.status,
        friendshipId: friendship._id,
        isRequester: friendship.requester.toString() === currentUserId
      };
    });
    
    // 为每个用户添加好友状态信息
    const usersWithStatus = users.map(user => {
      const userData = user.toObject();
      const friendship = friendshipMap[user._id.toString()];
      
      if (friendship) {
        userData.friendshipStatus = friendship.status;
        userData.friendshipId = friendship.friendshipId;
        
        // 确定好友关系的显示状态
        if (friendship.status === FRIENDSHIP_STATUS.ACCEPTED) {
          userData.relationshipStatus = '好友';
        } else if (friendship.status === FRIENDSHIP_STATUS.PENDING) {
          userData.relationshipStatus = friendship.isRequester ? '请求已发送' : '等待接受';
        } else if (friendship.status === FRIENDSHIP_STATUS.REJECTED) {
          userData.relationshipStatus = '已拒绝';
        }
      } else {
        userData.friendshipStatus = null;
        userData.relationshipStatus = '非好友';
      }
      
      return userData;
    });
    
    res.status(200).json(usersWithStatus);
  } catch (err) {
    res.status(500).json({ 
      message: '获取用户列表失败', 
      error: err.message 
    });
  }
};

// 获取用户详情
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('_id username avatar createdAt'); // 只返回非敏感信息
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ 
      message: '获取用户信息失败', 
      error: err.message 
    });
  }
};

// 获取好友列表（包含在线状态）
export const getFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    // 查找当前用户的所有已接受的好友关系
    const friendships = await Friendship.find({
      $or: [
        { requester: userId, status: FRIENDSHIP_STATUS.ACCEPTED },
        { recipient: userId, status: FRIENDSHIP_STATUS.ACCEPTED }
      ]
    });
    
    // 提取好友ID列表
    const friendIds = friendships.map(friendship => 
      friendship.requester.toString() === userId 
        ? friendship.recipient 
        : friendship.requester
    );
    
    // 查询好友详细信息
    const friends = await User.find({
      _id: { $in: friendIds }
    }).select('_id username avatar status lastActive');
    
    // 为每个好友添加好友关系ID
    const friendsWithRelationship = friends.map(friend => {
      const friendship = friendships.find(fs => 
        fs.requester.toString() === friend._id.toString() || 
        fs.recipient.toString() === friend._id.toString()
      );
      
      const friendData = friend.toObject();
      friendData.friendshipId = friendship._id;
      
      // 添加在线状态
      friendData.isOnline = friend.status === 'online';
      friendData.lastActive = friend.lastActive;
      
      return friendData;
    });
    
    res.status(200).json(friendsWithRelationship);
  } catch (err) {
    res.status(500).json({ 
      message: '获取好友列表失败', 
      error: err.message 
    });
  }
};

// 搜索用户（包含与当前用户的好友关系状态）
export const searchUsers = async (req, res) => {
  try {
    const { keyword } = req.query;
    const currentUserId = req.user.id;
    
    if (!keyword) {
      return res.status(400).json({ message: '请提供搜索关键词' });
    }
    
    // 使用正则表达式进行模糊搜索
    const users = await User.find({
      _id: { $ne: currentUserId },
      username: { $regex: keyword, $options: 'i' }
    })
      .select('_id username avatar status')
      .limit(20);
    
    // 查询当前用户与搜索结果用户之间的好友关系
    const userIds = users.map(user => user._id);
    const friendships = await Friendship.find({
      $or: [
        { requester: currentUserId, recipient: { $in: userIds } },
        { recipient: currentUserId, requester: { $in: userIds } }
      ]
    });
    
    // 构建好友关系映射
    const friendshipMap = {};
    friendships.forEach(friendship => {
      const otherUserId = friendship.requester.toString() === currentUserId 
        ? friendship.recipient.toString() 
        : friendship.requester.toString();
      
      friendshipMap[otherUserId] = {
        status: friendship.status,
        friendshipId: friendship._id,
        isRequester: friendship.requester.toString() === currentUserId
      };
    });
    
    // 为每个用户添加好友状态信息
    const usersWithStatus = users.map(user => {
      const userData = user.toObject();
      const friendship = friendshipMap[user._id.toString()];
      
      if (friendship) {
        userData.friendshipStatus = friendship.status;
        userData.friendshipId = friendship.friendshipId;
        
        // 确定好友关系的显示状态
        if (friendship.status === FRIENDSHIP_STATUS.ACCEPTED) {
          userData.relationshipStatus = '好友';
        } else if (friendship.status === FRIENDSHIP_STATUS.PENDING) {
          userData.relationshipStatus = friendship.isRequester ? '请求已发送' : '等待接受';
        } else if (friendship.status === FRIENDSHIP_STATUS.REJECTED) {
          userData.relationshipStatus = '已拒绝';
        }
      } else {
        userData.friendshipStatus = null;
        userData.relationshipStatus = '非好友';
      }
      
      // 添加在线状态
      userData.isOnline = user.status === 'online';
      
      return userData;
    });
    
    res.status(200).json(usersWithStatus);
  } catch (err) {
    res.status(500).json({ 
      message: '搜索用户失败', 
      error: err.message 
    });
  }
};