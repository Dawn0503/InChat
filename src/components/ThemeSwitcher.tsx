import React, { useState, useEffect } from 'react';
import themeService, { ThemeType } from '../services/themeService';

const ThemeSwitcher: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(themeService.getCurrentTheme());
  
  useEffect(() => {
    // 监听主题变化事件
    // CustomEvent 是一种用于创建自定义事件的接口，可以携带额外的数据。
    // 它不是 React 自带的，而是原生 JavaScript 的一部分。
    const handleThemeChange = (e: CustomEvent) => {
      setCurrentTheme(e.detail.theme);
    };
    
    document.addEventListener('themeChanged', handleThemeChange as EventListener);
    
    return () => {
      document.removeEventListener('themeChanged', handleThemeChange as EventListener);
    };
  }, []);
  
  const themes: { type: ThemeType; name: string; icon: string }[] = [
    { type: 'light', name: '浅色', icon: '☀️' },
    { type: 'dark', name: '深色', icon: '🌙' },
    { type: 'pink', name: '粉色', icon: '🌸' },
    { type: 'blue', name: '蓝色', icon: '🌊' }
  ];
  
  return (
    <div className="theme-switcher">
      <div className="flex flex-col items-center space-y-2">
        {themes.map((theme) => (
          <button
            key={theme.type}
            onClick={() => themeService.setTheme(theme.type)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
                      ${currentTheme === theme.type 
                        ? 'bg-primary text-white shadow-theme transform scale-110' 
                        : 'bg-card text-theme hover:bg-primary/10'}`}
            title={theme.name}
          >
            {theme.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeSwitcher; 