import User from '../models/User.js';

// 获取用户状态
export async function getUserStatus(req, res) {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: '用户不存在'
      });
    }

    return res.status(200).json({
      userId: user._id,
      status: user.status || 'offline',
      lastActive: user.lastActive,
      // 如果需要其他字段，可以在这里添加
    });
  } catch (error) {
    console.error('获取用户状态失败:', error);
    return res.status(500).json({ 
      message: '获取用户状态失败',
      error: error.message 
    });
  }
}

// 更新用户状态
export async function updateStatus(req, res) {
  try {
    const userId = req.user.id;
    const { status } = req.body;

    // 验证状态值
    const validStatuses = ['online', 'offline', 'away'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: '无效的状态值' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        status,
        lastActive: new Date()
      },
      { new: true }
    );

    // 通过 Socket.IO 广播状态变更
    const io = req.app.get('io');
    io.emit('user_status_change', {
      userId: user._id,
      status: user.status
    });

    return res.status(200).json({
      message: '状态更新成功',
      status: user.status
    });
  } catch (error) {
    console.error('更新状态失败:', error);
    return res.status(500).json({ 
      message: '更新状态失败',
      error: error.message 
    });
  }
}

// 批量获取用户状态
export async function getManyUsersStatus(req, res) {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ 
        message: 'userIds必须是数组' 
      });
    }

    const users = await User.find({
      _id: { $in: userIds }
    }).select('_id status lastActive');

    return res.status(200).json(users);
  } catch (error) {
    console.error('批量获取用户状态失败:', error);
    return res.status(500).json({ 
      message: '获取用户状态失败',
      error: error.message 
    });
  }
} 