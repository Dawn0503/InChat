import React, { useEffect } from 'react';

export default function IndexPage() {
  useEffect(() => {
    // 检查是否已登录
    const token = localStorage.getItem('token');
    
    // 重定向到合适的页面
    if (token) {
      window.location.href = '/chat';
    } else {
      window.location.href = '/login';
    }
  }, []);

  return (
    <div className="h-screen w-full flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-medium text-gray-600">正在加载...</h2>
      </div>
    </div>
  );
}