import express from 'express';
import { sendMessage, getMessages } from '../controllers/messageController.js';
import { auth } from '../middleware/auth.js';
import cors from 'cors';

const router = express.Router();

router.post('/', auth, (req, res, next) => {
  console.log('收到 POST 请求到 /api/messages');
  console.log('请求头:', req.headers);
  console.log('请求体:', req.body);
  next();
}, sendMessage);
router.get('/', auth, getMessages);

const app = express();
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*'
}));

export default router;