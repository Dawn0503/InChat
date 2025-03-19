import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  updateStatus,
  getUserStatus,
  getManyUsersStatus
} from '../controllers/userStatusController.js';

const router = express.Router();

// 获取单个用户状态
router.get('/:userId/status', auth, getUserStatus);

// 更新用户状态
router.put('/status', auth, updateStatus);

// 批量获取用户状态
router.post('/status/batch', auth, getManyUsersStatus);

export default router; 