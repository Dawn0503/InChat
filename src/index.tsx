import React from 'react';
import ReactDOM from 'react-dom';
import './index.css'; // 引入 Tailwind CSS
import Chat from './pages/chat/chat'; // 引入 Chat 组件

ReactDOM.render(
  <React.StrictMode>
    <Chat /> {/* 直接渲染 Chat 组件 */}
  </React.StrictMode>,
  document.getElementById('root') // 确保有一个 id 为 root 的 DOM 元素
);
