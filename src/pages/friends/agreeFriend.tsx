import React, { useState, useEffect } from 'react';
import { getPendingFriendRequestsAPI, acceptFriendRequestAPI, rejectFriendRequestAPI } from '@/apis/friendship';

// 定义好友请求发送者的数据结构
interface FriendRequestSender {
  _id: string;         // 发送者的唯一标识ID
  username: string;    // 发送者的用户名
  avatar?: string;     // 发送者的头像URL，可选字段
}

// 定义好友请求的数据结构
interface FriendRequest {
  _id: string;                 // 请求的唯一标识ID
  sender: FriendRequestSender; // 请求发送者的信息
  status: string;              // 请求状态（如pending、accepted、rejected）
  createdAt: string;           // 请求创建时间
}

// 定义组件接收的属性
interface PendingFriendRequestsProps {
  onClose?: () => void;              // 可选的关闭回调函数
  onAccept?: (userId: string) => void; // 可选的接受好友请求回调函数
}

// 定义待处理好友请求组件，使用React函数式组件
const PendingFriendRequests: React.FC<PendingFriendRequestsProps> = ({ onClose, onAccept }) => {
  // 使用useState钩子管理组件状态
  const [requests, setRequests] = useState<FriendRequest[]>([]); // 存储好友请求列表
  const [loading, setLoading] = useState(true);                  // 加载状态
  const [error, setError] = useState('');                        // 错误信息
  const [processingIds, setProcessingIds] = useState<string[]>([]); // 正在处理的请求ID列表
  const [successMessage, setSuccessMessage] = useState('');      // 成功消息

  // 使用useEffect钩子在组件挂载后获取待处理的好友请求
  useEffect(() => {
    // 定义异步函数获取好友请求
    const fetchFriendRequests = async () => {
      try {
        // 设置加载状态为true
        setLoading(true);
        // 调用API获取待处理的好友请求
        const response = await getPendingFriendRequestsAPI();
        console.log('API响应:', response); // 添加日志，查看实际返回数据结构
        
        // 检查API响应是否成功
        if (response.code === 0 || response.message === '操作成功') {
          // 格式化API返回的数据，确保与组件内部使用的数据结构一致
          const formattedData = Array.isArray(response.data) 
            ? response.data.map(req => ({
                _id: req.id || req.id || '',  // 使用请求ID，如果不存在则使用空字符串
                sender: {
                  _id: req.requester?.id || '',  // 使用发送者ID
                  username: req.requester?.username || '未知用户', // 使用发送者用户名，如果不存在则显示"未知用户"
                  avatar: req.requester?.avatar   // 使用发送者头像
                },
                status: req.status || 'pending',  // 使用请求状态，如果不存在则默认为"pending"
                createdAt: req.createdAt || new Date().toISOString() // 使用创建时间，如果不存在则使用当前时间
              }))
            : [];
          
          // 更新请求列表状态
          setRequests(formattedData);
          // 清除错误信息
          setError('');
        } else {
          // 如果API响应不成功，设置错误信息
          setError(response.message || '获取好友请求失败');
        }
      } catch (err) {
        // 捕获并处理异常
        setError('获取好友请求时发生错误');
        console.error('获取好友请求错误:', err);
      } finally {
        // 无论成功还是失败，最终都设置加载状态为false
        setLoading(false);
      }
    };
    
    // 调用获取好友请求的函数
    fetchFriendRequests();
  }, []); // 空依赖数组表示此效果只在组件挂载时运行一次

  // 处理接受好友请求的函数
  const handleAccept = async (requestId: string, userId: string) => {
    try {
      // 将当前处理的请求ID添加到处理中状态
      setProcessingIds(prev => [...prev, requestId]);
      
      // 调用API接受好友请求
      const response = await acceptFriendRequestAPI(requestId);
      
      // 检查API响应是否成功
      if (response.code === 0 || response.message === '操作成功') {
        // 从请求列表中移除已处理的请求
        setRequests(prev => prev.filter(req => req._id !== requestId));
        // 显示成功消息
        setSuccessMessage('已接受好友请求');
        // 3秒后清除成功消息
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // 如果提供了接受回调函数，则调用它
        if (onAccept) {
          onAccept(userId);
        }
      } else {
        // 如果API响应不成功，设置错误信息
        setError(response.message || '接受好友请求失败');
      }
    } catch (err) {
      // 捕获并处理异常
      setError('处理好友请求时发生错误');
      console.error('接受好友请求错误:', err);
    } finally {
      // 无论成功还是失败，从处理中状态移除当前请求ID
      setProcessingIds(prev => prev.filter(id => id !== requestId));
    }
  };

  // 处理拒绝好友请求的函数
  const handleReject = async (requestId: string) => {
    try {
      // 将当前处理的请求ID添加到处理中状态
      setProcessingIds(prev => [...prev, requestId]);
      
      // 调用API拒绝好友请求
      const response = await rejectFriendRequestAPI(requestId);
      
      // 检查API响应是否成功
      if (response.code === 0 || response.message === '操作成功') {
        // 从请求列表中移除已处理的请求
        setRequests(prev => prev.filter(req => req._id !== requestId));
        // 显示成功消息
        setSuccessMessage('已拒绝好友请求');
        // 3秒后清除成功消息
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        // 如果API响应不成功，设置错误信息
        setError(response.message || '拒绝好友请求失败');
      }
    } catch (err) {
      // 捕获并处理异常
      setError('处理好友请求时发生错误');
      console.error('拒绝好友请求错误:', err);
    } finally {
      // 无论成功还是失败，从处理中状态移除当前请求ID
      setProcessingIds(prev => prev.filter(id => id !== requestId));
    }
  };

  // 格式化日期的辅助函数
  const formatDate = (dateString: string) => {
    try {
      // 创建日期对象
      const date = new Date(dateString);
      // 返回格式化后的日期字符串
      return date.toLocaleString('zh-CN', {
        year: 'numeric',    // 显示年份
        month: '2-digit',   // 显示月份（两位数）
        day: '2-digit',     // 显示日期（两位数）
        hour: '2-digit',    // 显示小时（两位数）
        minute: '2-digit'   // 显示分钟（两位数）
      });
    } catch (e) {
      // 如果日期格式化失败，返回默认文本
      return '未知时间';
    }
  };

  // 渲染组件UI
  return (
    <div className="w-full bg-white/70 backdrop-blur-md rounded-xl shadow-lg border border-indigo-100/50 overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-4 border-b border-indigo-100">
        <h2 className="text-xl font-bold text-indigo-600">
          待处理的好友请求
        </h2>
        {/* 如果提供了关闭回调函数，则显示关闭按钮 */}
        {onClose && (
          <div 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center
                      text-indigo-500 cursor-pointer hover:bg-indigo-100 transition-colors duration-200
                      transform hover:scale-110 active:scale-95"
          >
            ✕
          </div>
        )}
      </div>
      
      {/* 成功消息提示 - 当有成功消息时显示 */}
      {successMessage && (
        <div className="m-4 p-2 bg-green-100 text-green-700 rounded-lg text-center">
          {successMessage}
        </div>
      )}
      
      {/* 错误消息提示 - 当有错误信息时显示 */}
      {error && (
        <div className="m-4 p-2 bg-red-100 text-red-700 rounded-lg text-center">
          {error}
        </div>
      )}
      
      {/* 内容区域 */}
      <div className="p-4">
        {loading ? (
          // 加载中状态 - 显示加载动画
          <div className="flex justify-center items-center py-10">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : requests.length === 0 ? (
          // 无请求状态 - 当没有待处理的好友请求时显示
          <div className="text-center py-10 text-gray-500">
            <div className="w-16 h-16 mx-auto mb-4 text-indigo-200 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-12 h-12">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <p className="text-lg">暂无待处理的好友请求</p>
            <p className="text-sm mt-2">当有人向你发送好友请求时，会显示在这里</p>
          </div>
        ) : (
          // 请求列表 - 当有待处理的好友请求时显示
          <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
            {/* 使用map函数遍历请求列表，为每个请求创建一个卡片 */}
            {requests.map(request => (
              <div 
                key={request._id} // 使用请求ID作为React列表项的唯一键
                className="p-4 bg-white rounded-xl shadow-sm border border-indigo-50 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-center">
                  {/* 用户头像 - 如果有头像则显示头像，否则显示用户名首字母 */}
                  <div className="w-12 h-12 rounded-full bg-indigo-400 flex items-center justify-center
                                text-white font-medium mr-4 shadow-sm overflow-hidden">
                    {request.sender.avatar ? (
                      <img src={request.sender.avatar} alt={request.sender.username} className="w-full h-full object-cover" />
                    ) : (
                      request.sender.username[0].toUpperCase()
                    )}
                  </div>
                  
                  {/* 用户信息 - 显示用户名和请求时间 */}
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">{request.sender.username}</h3>
                    <p className="text-xs text-gray-500">
                      请求时间: {formatDate(request.createdAt)}
                    </p>
                  </div>
                </div>
                
                {/* 操作按钮 - 拒绝和接受按钮 */}
                <div className="flex justify-end mt-4 space-x-2">
                  {/* 拒绝按钮 - 点击时调用handleReject函数 */}
                  <button 
                    onClick={() => handleReject(request._id)}
                    disabled={processingIds.includes(request._id)} // 如果请求正在处理中，禁用按钮
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                              ${processingIds.includes(request._id)
                                ? 'bg-gray-200 text-gray-500 cursor-wait' // 处理中的样式
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'}`} // 正常样式
                  >
                    {processingIds.includes(request._id) ? '处理中...' : '拒绝'}
                  </button>
                  {/* 接受按钮 - 点击时调用handleAccept函数 */}
                  <button 
                    onClick={() => handleAccept(request._id, request.sender._id)}
                    disabled={processingIds.includes(request._id)} // 如果请求正在处理中，禁用按钮
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                              ${processingIds.includes(request._id)
                                ? 'bg-indigo-300 text-white cursor-wait' // 处理中的样式
                                : 'bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95'}`} // 正常样式
                  >
                    {processingIds.includes(request._id) ? '处理中...' : '接受'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingFriendRequests;
