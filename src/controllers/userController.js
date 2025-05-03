import jwt from 'jsonwebtoken'; // 导入 jsonwebtoken 库，用于生成 JWT（JSON Web Token）
import User from '../models/User.js'; // 导入用户模型，用于与用户数据交互
import Friendship, { FRIENDSHIP_STATUS } from '../models/Friendship.js'; // 导入好友关系模型和状态常量

// 用户注册 API
export const register = async (req, res) => {
  try {
    const { username, password } = req.body; // 从请求体中获取用户名和密码

    // 检查用户名是否已存在
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ message: '用户名已存在' }); // 如果用户名已存在，返回 400 状态和错误信息
    }

    // 创建新用户
    const user = new User({
      username,
      password,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, // 使用 DiceBear API 生成头像
      status: 'online', // 默认状态为在线
      lastActive: new Date() // 记录用户最后活跃时间
    });

    // 保存用户到数据库
    await user.save();

    // 生成 access token
    const accessToken = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '3d' }
    );

    
    // 生成 refresh token
    const refreshToken = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
      { expiresIn: '7d' }
    );

    // 返回用户信息和两种 token
    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ message: '注册失败', error: err.message }); // 返回 500 状态和错误信息
  }
};

// 用户登录 API
export const login = async (req, res) => {
  try {
    const { username, password } = req.body; // 从请求体中获取用户名和密码

    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' }); // 如果用户不存在，返回 401 状态和错误信息
    }

    // 验证密码
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: '用户名或密码错误' }); // 如果密码不匹配，返回 401 状态和错误信息
    }

    // 更新用户状态为在线
    user.status = 'online';
    user.lastActive = new Date(); // 更新最后活跃时间
    await user.save();

    const accessToken = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '3d' } // 确保这里是 1 分钟
    );

    // 生成 refresh token (长期有效，如 7 天)
    const refreshToken = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
      { expiresIn: '7d' }
    );

    // 返回用户信息和两种 token
    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ message: '登录失败', error: err.message }); // 返回 500 状态和错误信息
  }
};

// 获取所有用户（包含与当前用户的好友关系状态）API
export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id; // 获取当前用户的 ID
    
    // 查询除了当前用户以外的所有用户
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select('_id username avatar createdAt') // 只选择需要的字段
      .sort({ username: 1 }); // 按用户名排序
    
    // 查询当前用户的所有好友关系
    const friendships = await Friendship.find({
      $or: [
        { requester: currentUserId }, // 当前用户是请求者
        { recipient: currentUserId } // 当前用户是接收者
      ]
    });
    
    // 构建好友关系映射
    const friendshipMap = {};
    friendships.forEach(friendship => {
      const otherUserId = friendship.requester.toString() === currentUserId 
        ? friendship.recipient.toString() // 如果当前用户是请求者，获取接收者 ID
        : friendship.requester.toString(); // 否则获取请求者 ID
      
      friendshipMap[otherUserId] = {
        status: friendship.status, // 好友关系状态
        friendshipId: friendship._id, // 好友关系 ID
        isRequester: friendship.requester.toString() === currentUserId // 判断当前用户是否是请求者
      };
    });
    
    // 为每个用户添加好友状态信息
    const usersWithStatus = users.map(user => {
      const userData = user.toObject(); // 将用户数据转换为普通对象
      const friendship = friendshipMap[user._id.toString()]; // 获取该用户的好友关系
      
      if (friendship) {
        userData.friendshipStatus = friendship.status; // 添加好友关系状态
        userData.friendshipId = friendship.friendshipId; // 添加好友关系 ID
        
        // 确定好友关系的显示状态
        if (friendship.status === FRIENDSHIP_STATUS.ACCEPTED) {
          userData.relationshipStatus = '好友'; // 好友
        } else if (friendship.status === FRIENDSHIP_STATUS.PENDING) {
          userData.relationshipStatus = friendship.isRequester ? '请求已发送' : '等待接受'; // 请求已发送或等待接受
        } else if (friendship.status === FRIENDSHIP_STATUS.REJECTED) {
          userData.relationshipStatus = '已拒绝'; // 已拒绝
        }
      } else {
        userData.friendshipStatus = null; // 没有好友关系
        userData.relationshipStatus = '非好友'; // 非好友
      }
      
      return userData; // 返回用户数据
    });
    
    res.status(200).json(usersWithStatus); // 返回用户列表，状态码为 200（成功）
  } catch (err) {
    res.status(500).json({ 
      message: '获取用户列表失败', 
      error: err.message // 返回错误信息
    });
  }
};

// 获取用户详情 API
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params; // 从请求参数中获取用户 ID
    
    const user = await User.findById(userId)
      .select('_id username avatar createdAt'); // 只返回非敏感信息
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' }); // 如果用户不存在，返回 404 状态和错误信息
    }
    
    res.status(200).json(user); // 返回用户信息，状态码为 200（成功）
  } catch (err) {
    res.status(500).json({ 
      message: '获取用户信息失败', 
      error: err.message // 返回错误信息
    });
  }
};

// 获取好友列表（包含在线状态）API
export const getFriends = async (req, res) => {
  try {
    const userId = req.user.id; // 获取当前用户的 ID

    // 查找当前用户的所有已接受的好友关系
    const friendships = await Friendship.find({
      $or: [
        { requester: userId, status: FRIENDSHIP_STATUS.ACCEPTED }, // 当前用户是请求者且状态为已接受
        { recipient: userId, status: FRIENDSHIP_STATUS.ACCEPTED } // 当前用户是接收者且状态为已接受
      ]
    });
    
    // 提取好友ID列表
    const friendIds = friendships.map(friendship => 
      friendship.requester.toString() === userId 
        ? friendship.recipient // 如果当前用户是请求者，获取接收者 ID
        : friendship.requester // 否则获取请求者 ID
    );
    
    // 查询好友详细信息
    const friends = await User.find({
      _id: { $in: friendIds } // 查找 ID 在好友列表中的用户
    }).select('_id username avatar status lastActive'); // 只选择需要的字段
    
    // 为每个好友添加好友关系ID
    const friendsWithRelationship = friends.map(friend => {
      const friendship = friendships.find(fs => 
        fs.requester.toString() === friend._id.toString() || 
        fs.recipient.toString() === friend._id.toString() // 查找好友关系
      );
      
      const friendData = friend.toObject(); // 将好友数据转换为普通对象
      friendData.friendshipId = friendship._id; // 添加好友关系 ID
      
      // 添加在线状态
      friendData.isOnline = friend.status === 'online'; // 判断好友是否在线
      friendData.lastActive = friend.lastActive; // 记录好友最后活跃时间
      
      return friendData; // 返回好友数据
    });
    
    res.status(200).json(friendsWithRelationship); // 返回好友列表，状态码为 200（成功）
  } catch (err) {
    res.status(500).json({ 
      message: '获取好友列表失败', 
      error: err.message // 返回错误信息
    });
  }
};

// 搜索用户（包含与当前用户的好友关系状态）API
export const searchUsers = async (req, res) => {
  try {
    const { keyword } = req.query; // 从查询参数中获取搜索关键词
    const currentUserId = req.user.id; // 获取当前用户的 ID
    
    if (!keyword) {
      return res.status(400).json({ message: '请提供搜索关键词' }); // 如果没有提供关键词，返回 400 状态和错误信息
    }
    
    // 使用正则表达式进行模糊搜索
    const users = await User.find({
      _id: { $ne: currentUserId }, // 排除当前用户
      username: { $regex: keyword, $options: 'i' } // 模糊匹配用户名
    })
      .select('_id username avatar status') // 只选择需要的字段
      .limit(20); // 限制返回的用户数量为 20
    
    // 查询当前用户与搜索结果用户之间的好友关系
    const userIds = users.map(user => user._id); // 获取搜索结果用户的 ID
    const friendships = await Friendship.find({
      $or: [
        { requester: currentUserId, recipient: { $in: userIds } }, // 当前用户是请求者
        { recipient: currentUserId, requester: { $in: userIds } } // 当前用户是接收者
      ]
    });
    
    // 构建好友关系映射
    const friendshipMap = {};
    friendships.forEach(friendship => {
      const otherUserId = friendship.requester.toString() === currentUserId 
        ? friendship.recipient.toString() // 如果当前用户是请求者，获取接收者 ID
        : friendship.requester.toString(); // 否则获取请求者 ID
      
      friendshipMap[otherUserId] = {
        status: friendship.status, // 好友关系状态
        friendshipId: friendship._id, // 好友关系 ID
        isRequester: friendship.requester.toString() === currentUserId // 判断当前用户是否是请求者
      };
    });
    
    // 为每个用户添加好友状态信息
    const usersWithStatus = users.map(user => {
      const userData = user.toObject(); // 将用户数据转换为普通对象
      const friendship = friendshipMap[user._id.toString()]; // 获取该用户的好友关系
      
      if (friendship) {
        userData.friendshipStatus = friendship.status; // 添加好友关系状态
        userData.friendshipId = friendship.friendshipId; // 添加好友关系 ID
        
        // 确定好友关系的显示状态
        if (friendship.status === FRIENDSHIP_STATUS.ACCEPTED) {
          userData.relationshipStatus = '好友'; // 好友
        } else if (friendship.status === FRIENDSHIP_STATUS.PENDING) {
          userData.relationshipStatus = friendship.isRequester ? '请求已发送' : '等待接受'; // 请求已发送或等待接受
        } else if (friendship.status === FRIENDSHIP_STATUS.REJECTED) {
          userData.relationshipStatus = '已拒绝'; // 已拒绝
        }
      } else {
        userData.friendshipStatus = null; // 没有好友关系
        userData.relationshipStatus = '非好友'; // 非好友
      }
      
      // 添加在线状态
      userData.isOnline = user.status === 'online'; // 判断用户是否在线
      
      return userData; // 返回用户数据
    });
    
    res.status(200).json(usersWithStatus); // 返回用户列表，状态码为 200（成功）
  } catch (err) {
    res.status(500).json({ 
      message: '搜索用户失败', 
      error: err.message // 返回错误信息
    });
  }
};

// 刷新 token 的控制器
export const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: '缺少刷新令牌' });
  }

  try {
    // 验证 refresh token
    const decoded = jwt.verify(
      refreshToken, 
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh'
    );
    
    // 查找用户
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(403).json({ message: '用户不存在' });
    }

    // 生成新的 access token
    // jwt.sign 是用于生成 JSON Web Token 的方法，它接受三个参数：要编码的 payload、密钥和选项。这里我们生成一个 access token。
    const accessToken = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '3d' }
    );

    // 返回新的 access token
    return res.json({ accessToken });
  } catch (error) {
    console.error('刷新 token 错误:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        message: '刷新令牌已过期，请重新登录',
        error: error.message 
      });
    }
    
    return res.status(403).json({ 
      message: '无效的刷新令牌',
      error: error.message 
    });
  }
};