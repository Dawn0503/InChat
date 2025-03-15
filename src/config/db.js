import mongoose from 'mongoose'; // 导入 mongoose 库，用于连接 MongoDB
import dotenv from 'dotenv'; // 导入 dotenv 库，用于加载环境变量

dotenv.config(); // 加载 .env 文件中的环境变量

// 定义连接数据库的异步函数
const connectDB = async () => {
  try {
    // 尝试连接到 MongoDB 数据库
    await mongoose.connect(process.env.MONGO_URI, {
      // useNewUrlParser: true, // 使用新的 URL 解析器
      // useUnifiedTopology: true, // 使用统一的拓扑结构
    });
    console.log('MongoDB connected'); // 连接成功时输出信息
  } catch (err) {
    // 捕获连接错误并输出错误信息
    console.error('MongoDB connection error:', err);
    process.exit(1); // 退出进程
  }
};

export default connectDB; // 导出连接数据库的函数