// 导入 express 库，用于创建服务器
import express from 'express';
// 导入 cors 库，用于处理跨域请求
import cors from 'cors';
// 导入 dotenv 库，用于加载环境变量
import dotenv from 'dotenv';
// 导入连接数据库的函数
import connectDB from './config/db.js';
// 导入用户路由
import userRoutes from './routes/userRoutes.js'; // 示例路由
// 导入消息路由
import messageRoutes from './routes/messageRoutes.js'; // 消息路由
// 导入 swagger-jsdoc 和 swagger-ui-express
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';
// 导入好友关系路由
import friendshipRoutes from './routes/friendshipRoutes.js';
// 导入用户状态路由
import userStatusRoutes from './routes/userStatusRoutes.js';  // 注意添加 .js 扩展名

// 加载环境变量
dotenv.config();

// 创建 express 应用
const app = express();

// 配置 CORS - 更详细的设置
app.use(cors({
  origin: ['http://localhost:8000', 'http://localhost:3006', '*'],  // 允许这些来源
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // 包括 OPTIONS 请求
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  credentials: true,  // 允许携带凭证
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json()); // 解析 JSON 格式的请求体

// 设置路由
app.use('/api/users', userRoutes); // 用户相关的路由
app.use('/api/messages', messageRoutes); // 消息相关的路由
app.use('/api/friends', friendshipRoutes); // 添加好友关系路由
// 注册用户状态路由
app.use('/api/users', userStatusRoutes);
// 测试路由
app.get('/', (req, res) => {
  res.send('Hello World!'); // 返回测试信息
});

// 连接数据库
connectDB(); // 调用连接数据库的函数

// Swagger 配置选项
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat API',
      version: '1.0.0',
      description: 'API for a chat application',
    },
    servers: [
      {
        url: 'http://localhost:3006',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // 指定路由文件路径
};

// 生成 Swagger 规范
const specs = swaggerJsdoc(options);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 OpenAPI 文档
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));

// 配置 Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  customSiteTitle: "InChat API 文档",
  swaggerOptions: {
    url: "/api-docs/swagger.json",
    defaultModelsExpandDepth: -1,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    // 关键设置：确保使用正确的服务器 URL
    serverUrl: "http://localhost:3006"
  }
}));

// 提供 swagger.json
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocument);
});

// 处理 OPTIONS 请求
app.options('*', cors()); // 允许所有路由的 OPTIONS 请求

// 导出应用
export default app;