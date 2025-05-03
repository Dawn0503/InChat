import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
// 导入主题进而形成编译结果，
// 编译结果就会有这些变量了，这个文件会根据主题的变化而变化
import './index.css'; // 引入 Tailwind CSS
import Chat from './pages/chat/chat'; // 引入 Chat 组件
import Login from './pages/login/login'; // 引入 Login 组件
import IndexPage from './pages/index'; // 引入首页组件
import themeService from './services/themeService'; // 引入主题服务
import { registerServiceWorker } from './services/serviceWorkerRegistration';

// 确保主题服务在应用启动时初始化
themeService.getCurrentTheme(); // 这会触发从本地存储加载主题

// 注册 Service Worker
registerServiceWorker();

// 简单的路由组件
const App = () => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  
  useEffect(() => {
    // 监听路由变化
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    // 添加监听器
    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      // 移除监听器
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);
  
  // 根据路径渲染相应的组件
  let component;
  switch (currentPath) {
    case '/':
      component = <IndexPage />;
      break;
    case '/login':
      component = <Login />;
      break;
    case '/chat':
      component = <Chat />;
      break;
    default:
      component = <IndexPage />;
  }
  
  return component;
};

// 使用现代的 createRoot API
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
