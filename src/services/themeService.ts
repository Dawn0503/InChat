// 定义可用的主题类型
export type ThemeType = 'light' | 'dark' | 'pink' | 'blue';

// 主题服务类
class ThemeService {
  private static instance: ThemeService;
  private currentTheme: ThemeType = 'light';
  private readonly STORAGE_KEY = 'app_theme';
  
  // 单例模式
  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }
  
  // 私有构造函数
  private constructor() {
    this.loadThemeFromStorage();
  }
  
  // 从本地存储加载主题
  private loadThemeFromStorage(): void {
    try {
      const savedTheme = localStorage.getItem(this.STORAGE_KEY) as ThemeType;
      if (savedTheme) {
        this.setTheme(savedTheme); // 默认情况下，保存到本地存储
      } else {
        // 如果没有保存的主题，检查系统偏好
        this.checkSystemPreference();
      }
    } catch (error) {
      console.error('加载主题失败:', error);
    }
  }
  
  // 检查系统颜色偏好
  private checkSystemPreference(): void {
    // 检查系统颜色偏好，使用 matchMedia API 判断用户的颜色模式偏好
    // matchMedia 是一个用于检测媒体查询的 API，允许我们根据不同的条件（如屏幕尺寸、方向或颜色模式）来应用不同的样式。
    // matches 属性返回一个布尔值，指示当前文档是否匹配指定的媒体查询。
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        // 通过 matchMedia API，浏览器可以检测用户的系统主题偏好设置
      this.setTheme('dark', false);
    }
  }
  
  // 设置主题
  public setTheme(theme: ThemeType, saveToStorage: boolean = true): void {
    this.currentTheme = theme;
    // 设置根元素的 data-theme 属性为当前主题，以便在 CSS 中使用该属性进行样式调整
    // setAttribute 方法用于设置指定元素的属性及其值，这里将根元素的 data-theme 属性设置为当前主题，以便在 CSS 中使用该属性进行样式调整。
    document.documentElement.setAttribute('data-theme', theme);
    
    // 添加对应的类名到 body，用于组件主题穿透
    document.body.className = '';
    // 双重保障： date-theme 控制全局， theme-${theme} 控制组件作用域
    // document.body.classList.add(`theme-${theme}`);
    
    // 保存到本地存储
    if (saveToStorage) {
      localStorage.setItem(this.STORAGE_KEY, theme);
    }
    
    // 触发自定义事件，通知应用主题已更改
    // 创建一个自定义事件对象，并将其 detail 属性设置为当前主题
    const event = new CustomEvent('themeChanged', { detail: { theme } });
    // 触发自定义事件，通知应用主题已更改
    document.dispatchEvent(event);
  }
  
  // 获取当前主题
  public getCurrentTheme(): ThemeType {
    return this.currentTheme;
  }
  
  // 切换到下一个主题
  public toggleTheme(): void {
    const themes: ThemeType[] = ['light', 'dark', 'pink', 'blue'];
    const currentIndex = themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setTheme(themes[nextIndex]);
  }
}

export default ThemeService.getInstance(); 