// 导入必要的依赖和API
import React, { useState, useEffect } from 'react';
import '../../index.css';
import { getAllUsersAPI, User, sendFriendRequestAPI } from '@/apis/friendship';

// 定义组件Props接口
interface AddFriendProps {
  onClose?: () => void;
}

// AddFriend组件定义
const AddFriend: React.FC<AddFriendProps> = ({ onClose }) => {
  // 状态管理
  const [searchTerm, setSearchTerm] = useState(''); // 搜索关键词
  const [selectedUser, setSelectedUser] = useState<User | null>(null); // 选中的用户
  const [allUsers, setAllUsers] = useState<User[]>([]); // 所有用户列表
  const [loading, setLoading] = useState(true); // 加载状态
  const [error, setError] = useState(''); // 错误信息
  const [sending, setSending] = useState(false); // 发送好友请求状态
  const [sendSuccess, setSendSuccess] = useState(false); // 发送成功状态
  
  // 获取所有用户的副作用
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await getAllUsersAPI();
        console.log("API 响应:", response); // 调试日志

        // 直接使用响应数据
        if (Array.isArray(response) && response.length > 0) {
          setAllUsers(response); // 直接设置用户列表
          setError(''); // 清除之前的错误信息
        } else {
          // 处理"操作成功"的特殊情况
          if (response.message === '操作成功') {
            setAllUsers(response.data || []);
            setError('');
          } else {
            setError(response.message || '获取用户列表失败');
          }
        }
      } catch (err) {
        setError('获取用户列表时发生错误');
        console.error('获取用户列表错误:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);
  
  // 根据搜索词过滤用户列表
  const filteredUsers = allUsers.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // 处理发送好友请求
  const handleSendFriendRequest = async () => {
    if (!selectedUser) return;
    
    try {
      setSending(true);
      const response = await sendFriendRequestAPI(selectedUser._id);
      if (response.code === 0) {
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 3000);
        
        // 更新用户的关系状态
        setAllUsers(prevUsers => 
          prevUsers.map(user => 
            user._id === selectedUser._id 
              ? {...user, relationshipStatus: "请求已发送"} 
              : user
          )
        );
      } else {
        // 处理"操作成功"的特殊情况
        if (response.message === '操作成功') {
          setSendSuccess(true);
          setTimeout(() => setSendSuccess(false), 3000);
          
          // 更新用户的关系状态
          setAllUsers(prevUsers => 
            prevUsers.map(user => 
              user._id === selectedUser._id 
                ? {...user, relationshipStatus: "请求已发送"} 
                : user
            )
          );
        } else {
          setError(response.message || '发送好友请求失败');
        }
      }
    } catch (err) {
      setError('发送好友请求时发生错误');
      console.error('发送好友请求错误:', err);
    } finally {
      setSending(false);
    }
  };
  
  // 渲染组件UI
  return (
    <div className="flex w-full">
      {/* 左侧用户列表面板 */}
      <div className="w-72 bg-white/70 backdrop-blur-md p-4 shadow-lg
                    border-r border-indigo-100/50">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-indigo-100">
          <h2 className="text-2xl font-bold text-indigo-600
                       transition-all duration-300 hover:text-indigo-800">
            添加好友
          </h2>
          <div 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center
                      text-indigo-500 cursor-pointer hover:bg-indigo-100 transition-colors duration-200
                      transform hover:scale-110 active:scale-95"
          >
            ✕
          </div>
        </div>
        
        {/* 搜索框 */}
        <div className="relative mb-4">
          <input 
            type="text" 
            placeholder="搜索用户..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 pl-8 rounded-lg bg-white/50 backdrop-blur-sm
                     shadow-sm outline-none border border-indigo-100/50
                     transition-all duration-300
                     focus:shadow-md focus:border-indigo-300
                     placeholder:text-gray-400 text-sm"
          />
          <div className="absolute left-2.5 top-2.5 text-gray-400">
            🔍
          </div>
        </div>
        
        {/* 用户列表显示区域 */}
        {loading ? (
          // 加载中状态
          <div className="flex justify-center items-center py-10">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          // 错误状态
          <div className="text-center py-10 text-red-500">
            {error}
          </div>
        ) : filteredUsers.length === 0 ? (
          // 无搜索结果状态
          <div className="text-center py-10 text-gray-500">
            没有找到匹配的用户
          </div>
        ) : (
          // 用户列表
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
            {filteredUsers.map(user => (
              <div 
                key={user._id}
                onClick={() => setSelectedUser(user)}
                className={`p-3 rounded-xl cursor-pointer transition-all duration-200
                          ${selectedUser?._id === user._id 
                            ? 'bg-indigo-100 shadow-md' 
                            : 'hover:bg-indigo-50 bg-white/50'}`}
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-indigo-400 flex items-center justify-center
                                text-white font-medium mr-3 shadow-sm overflow-hidden">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      user.username[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-800">{user.username}</h3>
                    <p className="text-xs text-gray-500">{user.relationshipStatus || "非好友"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 右侧用户详情面板 */}
      <div className="flex-1 p-6 flex items-center justify-center">
        {selectedUser ? (
          <>
            <div className="max-w-md w-full space-y-6">
              {/* 用户头像和基本信息 */}
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-indigo-500 flex items-center justify-center
                              text-white text-4xl font-medium mb-4 shadow-lg overflow-hidden">
                  {selectedUser.avatar ? (
                    <img src={selectedUser.avatar} alt={selectedUser.username} className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.username[0].toUpperCase()
                  )}
                </div>
                <h2 className="text-2xl font-bold text-indigo-700">{selectedUser.username}</h2>
                <p className="text-sm text-gray-500">{selectedUser.relationshipStatus || "非好友"}</p>
                
                {/* 添加好友按钮 */}
                <div className="mt-6">
                  {sendSuccess ? (
                    <div className="px-6 py-2 bg-green-500 text-white rounded-lg shadow-md">
                      请求已发送 ✓
                    </div>
                  ) : (
                    <button 
                      onClick={handleSendFriendRequest}
                      disabled={sending || selectedUser.relationshipStatus === "已是好友"}
                      className={`px-6 py-2 rounded-lg text-white shadow-md
                                transform transition-all duration-300
                                hover:shadow-lg hover:scale-105
                                active:scale-95 ${
                                  selectedUser.relationshipStatus === "已是好友" 
                                  ? 'bg-gray-400 cursor-not-allowed' 
                                  : sending 
                                    ? 'bg-indigo-300 cursor-wait' 
                                    : 'bg-indigo-500 hover:bg-indigo-600'
                                }`}
                    >
                      {selectedUser.relationshipStatus === "已是好友" 
                        ? '已是好友' 
                        : sending 
                          ? '发送中...' 
                          : '添加好友'}
                    </button>
                  )}
                </div>
              </div>
              
              {/* 用户详细信息卡片 */}
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-5 shadow-md border border-indigo-100/50">
                <h3 className="text-lg font-semibold text-indigo-700 mb-4">用户信息</h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">用户ID</p>
                    <p className="text-gray-700 break-all">{selectedUser._id}</p>
                  </div>
                  
                  {selectedUser.createdAt && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">注册时间</p>
                      <p className="text-gray-700">{new Date(selectedUser.createdAt).toLocaleString('zh-CN')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          // 未选择用户时的提示界面
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center
                          text-indigo-300 text-4xl mb-4">
              👥
            </div>
            <p className="text-xl">选择一个用户查看详细资料</p>
            <p className="text-sm mt-2">你可以添加新朋友来扩展你的社交圈</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddFriend;
