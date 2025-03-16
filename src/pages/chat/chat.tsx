import React, { useState, useEffect } from 'react';
import '../../index.css';
import AddFriend from '../friends/addFriend';
import PendingFriendRequests from '../friends/agreeFriend';
import { getFriendsAPI, Friend } from '../../apis/friendship';
import { sendMessageAPI, getMessagesAPI, Message } from '@/apis/chatapi';



const Chat: React.FC = () => {
    const [showAddFriend, setShowAddFriend] = useState(false);
    const [showFriendRequests, setShowFriendRequests] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [showContacts, setShowContacts] = useState(true);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const currentUserId = localStorage.getItem('id') || "";
    const [chatWithUserId, setChatWithUserId] = useState(""); // 初始为空字符串

    // 获取好友列表
    useEffect(() => {
        const fetchFriends = async () => {
            try {
                setLoading(true);
                const response = await getFriendsAPI();
                console.log('获取好友响应:', response); // 添加日志查看响应

                // 修改判断逻辑，适应后端返回格式
                if (response && response.data) {
                    setFriends(response.data);
                } else {
                    console.error('获取好友列表失败:', response?.message || '未知错误');
                }
            } catch (error) {
                console.error('获取好友列表出错:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFriends();
    }, []);

    // 检测屏幕尺寸
    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth < 640) {
                setShowSidebar(false);
                setShowContacts(false);
            } else if (window.innerWidth < 1024) {
                setShowSidebar(true);
                setShowContacts(false);
            } else {
                setShowSidebar(true);
                setShowContacts(true);
            }
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // 处理点击加号按钮
    const handleAddFriendClick = () => {
        console.log("加号按钮被点击");
        setShowAddFriend(true);
    };

    // 关闭添加好友弹窗
    const handleCloseAddFriend = () => {
        setShowAddFriend(false);
    };

    // 处理点击好友请求图标
    const handleFriendRequestsClick = () => {
        console.log("好友请求图标被点击");
        setShowFriendRequests(true);
    };

    // 关闭好友请求弹窗
    const handleCloseFriendRequests = () => {
        setShowFriendRequests(false);
    };

    // 切换侧边栏显示
    const toggleSidebar = () => {
        setShowSidebar(!showSidebar);
    };

    // 切换联系人列表显示
    const toggleContacts = () => {
        setShowContacts(!showContacts);
    };

    // 处理点击好友
    const handleFriendClick = (friendId: string) => {
        setChatWithUserId(friendId);
    };

    // 加载聊天记录
    useEffect(() => {
        async function loadMessages() {
            if (!chatWithUserId) return; // 如果没有选择聊天对象，则不加载消息
            
            try {
                // 获取双向消息
                const sent = await getMessagesAPI({
                    sender: currentUserId,
                    receiver: chatWithUserId
                });
                
                const received = await getMessagesAPI({
                    sender: chatWithUserId,
                    receiver: currentUserId
                });
                
                console.log("发送的消息:", sent);
                console.log("接收的消息:", received);
                
                // 检查 API 返回的数据结构
                let sentMessages: any[] = []; // 明确指定类型为 any[]
                if (Array.isArray(sent)) {
                    sentMessages = sent;
                } else if (sent && typeof sent === 'object' && 'data' in sent && Array.isArray((sent as any).data)) {
                    sentMessages = (sent as any).data;
                }
                
                let receivedMessages: any[] = []; // 明确指定类型为 any[]
                if (Array.isArray(received)) {
                    receivedMessages = received;
                } else if (received && typeof received === 'object' && 'data' in received && Array.isArray((received as any).data)) {
                    receivedMessages = (received as any).data;
                }
                
                // 合并并排序
                const allMessages = [...sentMessages, ...receivedMessages].sort(
                    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                
                console.log("合并后的消息:", allMessages);
                setMessages(allMessages);
            } catch (error) {   
                console.error("加载消息失败:", error);
            }
        }
        
        loadMessages();
    }, [currentUserId, chatWithUserId]);

    // 发送新消息
    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;

        try {
            const result = await sendMessageAPI({
                receiver: chatWithUserId,
                content: newMessage
            });

            // 添加新消息到列表
            const newMsg: Message = {
                id: result.messageId,
                sender: currentUserId,
                receiver: chatWithUserId,
                content: newMessage,
                createdAt: new Date().toISOString()
            };

            setMessages([...messages, newMsg]);
            setNewMessage(''); // 清空输入框
        } catch (error) {
            console.error("发送消息失败:", error);
        }
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100 transition-all duration-300 overflow-hidden">
            {/* 移动端菜单按钮 - 仅当侧边栏隐藏时显示 */}
            {isMobile && !showSidebar && (
                <button
                    onClick={toggleSidebar}
                    className="fixed top-4 right-2 z-50 w-10 h-10 rounded-full bg-white/70 shadow-md
                              flex items-center justify-center text-indigo-600"
                >
                    ☰
                </button>
            )}

            {/* 左侧导航栏 */}
            {showSidebar && (
                <div className={`${isMobile ? 'fixed left-0 top-0 bottom-0 z-40' : ''} 
                                w-16 md:w-20 bg-white/70 backdrop-blur-md shadow-lg flex flex-col items-center py-6
                                border-r border-indigo-100/50 transition-all duration-300`}>
                    {/* 关闭按钮 - 仅在移动端显示 */}
                    {isMobile && (
                        <button
                            onClick={toggleSidebar}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-indigo-50
                                      flex items-center justify-center text-indigo-500"
                        >
                            ✕
                        </button>
                    )}

                    {/* 头像 */}
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full 
                                  flex items-center justify-center text-white mt-10
                                  transform transition-all duration-300 hover:scale-110 hover:shadow-lg 
                                  hover:shadow-indigo-200 cursor-pointer">
                        <span className="text-lg md:text-xl font-semibold">Me</span>
                    </div>

                    <div className="w-full px-4 mt-6">
                        <div className="h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent opacity-70"></div>
                    </div>

                    <div className="flex flex-col items-center space-y-6 mt-6">
                        {['chat', 'users', 'bell', 'settings'].map((icon, index) => (
                            <div key={icon}
                                onClick={
                                    icon === 'users' ? toggleContacts :
                                        icon === 'bell' ? handleFriendRequestsClick :
                                            undefined
                                }
                                className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center
                                          transform transition-all duration-300 hover:scale-110
                                          cursor-pointer shadow-sm hover:shadow-md
                                          ${index === 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-white/50 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                title={
                                    icon === 'chat' ? '聊天' :
                                        icon === 'users' ? '联系人' :
                                            icon === 'bell' ? '好友请求' :
                                                '设置'
                                }
                            >
                                {icon === 'bell' ? '🔔' : icon[0].toUpperCase()}
                            </div>
                        ))}
                    </div>

                    <div className="mt-auto w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/50 flex items-center justify-center
                                  transform transition-all duration-300 hover:bg-red-50 hover:text-red-500
                                  cursor-pointer shadow-sm hover:shadow-md text-gray-500 mb-6">
                        <span>X</span>
                    </div>
                </div>
            )}

            {/* 联系人列表 */}
            {showContacts && (
                <div className={`${isMobile ? 'fixed left-16 md:left-20 top-0 bottom-0 z-30' : ''} 
                                w-64 md:w-72 bg-white/70 backdrop-blur-md p-4 shadow-lg
                                transform transition-all duration-300 hover:shadow-xl
                                border-r border-indigo-100/50`}>
                    {/* 仅在移动端显示关闭按钮 */}
                    {isMobile && (
                        <button
                            onClick={toggleContacts}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-indigo-50
                                      flex items-center justify-center text-indigo-500"
                        >
                            ✕
                        </button>
                    )}

                    <div className="flex items-center justify-between mb-6 pb-3 border-b border-indigo-100">
                        <h2 className="text-xl md:text-2xl font-bold text-indigo-600
                                     transition-all duration-300 hover:text-indigo-800">
                            联系人
                        </h2>
                        <button
                            onClick={handleAddFriendClick}
                            className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center
                                      text-indigo-500 cursor-pointer hover:bg-indigo-100 transition-colors duration-200
                                      transform hover:scale-110 active:scale-95"
                        >
                            +
                        </button>
                    </div>

                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder="搜索..."
                            className="w-full p-2 pl-8 rounded-lg bg-white/50 backdrop-blur-sm
                                     shadow-sm outline-none border border-indigo-100/50
                                     transition-all duration-300
                                     focus:shadow-md focus:border-indigo-300
                                     placeholder:text-gray-400 text-sm"
                        />
                        <span className="absolute left-2.5 top-2.5 text-gray-400 text-sm">🔍</span>
                    </div>

                    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-180px)] pr-1
                                  scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent">
                        {loading ? (
                            <div className="flex justify-center items-center py-10">
                                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin"></div>
                            </div>
                        ) : friends.length > 0 ? (
                            friends.map((friend, index) => (
                                <div key={friend.id}
                                    onClick={() => handleFriendClick(friend.id)}
                                    className={`flex items-center p-3 rounded-xl cursor-pointer
                                              transform transition-all duration-200
                                              hover:translate-x-1 hover:shadow-md
                                              group ${friend.id === chatWithUserId ? 'bg-indigo-50/80' : 'bg-white/50 hover:bg-indigo-50/60'}`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center
                                                  text-white font-medium mr-3 shadow-sm
                                                  ${friend.id === chatWithUserId ? 'bg-indigo-500' : 'bg-indigo-400'}
                                                  group-hover:bg-indigo-500 transition-colors duration-200`}>
                                        {friend.username ? friend.username[0] : '?'}
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">{friend.username || '未知用户'}</span>
                                        <p className="text-xs text-gray-500">
                                            {index === 0 ? '正在输入...' : index % 2 === 0 ? '在线' : '5分钟前'}
                                        </p>
                                    </div>
                                    {friend.id === chatWithUserId && (
                                        <div className="ml-auto w-2 h-2 rounded-full bg-indigo-500"></div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-500">
                                暂无好友，点击上方"+"添加好友
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 聊天窗口 */}
            <div className={`flex-1 bg-white/60 backdrop-blur-sm p-4 md:p-6 ${isMobile ? 'ml-0' : (showContacts ? 'ml-0' : 'ml-0')}
                          ${isMobile ? 'm-0' : 'm-4'} rounded-2xl shadow-lg
                          transition-all duration-300 relative flex flex-col`}>
                {/* 聊天头部 */}
                <div className="flex items-center justify-between mb-4 md:mb-6 pb-3 border-b border-indigo-100">
                    <div className="flex items-center">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-indigo-500 flex items-center justify-center
                                      text-white font-medium mr-3 md:mr-4 shadow-md">
                            A
                        </div>
                        <div>
                            <h2 className="text-lg md:text-xl font-bold text-indigo-700">Alice</h2>
                            <p className="text-xs md:text-sm text-indigo-400">正在输入...</p>
                        </div>
                    </div>
                    <div className="flex space-x-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center
                                      text-indigo-500 cursor-pointer hover:bg-indigo-100 transition-colors duration-200">
                            📞
                        </div>
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center
                                      text-indigo-500 cursor-pointer hover:bg-indigo-100 transition-colors duration-200">

                        </div>
                    </div>
                </div>

                {/* 聊天消息 */}
                <div className="flex-1 space-y-4 overflow-y-auto pr-2 mb-4
                              scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent">
                    <div className="text-center">
                        <span className="text-xs bg-indigo-100 text-indigo-500 px-2 py-1 rounded-full">今天</span>
                    </div>
                    
                    <div className="space-y-4">
                        {messages.length > 0 ? (
                            messages.map(msg => (
                                <div 
                                    key={msg._id || msg.id} 
                                    className={`flex ${msg.sender === currentUserId ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`p-3 rounded-2xl ${msg.sender === currentUserId 
                                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-sm' 
                                        : 'bg-white rounded-tl-sm'} 
                                        max-w-[75%] md:max-w-md shadow-md
                                        transform transition-all duration-200
                                        hover:-translate-y-1 hover:shadow-lg`}
                                    >
                                        <p>{msg.content}</p>
                                        <small className={`text-xs ${msg.sender === currentUserId ? 'text-indigo-100' : 'text-gray-400'}`}>
                                            {new Date(msg.createdAt).toLocaleString()}
                                        </small>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-500">
                                暂无消息记录
                            </div>
                        )}
                    </div>
                </div>

                {/* 输入区域 */}
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 shadow-md border border-indigo-100/50">
                    <div className="flex items-center space-x-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center
                                      text-indigo-500 cursor-pointer hover:bg-indigo-100 transition-colors duration-200">
                            😊
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center
                                      text-indigo-500 cursor-pointer hover:bg-indigo-100 transition-colors duration-200">
                            📎
                        </div>
                    </div>
                    <div className="flex space-x-2 md:space-x-4">
                        <input
                            type="text"
                            placeholder="输入消息..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            className="flex-1 p-2 md:p-3 rounded-lg bg-white/70
                                     outline-none border border-indigo-100/50
                                     transition-all duration-300
                                     focus:border-indigo-300
                                     placeholder:text-gray-400 text-sm md:text-base"
                        />
                        <button
                            className={`px-4 md:px-6 rounded-lg text-white shadow-md
                                     transform transition-all duration-300
                                     hover:shadow-lg hover:scale-105
                                     active:scale-95 ${newMessage.trim() ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-indigo-300 cursor-not-allowed'}`}
                            disabled={!newMessage.trim()}
                            onClick={handleSendMessage}
                        >
                            发送
                        </button>
                    </div>
                </div>
            </div>

            {/* 添加好友弹窗 */}
            {showAddFriend && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50
                              animate-fadeIn">
                    <div className="bg-white/90 backdrop-blur-md w-[95%] md:w-[90%] max-w-5xl h-[90%] rounded-2xl shadow-2xl
                                  overflow-hidden animate-scaleIn">
                        <div className="flex h-full">
                            <AddFriend onClose={handleCloseAddFriend} />
                        </div>
                    </div>
                </div>
            )}

            {/* 好友请求弹窗 */}
            {showFriendRequests && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50
                              animate-fadeIn">
                    <div className="bg-white/90 backdrop-blur-md w-[95%] md:w-[90%] max-w-4xl h-[90%] rounded-2xl shadow-2xl
                                  overflow-hidden animate-scaleIn">
                        <div className="flex h-full">
                            <PendingFriendRequests
                                onClose={handleCloseFriendRequests}
                                onAccept={(userId) => {
                                    console.log("接受了用户ID为", userId, "的好友请求");
                                    // 这里可以添加接受好友后的逻辑，比如刷新联系人列表等
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Chat;
