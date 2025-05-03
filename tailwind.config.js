// 配置 Tailwind CSS 的内容路径
module.exports = {
  content: [
    // 指定页面组件的路径
    './src/pages/**/*.tsx', // 这里包含所有页面组件的路径
    // 指定通用组件的路径
    './src/components/**/*.tsx', // 这里包含所有通用组件的路径
    // 指定布局组件的路径
    './src/layouts/**/*.tsx', // 这里包含所有布局组件的路径
  ],
  theme: {
    extend: {
      colors: {
        // 将 Tailwind类映射到CSS变量
        primary: 'var(--primary-color)', // 主色使用 CSS 变量
        'primary-light': 'var(--primary-light)', // 主色的浅色变体
        'primary-dark': 'var(--primary-dark)', // 主色的深色变体
        'theme-text': 'var(--text-color)', // 主题文本颜色
        'theme-bg': 'var(--bg-color)', // 主题背景颜色
        'theme-card': 'var(--card-bg)', // 主题卡片背景颜色
        'theme-border': 'var(--border-color)', // 主题边框颜色
      },
      backgroundColor: {
        theme: 'var(--bg-color)', // 主题背景颜色
        card: 'var(--card-bg)', // 卡片背景颜色
      },
      textColor: {
        theme: 'var(--text-color)', // 主题文本颜色
      },
      borderColor: {
        theme: 'var(--border-color)', // 主题边框颜色
      },
      boxShadow: {
        theme: '0 4px 6px var(--shadow-color)', // 主题阴影效果
      },
    },
  },
  plugins: [], // 插件配置，当前没有使用任何插件
}












// var 的作用：
// 这里的 var(--primary-color) 是 CSS 变量引用
// 表示这些颜色值由外部 CSS 文件（themes.css）动态定义，而非硬编码
// Tailwind 会将这些变量转换为实际的工具类。
// var 是 配置声明，仅在构建阶段被 Tailwind 使用。










