import React, { useState, useEffect, useRef } from 'react';
import '../../index.css';
import AddFriend from '../friends/addFriend';
import PendingFriendRequests from '../friends/agreeFriend';
import { getFriendsAPI, Friend } from '../../apis/friendship';
import { sendMessageAPI, getMessagesAPI, Message, getUserStatusAPI, UserStatusInfo } from '@/apis/chatapi';
import { io, Socket } from 'socket.io-client';
import getWebSocketService from '../../services/websocketService';
import ThemeSwitcher from '../../components/ThemeSwitcher';
// getLocalCachedMessages 从本地存储获取缓存的消息
// cacheMessages 缓存消息, 确保能在刷新离线后访问，获取消息后使用
// setupNetworkListeners 在 useEffect 中设置网络状态监听器
// isOnline 检查网络状态
import { cacheMessages, setupNetworkListeners, isOnline, getLocalCachedMessages } from '@/services/serviceWorkerRegistration';
import { KeepAlive, KeepAliveProvider } from '../../components/KeepAlive';

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
    const socketRef = useRef<Socket | null>(null);
    const [userStatus, setUserStatus] = useState<UserStatusInfo | null>(null);
    // 这里使用 !navigator.onLine 是为了初始化 isOffline 状态，表示当前是否处于离线状态
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [offlineNotice, setOfflineNotice] = useState(false);

    // 添加消息容器的引用，用于自动滚动到最新消息
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 使用单例模式获取WebSocket服务
    const websocketService = useRef(getWebSocketService());

    const [chatPerformance, setChatPerformance] = useState<{ [key: string]: number }>({});

    // 计时器用于测量性能
    const timerRef = useRef<number>(0);

    // 在组件挂载时连接WebSocket
    useEffect(() => {
        console.log('Chat组件挂载，连接WebSocket');

        // 确保只连接一次, isConnected 检查连接状态
        if (!websocketService.current.isConnected()) {
            websocketService.current.
                connect();
        }

        // 组件卸载时不断开连接，让其他页面可以继续使用
        return () => {
            console.log('Chat组件卸载');
            // 不在这里断开连接，保持全局单例
        };
    }, []);

    // 获取好友列表
    useEffect(() => {
        const fetchFriends = async () => {
            try {
                setLoading(true);
                const response = await getFriendsAPI();
                console.log('获取好友响应:', response); // 添加日志查看响应

                // 直接使用响应数据
                if (Array.isArray(response)) { // 检查是否为数组
                    setFriends(response); // 直接设置好友列表
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

    // 修改好友点击处理函数，加入性能测量
    const handleFriendClick = (friendId: string) => {
        timerRef.current = performance.now();
        setChatWithUserId(friendId);

        // 在渲染完成后计算时间差
        setTimeout(() => {
            const renderTime = performance.now() - timerRef.current;
            setChatPerformance(prev => ({
                ...prev,
                [friendId]: renderTime
            }));
            console.log(`聊天室切换耗时: ${renderTime.toFixed(2)}ms`);
        }, 0);
    };

    // 处理网络状态变化
    useEffect(() => {
        // 初始化网络状态
        setIsOffline(!navigator.onLine);

        // 设置网络状态监听器
        const cleanup = setupNetworkListeners(
            // 上线回调
            () => {
                setIsOffline(false);
                setOfflineNotice(false);
            },
            // 离线回调
            () => {
                setIsOffline(true);
                setOfflineNotice(true);
                // 3秒后自动隐藏提示
                setTimeout(() => setOfflineNotice(false), 3000);
            }
        );
        // 返回清理函数
        return cleanup;
    }, []);

    // 修改加载聊天记录的逻辑，更好地支持离线模式
    useEffect(() => {
        async function loadMessages() {
            if (!chatWithUserId) return; // 如果没有选择聊天对象，则不加载消息

            try {
                // 先尝试从 API 获取消息
                if (isOnline()) {
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

                    // 合并与去重
                    const allMessages = [...sentMessages, ...receivedMessages]
                        .filter((msg, index, self) =>
                            index === self.findIndex((m) => m._id === msg._id) // 根据消息ID去重
                        )
                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                    console.log("合并后的消息:", allMessages);
                    setMessages(allMessages);

                    // 确保消息被缓存
                    cacheMessages(allMessages, currentUserId, chatWithUserId);
                } else {
                    console.log("离线模式：尝试从缓存加载消息");

                    // 尝试从 Service Worker 缓存获取消息
                    try {
                        const sent = await getMessagesAPI({
                            sender: currentUserId,
                            receiver: chatWithUserId
                        });

                        const received = await getMessagesAPI({
                            sender: chatWithUserId,
                            receiver: currentUserId
                        });

                        // 如同在线模式一样处理消息
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

                        // 合并与去重
                        const allMessages = [...sentMessages, ...receivedMessages]
                            .filter((msg, index, self) =>
                                index === self.findIndex((m) => m._id === msg._id) // 根据消息ID去重
                            )
                            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                        console.log("合并后的消息:", allMessages);
                        setMessages(allMessages);

                        // 确保消息被缓存
                        cacheMessages(allMessages, currentUserId, chatWithUserId);
                    } catch (error) {
                        console.error("从 Service Worker 获取缓存失败:", error);

                        // 如果 Service Worker 缓存失败，尝试从本地存储获取
                        const localCachedMessages = getLocalCachedMessages(currentUserId, chatWithUserId);
                        console.log("从本地存储获取缓存消息:", localCachedMessages);

                        if (localCachedMessages.length > 0) {
                            setMessages(localCachedMessages);
                        }
                    }
                }

            } catch (error) {
                console.error("加载消息失败:", error);

                // 尝试从本地存储获取
                const localCachedMessages = getLocalCachedMessages(currentUserId, chatWithUserId);
                if (localCachedMessages.length > 0) {
                    setMessages(localCachedMessages);
                }
            }
        }

        loadMessages();
    }, [currentUserId, chatWithUserId]);

    // 使用 Socket.IO 建立实时通信连接
    useEffect(() => {
        // 从本地存储获取用户认证令牌
        const token = localStorage.getItem('token'); // 从浏览器本地存储中获取登录令牌

        // 创建与服务器的 Socket.IO 连接
        // io() 是 Socket.IO 客户端库的主要函数，用于建立连接
        socketRef.current = io('http://localhost:3006', {
            transports: ['websocket'], // 指定使用 WebSocket 协议进行通信
            autoConnect: true,         // 自动连接到服务器
            auth: {
                token: token           // 提供认证令牌用于身份验证
            },
            query: {
                userId: currentUserId  // 在连接查询参数中提供用户ID，便于服务器识别用户
            }
        });

        // 监听连接成功事件
        // 当与服务器成功建立连接时触发
        socketRef.current.on('connect', () => {
            console.log("Socket.IO 连接已建立");

            // 连接后发送额外的认证信息
            // emit() 方法用于向服务器发送自定义事件
            socketRef.current?.emit('authenticate', {
                token: localStorage.getItem('token'),
                userId: currentUserId
            });
        });

        // 监听新消息事件
        // 当服务器发送 'new_message' 事件时，客户端接收并处理新消息
        socketRef.current.on('new_message', (newMessage: Message) => {
            console.log("接收到新消息:", newMessage);
            // 将新消息添加到现有消息列表中
            setMessages(prevMessages => [...prevMessages, newMessage]);
        });

        // 添加用户状态更新事件监听    (1
        socketRef.current.on('user_status_update', (statusData: UserStatusInfo) => {
            console.log("接收到用户状态更新:", statusData);
            // 只更新当前聊天对象的状态
            if (statusData.userId === chatWithUserId) {
                setUserStatus(statusData);
            }
        });

        // 监听连接错误事件
        // 当连接出现问题时触发
        socketRef.current.on('connect_error', (error) => {
            console.error("Socket.IO 连接错误:", error);
        });

        // 监听断开连接事件
        // 当与服务器的连接断开时触发
        socketRef.current.on('disconnect', (reason) => {
            console.log("Socket.IO 断开连接:", reason);
        });

        // 返回清理函数
        // 当组件卸载时执行，确保正确关闭 Socket 连接，防止内存泄漏
        return () => {
            socketRef.current?.disconnect();
        };
    }, [currentUserId]); // 依赖项：当用户ID变化时重新建立连接

    // 在组件挂载时连接WebSocket，并在卸载时断开
    // useEffect(() => {
    //     // 连接WebSocket
    //     websocketService.current.connect();

    //     // 组件卸载时断开连接
    //     return () => {
    //         websocketService.current.disconnect();
    //     };
    // }, []);

    // // 当聊天对象变更时，订阅其状态
    // useEffect(() => {
    //     if (!chatWithUserId) return;

    //     // 状态更新回调
    //     const handleStatusUpdate = (statusData: UserStatusInfo) => {
    //         console.log("通过WebSocket收到用户状态更新:", statusData);
    //         setUserStatus(statusData);
    //     };

    //     // 订阅状态
    //     // 使用 websocketService.current 将会访问 useRef 引用的当前值
    //     // 如果 websocketService 是通过 useRef 创建的引用对象，.current 属性用于访问该引用指向的实际值
    //     // 但在当前代码中，websocketService 似乎是一个服务单例，而不是 useRef 引用，所以不需要 .current
    //     console.log('订阅前用户状态',chatWithUserId);
    //     websocketService.current.registerStatusListener(chatWithUserId, handleStatusUpdate);
    //     console.log('订阅用户状态',chatWithUserId);
         
    //     // 初始获取一次状态
    //     fetchUserStatus();

    //     // 清理函数：取消订阅
    //     return () => {
    //         console.log('取消订阅用户状态');
    //         websocketService.current.unregisterStatusListener(chatWithUserId);
    //     };
    // }, [chatWithUserId]);

    // // 保留现有的fetchUserStatus函数用于初始获取
    // const fetchUserStatus = useCallback(async () => {
    //     if (!chatWithUserId) {
    //         console.log('没有选择聊天对象，不获取状态');
    //         return;
    //     }

    //     console.log('正在获取用户状态，用户ID:', chatWithUserId);

    //     try {
    //         const response = await getUserStatusAPI(chatWithUserId);
    //         console.log('获取到的用户状态响应:', response);

    //         if (response.success && response.data) {
    //             setUserStatus(response.data);
    //             console.log('设置用户状态为:', response.data);
    //         }
    //     } catch (error) {
    //         console.error('获取用户状态失败:', error);
    //     }
    // }, [chatWithUserId]);

    // 修改发送消息的函数，确保接收消息内容作为参数
    const handleSendMessage = async (content?: string) => {
        const messageContent = content || newMessage;  // 使用传入的内容或输入框中的内容
        if (!messageContent.trim() || !chatWithUserId) return;  // 验证消息内容和聊天对象

        try {
            // 调用 API 发送消息
            const response = await sendMessageAPI({
                receiver: chatWithUserId,
                content: messageContent
            });
            // 创建消息对象
            const messageObj = {
                sender: currentUserId,
                receiver: chatWithUserId,
                content: messageContent,
                createdAt: new Date().toISOString()
            };

            // 先更新本地UI，提供即时反馈
            setMessages(prev => [...prev, {
                ...messageObj,
                id: Date.now().toString() // 临时ID
            }]);
            console.log("发送消息响应:", response);
            // 清空输入框
            setNewMessage('');
        } catch (error) {
            console.error("发送消息失败:", error);
        }
    };

    // 处理按Enter键发送消息
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {  // Enter键发送，Shift+Enter换行
            e.preventDefault();
            handleSendMessage();
        }
    };

    // 添加自动滚动到最新消息的函数
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // 当消息列表更新时，滚动到底部
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 在Chat组件的顶部声明区域添加状态
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [messageText, setMessageText] = useState('');

    // 添加退出登录函数
    const handleLogout = () => {
        // 清除本地存储中的token和用户信息
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('id');
        // 跳转到登录页面
        window.location.href = '/login';
    };

    // 在组件挂载时检查登录状态
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            // 未登录，跳转到登录页面
            window.location.href = '/login';
        }
    }, []);

    return (
        // 使用 KeepAliveProvider 包裹整个组件，以启用缓存功能 
        // max={10} 表示最多缓存10个组件
        <KeepAliveProvider max={10}>
            <div className="flex h-screen bg-theme transition-all duration-300 overflow-hidden">
                {/* 离线提示 */}
                {offlineNotice && (
                    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fadeIn">
                        您已进入离线模式，仍可查看已缓存的聊天记录
                    </div>
                )}

                {/* 网络状态指示器 - 始终显示在角落 */}
                <div className={`fixed bottom-4 right-4 z-40 w-3 h-3 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500'}`}></div>



                {/* 左侧导航栏 */}
                {showSidebar && (
                    <div className={`${isMobile ? 'fixed left-0 top-0 bottom-0 z-40' : ''} 
                                    w-16 md:w-20 bg-card/70 backdrop-blur-md shadow-theme flex flex-col items-center py-6
                                    border-r border-theme transition-all duration-300`}>
                        {/* 关闭按钮 - 仅在移动端显示 */}
                        {isMobile && (
                            <button
                                onClick={toggleSidebar}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/10
                                          flex items-center justify-center text-primary"
                            >
                                ✕
                            </button>
                        )}

                        {/* 头像 */}
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary flex items-center justify-center
                                      text-white font-medium mb-8 shadow-theme overflow-hidden">
                            {/* 用户头像或首字母 */}
                            U
                        </div>

                        {/* 导航图标 */}
                        <div className="flex-1 flex flex-col items-center space-y-6">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center
                                          text-primary cursor-pointer hover:bg-primary/20 transition-colors duration-200">
                                💬
                            </div>
                            {/* <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center
                                          text-theme cursor-pointer hover:bg-primary/10 transition-colors duration-200">
                                👥
                            </div> */}
                            <button
                                onClick={handleFriendRequestsClick}
                                className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                              text-primary hover:bg-primary/20 transition-colors duration-200"
                            >
                                🔔
                            </button>
                            <button
                                onClick={handleAddFriendClick}
                                className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                              text-primary hover:bg-primary/20 transition-colors duration-200"
                            >
                                ➕
                            </button>
                            <div
                                onClick={handleLogout}
                                className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center
                                          text-red-500 cursor-pointer hover:bg-red-200 transition-colors duration-200"
                                title="退出登录"
                            >
                                🚪
                            </div>
                        </div>

                        {/* 主题切换器 */}
                        <div className="mt-6 mb-4">
                            <ThemeSwitcher />
                        </div>

                        {/* 设置图标--装饰用 */}
                        <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center
                                      text-theme cursor-pointer hover:bg-primary/10 transition-colors duration-200">
                            ⚙️
                        </div>
                    </div>
                )}

                {/* 联系人列表 */}
                {showContacts && (
                    <div className={`${isMobile ? 'fixed left-0 top-0 bottom-0 z-30' : ''} 
                                    w-full sm:w-72 md:w-80 lg:w-96 bg-card/80 backdrop-blur-md
                                    border-r border-theme transition-all duration-300
                                    flex flex-col`}>
                        {/* 联系人列表头部 */}
                        <div className="p-4 border-b border-theme flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-theme">联系人</h2>
                            <div className="flex space-x-2">
                                {/* <button
                                    onClick={handleFriendRequestsClick}
                                    className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                              text-primary hover:bg-primary/20 transition-colors duration-200"
                                >
                                    🔔
                                </button>
                                <button
                                    onClick={handleAddFriendClick}
                                    className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                              text-primary hover:bg-primary/20 transition-colors duration-200"
                                >
                                    ➕
                                </button> */}
                                {isMobile && (
                                    <button
                                        onClick={toggleContacts}
                                        className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                                  text-primary hover:bg-primary/20 transition-colors duration-200"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 联系人搜索 */}
                        <div className="p-4">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="搜索联系人..."
                                    className="w-full p-2 pl-8 rounded-lg bg-card border border-theme
                                             text-theme placeholder-theme/50 focus:outline-none focus:border-primary"
                                />
                                <span className="absolute left-2.5 top-2.5 text-theme/50">
                                    🔍
                                </span>
                            </div>
                        </div>

                        {/* 联系人列表 */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex justify-center items-center h-32">
                                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : friends.length > 0 ? (
                                <div className="space-y-1 p-2">
                                    {friends.map((friend) => (
                                        <div
                                            key={friend.id}
                                            onClick={() => handleFriendClick(friend.id)}
                                            className={`p-3 rounded-lg flex items-center space-x-3 cursor-pointer
                                                      transition-all duration-200 ${chatWithUserId === friend.id
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'hover:bg-card text-theme'
                                                }`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-primary/80 flex items-center justify-center
                                                          text-white font-medium overflow-hidden">
                                                {friend.avatar ? (
                                                    <img src={friend.avatar} alt={friend.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    friend.username[0].toUpperCase()
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center">
                                                    <h3 className="font-medium truncate">{friend.username}</h3>
                                                    <span className="text-xs opacity-70">12:34</span>
                                                </div>
                                                <p className="text-sm opacity-70 truncate">
                                                    {/* 最后一条消息预览 */}
                                                    最近没有消息
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-32 text-theme/50">
                                    <div className="text-4xl mb-2">👥</div>
                                    <p>暂无联系人</p>
                                    <button
                                        onClick={handleAddFriendClick}
                                        className="mt-2 px-3 py-1 text-sm rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                                    >
                                        添加好友
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 聊天区域 */}
                <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
                    {/* 聊天头部 */}
                    {chatWithUserId ? (
                        <div className="bg-card/70 backdrop-blur-sm rounded-xl p-4 shadow-theme border border-theme flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                                {isMobile && !showContacts && (
                                    <button
                                        onClick={toggleContacts}
                                        className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                                  text-primary hover:bg-primary/20 transition-colors duration-200 mr-2"
                                    >
                                        ◀
                                    </button>
                                )}
                                <div className="w-10 h-10 rounded-full bg-primary/80 flex items-center justify-center
                                              text-white font-medium overflow-hidden">
                                    {friends.find(friend => friend.id === chatWithUserId)?.avatar ? (
                                        <img src={friends.find(friend => friend.id === chatWithUserId)?.avatar} alt={friends.find(friend => friend.id === chatWithUserId)?.username} className="w-full h-full object-cover" />
                                    ) : (
                                        friends.find(friend => friend.id === chatWithUserId)?.username[0].toUpperCase() || '?'
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-medium text-theme">
                                        {friends.find(friend => friend.id === chatWithUserId)?.username || '未选择联系人'}
                                    </h3>
                                    <p className="text-xs text-theme/70">
                                        {userStatus ? (
                                            userStatus.status === 'online' ? '在线' :
                                                userStatus.status === 'offline' ? '离线' :
                                                    userStatus.status === 'away' ? '离开' : '忙碌'
                                        ) : '状态未知'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                {isOffline && (
                                    <div className="flex items-center text-xs text-red-500 mr-2">
                                        <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                                        离线模式
                                    </div>
                                )}
                                {/* <button className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                                  text-primary hover:bg-primary/20 transition-colors duration-200">
                                    📞
                                </button>
                                <button className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                                  text-primary hover:bg-primary/20 transition-colors duration-200">
                                    📹
                                </button> */}
                                {/* <button className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                                  text-primary hover:bg-primary/20 transition-colors duration-200">
                                    ⋮
                                </button> */}
                                                {/* 移动端菜单按钮 - 仅当侧边栏隐藏时显示 */}
                {isMobile && !showSidebar && (
                    <button
                        onClick={toggleSidebar}
                        className="fixed top-4 right-2 z-50 w-10 h-10 rounded-full bg-card shadow-theme
                                  flex items-center justify-center text-primary"
                    >
                        ☰
                    </button>
                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card/70 backdrop-blur-sm rounded-xl p-4 shadow-theme border border-theme">
                            <div className="flex items-center">
                                {isMobile && !showContacts && (
                                    <button
                                        onClick={toggleContacts}
                                        className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                                  text-primary hover:bg-primary/20 transition-colors duration-200 mr-2"
                                    >
                                        ◀
                                    </button>
                                )}
                                <h3 className="font-medium text-theme">选择一个联系人开始聊天</h3>
                            </div>
                        </div>
                    )}

                    {/* 消息区域 - 使用 KeepAlive */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {chatWithUserId ? (
                            <KeepAlive id={`chat-${chatWithUserId}`}>
                                <div className="flex-1 overflow-y-auto p-2 space-y-4 max-h-[calc(100vh-300px)]">
                                    {/* 添加视觉指示 - 显示组件创建时间 */}
                                    <div className="sticky top-0 bg-yellow-100 p-2 text-xs text-center rounded-md mb-2 z-10">
                                        {`组件创建于: ${new Date().toLocaleTimeString()}`}
                                        <br />
                                        {`消息数量: ${messages.length}`}
                                    </div>

                                    {messages.length > 0 ? (
                                        messages.map((msg, index) => (
                                            <div
                                                key={msg.id || index}
                                                className={`flex ${msg.sender === currentUserId ? 'justify-end' : 'justify-start'}`}
                                            >
                                                {/* 消息气泡 */}
                                                <div
                                                    className={`max-w-[80%] md:max-w-[70%] rounded-lg px-4 py-2 shadow-theme
                                                              ${msg.sender === currentUserId
                                                            ? 'bg-primary text-white rounded-br-none'
                                                            : 'bg-card text-theme rounded-bl-none border border-theme'}`}
                                                >
                                                    {msg.content}
                                                    <div
                                                        className={`text-xs mt-1 
                                                                  ${msg.sender === currentUserId
                                                                ? 'text-white/70'
                                                                : 'text-theme/50'}`}
                                                    >
                                                        {new Date(msg.createdAt).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 text-theme/50">
                                            暂无消息记录
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            </KeepAlive>
                        ) : (
                            <div className="text-center py-10 text-theme/50">
                                暂无消息记录
                            </div>
                        )}
                    </div>

                    {/* 添加性能显示 (可选) */}
                    {chatWithUserId && chatPerformance[chatWithUserId] && (
                        <div className="text-xs text-theme/50 text-right">
                            切换耗时: {chatPerformance[chatWithUserId].toFixed(2)}ms
                        </div>
                    )}

                    {/* 输入区域 */}
                    <div className="bg-card/70 backdrop-blur-sm rounded-xl p-3 shadow-theme border border-theme">
                        <div className="flex items-center space-x-2 mb-2">
                            <div
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                          text-primary cursor-pointer hover:bg-primary/20 transition-colors duration-200 relative"
                            >
                                😊
                                {showEmojiPicker && (
                                    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-lg p-2 w-64 h-48 overflow-y-auto z-10">
                                        <div className="grid grid-cols-8 gap-1">
                                            {[
                                                '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
                                                '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
                                                '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
                                                '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
                                                '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
                                                '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
                                                '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
                                                '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥'
                                            ].map((emoji, index) => (
                                                <div
                                                    key={index}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMessageText(prev => prev + emoji);
                                                        setShowEmojiPicker(false);
                                                    }}
                                                    className="w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-gray-100 rounded"
                                                >
                                                    {emoji}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
                                          text-primary cursor-pointer hover:bg-primary/20 transition-colors duration-200">
                                📎
                            </div> */}
                        </div>

                        <div className="flex items-center">
                            <textarea
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                placeholder="输入消息..."
                                className="flex-1 p-2 rounded-xl bg-white/50 backdrop-blur-sm
                                         min-h-[60px] max-h-32 shadow-sm outline-none border border-theme/30
                                         transition-all duration-300
                                         focus:shadow-md focus:border-primary
                                         placeholder:text-gray-400 resize-none"
                            ></textarea>
                            <button
                                onClick={() => {
                                    // 处理发送消息逻辑
                                    if (messageText.trim()) {
                                        // 这里调用发送消息的函数
                                        handleSendMessage(messageText);
                                        setMessageText('');
                                    }
                                }}
                                className="ml-2 px-4 py-4 rounded-xl bg-primary/80 text-white
                                         shadow-sm hover:bg-primary transition-all duration-200
                                         transform hover:scale-105 active:scale-95 flex items-center justify-center"
                            >
                                <span>发送</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 添加好友弹窗 */}
                {showAddFriend && (
                    <div className="fixed inset-0 bg-theme/30 backdrop-blur-sm flex items-center justify-center z-50
                                  animate-fadeIn">
                        <div className="bg-card/90 backdrop-blur-md w-[95%] md:w-[90%] max-w-5xl h-[90%] rounded-2xl shadow-theme
                                      overflow-hidden animate-scaleIn border border-theme">
                            <div className="flex h-full">
                                <AddFriend onClose={handleCloseAddFriend} />
                            </div>
                        </div>
                    </div>
                )}

                {/* 好友请求弹窗 */}
                {showFriendRequests && (
                    <div className="fixed inset-0 bg-theme/30 backdrop-blur-sm flex items-center justify-center z-50
                                  animate-fadeIn">
                        <div className="bg-card/90 backdrop-blur-md w-[95%] md:w-[90%] max-w-4xl h-[90%] rounded-2xl shadow-theme
                                      overflow-hidden animate-scaleIn border border-theme">
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
        </KeepAliveProvider>
    );
};

export default Chat;
