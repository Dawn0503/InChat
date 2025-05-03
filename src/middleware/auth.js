import jwt from 'jsonwebtoken'; // 导入 jsonwebtoken 库，用于处理 JWT（JSON Web Token）

// 认证中间件，检查请求中的 token 是否有效
export const auth = async (req, res, next) => {
  let token;
  
  // 从请求头中获取 token，格式为 "Bearer <token>"
  // startsWith 是一个字符串方法，用于判断字符串是否以指定的子字符串开头。
  // 在这里，我们检查请求头中的 authorization 字段是否存在，并且是否以 'Bearer' 开头。
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]; // 提取 token
  }
  
  // 检查 token 是否存在
  if (!token) {
    return res.status(401).json({ message: '未授权，无访问令牌' }); // 如果没有 token，返回 401 状态
  }
  
  try {
    // 验证 token 的有效性
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // 解码 token
    req.user = decoded; // 将解码后的用户信息存储在请求对象中
    next(); // 继续处理请求
  } catch (error) {
    console.log('Token 验证错误:', error.name, error.message); // 记录错误信息
    
    // 关键：当 token 过期时，返回 401 状态码和明确的错误信息
    // TokenExpiredError 是 jsonwebtoken 库中定义的错误类型
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token 已过期', // 返回过期信息
        error: error.message 
      });
    }
    
    return res.status(401).json({ 
      message: 'Token 无效', // 返回无效 token 信息
      error: error.message 
    });
  }
};

// 导出原来的 auth 函数以保持兼容性
export { auth as protect }; 