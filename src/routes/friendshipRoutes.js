import express from 'express';
import { 
  sendFriendRequest, 
  acceptFriendRequest, 
  rejectFriendRequest, 
  getFriends,
  getPendingRequests,
  removeFriend
} from '../controllers/friendshipController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// 发送好友请求
router.post('/request', auth, sendFriendRequest);

// 接受好友请求
router.put('/accept/:requestId', auth, acceptFriendRequest);

// 拒绝好友请求
router.put('/reject/:requestId', auth, rejectFriendRequest);

// 获取好友列表
router.get('/', auth, getFriends);

// 获取待处理的好友请求
router.get('/pending', auth, getPendingRequests);

// 删除好友
router.delete('/:friendId', auth, removeFriend);

export default router;