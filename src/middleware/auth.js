import jwt from 'jsonwebtoken';

export const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1]; // 获取 Bearer token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // 将解码后的用户信息添加到请求对象
    next();
  } catch (error) {
    return res.status(401).json({ message: '认证失败' });
  }
}; 