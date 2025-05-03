import express from 'express';
import { 
  register, 
  login, 
  getAllUsers, 
  getUserById,
  searchUsers,
  refreshToken
  // ... 其他控制器方法
} from '../controllers/userController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
// 示例 Swagger 配置
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API 文档',
      version: '1.0.0',
    },
  },
  // 确保这里包含了所有路由文件
  apis: ['./src/routes/*.js'],
};

// 公开路由
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken); // 刷新 token 的路由

// 需要认证的路由
router.get('/all', auth, getAllUsers); // 获取所有用户
router.get('/search', auth, searchUsers); // 搜索用户
router.get('/:userId', auth, getUserById); // 获取特定用户详情

export default router;