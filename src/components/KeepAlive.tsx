import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

// 创建 KeepAlive 上下文，提供缓存、设置缓存和查看缓存状态的功能
/**
 * createContext 用于创建一个 React 上下文，它允许组件树中的任何组件访问共享数据，而不必通过 props 层层传递。
 * 
 * KeepAlive 组件需要创建上下文的原因：
 * 1. 状态共享：允许不同层级的 KeepAlive 组件共享缓存数据
 * 2. 全局管理：提供一个中央位置管理所有被缓存的组件
 * 3. 避免 props 钻取：直接通过 useContext 获取缓存功能，无需通过中间组件传递
 * 4. 解耦合：将缓存逻辑与组件渲染逻辑分离，提高代码可维护性
 */
const KeepAliveContext = createContext<{
  cache: Map<string, any>; // 缓存的 Map 对象
  setCache: (key: string, component: any) => void; // 设置缓存的函数
  cacheStatus: () => Record<string, boolean>; // 返回一个对象，键为缓存名称，值为布尔值表示该缓存是否存在
}>({
  cache: new Map(), // 初始化缓存为一个空的 Map
  setCache: () => {}, // 默认的设置缓存函数
  cacheStatus: () => ({}) // 默认的查看缓存状态函数
});

/**
 * KeepAliveProvider 和 KeepAlive 组件构成了一个完整的状态缓存系统：
 * 
 * 1. KeepAliveProvider：
 *    - 作为顶层容器组件，负责创建和管理全局缓存
 *    - 实现了 LRU (最近最少使用) 缓存策略
 *    - 通过 Context API 向下提供缓存服务
 *    - 控制缓存的最大数量，防止内存泄漏
 * 
 * 2. KeepAlive：
 *    - 作为包装组件，负责单个组件的状态保持
 *    - 使用 KeepAliveProvider 提供的缓存服务
 *    - 在组件卸载时保存状态，在重新挂载时恢复状态
 *    - 维护滚动位置等 UI 状态
 * 
 * 这种设计模式类似于 Vue 的 keep-alive 功能，使得在 React 中也能实现组件状态的持久化，
 * 特别适用于频繁切换的页面或组件，可以避免重复创建和初始化的开销，提升用户体验。
 */

/**
 * React.FC 是 React 中的类型定义，代表 "Function Component"（函数组件）。
 * 它是 TypeScript 中用于类型检查的接口，确保组件接收正确的 props 类型。
 * 这里定义了 KeepAliveProvider 组件接收 children 和可选的 max 参数。
 */
export const KeepAliveProvider: React.FC<{children: React.ReactNode, max?: number}> = ({children, max = 10}) => {
  // useRef 不会因为组件的重新渲染而重新初始化
  // 在 effect 清理阶段，useRef能获取到最新值进而避免闭包陷阱
  // 闭包陷阱是指在React函数组件中，当使用useEffect等钩子时，其回调函数会捕获当时渲染周期的props和state值。
  // 如果这些回调在后续渲染中仍然引用旧的状态值，就会导致意外行为。
  // 例如，在定时器或事件监听器中，可能会使用过时的状态，而useRef因为是可变的引用对象，
  // 总是指向最新值，所以可以避免这个问题。
  const cacheRef = useRef(new Map<string, any>()); // 用于存储缓存的引用
  const keysRef = useRef<string[]>([]); // 用于存储缓存键的引用，维护 LRU 顺序
   
  // 设置缓存的函数
  const setCache = (key: string, component: any) => {
    console.log(`[KeepAlive] 设置缓存 ${key}`);

    // 如果已经存在，先移除旧位置
    if (cacheRef.current.has(key)) {
      console.log(`[KeepAlive] 更新已存在的缓存 ${key}`);
      keysRef.current = keysRef.current.filter(k => k !== key); // 移除旧的键
    } 
    // 如果缓存已满，移除最久未使用的项
    else if (keysRef.current.length >= max) {
      const oldestKey = keysRef.current.shift(); // 获取最旧的键
      if (oldestKey) {
        console.log(`[KeepAlive] 缓存已满，删除最旧的缓存 ${oldestKey}`);
        cacheRef.current.delete(oldestKey); // 删除最旧的缓存项
      }
    }

    // 添加到缓存并更新使用顺序
    cacheRef.current.set(key, component); // 设置新的缓存项
    keysRef.current.push(key); // 更新键的顺序，将当前键放到最后（最近使用）
    
    console.log(`[KeepAlive] 当前缓存项: ${Array.from(cacheRef.current.keys()).join(', ')}`);
  };
  
  // 用于查看缓存状态的辅助函数
  const cacheStatus = () => {
    // Object.fromEntries 是一个用于将键值对数组转换为对象的 API。
    return Object.fromEntries(
      // Array.from 是一个用于将可迭代对象（如 Map、Set、数组等）转换为数组的方法。
      // 这里我们使用它来获取缓存中所有键的数组，并将每个键映射为一个键值对，值为 true，表示该键在缓存中存在。
      Array.from(cacheRef.current.keys()).map(key => [key, true]) // 返回所有缓存项的状态
    );
  };
  
  // 提供上下文值，使所有子组件都能访问缓存服务
  return (
    <KeepAliveContext.Provider value={{ cache: cacheRef.current, setCache, cacheStatus }}>
      {children} {/* 渲染子组件 */}
    </KeepAliveContext.Provider>
  );
};

// KeepAlive 组件是一个函数组件，用于在 React 应用中保持组件的状态。
// 它通过唯一标识符（id）来管理和恢复组件的状态，确保在组件重新渲染时能够保持之前的状态。
// 这种方式在需要频繁切换组件或页面时非常有用，可以提高用户体验。
export const KeepAlive: React.FC<{
  id: string; // 唯一标识符，用于在缓存中识别组件
  children: React.ReactNode; // 子组件，表示可以传递给组件的任何有效 React 节点，包括元素、字符串、数字、数组等
}> = ({ id, children }) => {
  const { cache, setCache } = useContext(KeepAliveContext); // 获取上下文中的缓存和设置缓存函数
  const [counter, setCounter] = useState(0); // 计数器状态，用于演示状态保持
  const isCached = cache.has(id); // 检查当前组件是否在缓存中
  // useRef的使用为了避免闭包陷阱
  // firstRenderRef避免在依赖项变化时重复执行首次渲染逻辑
  const firstRenderRef = useRef(true); // 用于标记首次渲染，在组件生命周期内保持引用
  // scrollPositionRef在事件处理函数和useEffect清理函数中保持最新值
  const scrollPositionRef = useRef(0); // 用于存储滚动位置，确保获取最新滚动状态
  // containerRef用于直接访问DOM元素，避免在异步操作中丢失引用
  const containerRef = useRef<HTMLDivElement>(null); // 用于引用容器元素，在组件重渲染间保持稳定
  // counterRef确保在组件卸载时能获取到最新的counter值，而不是闭包中的旧值
  const counterRef = useRef(0); // 用于跟踪最新计数器值的引用，解决useEffect依赖问题
  
  // 同步计数器和计数器引用
  useEffect(() => {
    counterRef.current = counter; // 更新计数器引用，确保在组件卸载时能获取最新值
  }, [counter]);
  
  // 首次渲染时从缓存恢复状态
  useEffect(() => {
    // firstRenderRef.current 是一个引用，用于标记组件是否为首次渲染
    if (firstRenderRef.current && isCached) {
      console.log(`[KeepAlive ${id}] 首次渲染，从缓存恢复状态`);
      const cachedData = cache.get(id); // 获取缓存数据
      if (cachedData.state) {
        setCounter(cachedData.state.counter || 0); // 恢复计数器状态
      }
      
      // 恢复滚动位置
      if (containerRef.current && cachedData.scrollPosition) {
        setTimeout(() => {
          // containerRef.current 是一个引用，指向当前的 DOM 元素
          if (containerRef.current) {
            containerRef.current.scrollTop = cachedData.scrollPosition; // 设置滚动位置
            console.log(`[KeepAlive ${id}] 恢复滚动位置: ${cachedData.scrollPosition}`);
          }
        }, 50); // 短暂延迟确保 DOM 已完全渲染
      }
      
      firstRenderRef.current = false; // 标记为非首次渲染
    }
  }, [id, isCached, cache]);
  
  // 保存滚动位置
  useEffect(() => {
    const container = containerRef.current; // 获取容器引用
    // handleScroll 是一个函数，用于处理滚动事件
    const handleScroll = () => {
      if (container) {
        scrollPositionRef.current = container.scrollTop; // 更新滚动位置引用
      }
    };
    
    if (container) {
      container.addEventListener('scroll', handleScroll); // 添加滚动事件监听
      return () => container.removeEventListener('scroll', handleScroll); // 清理事件监听
    }
  }, []);
  
  // 每5秒增加计数器(用于验证状态是否保留)
  useEffect(() => {
    const timer = setInterval(() => {
      setCounter(prev => {
        const newValue = prev + 1; // 递增计数器
        // console.log(`[KeepAlive ${id}] 计数器递增: ${prev} -> ${newValue}`);
        return newValue; // 返回新的计数器值
      });
    }, 5000);
    
    return () => clearInterval(timer); // 清理定时器
  }, [id]);
  
  // 在组件卸载时保存状态
  useEffect(() => {
    console.log(`[KeepAlive ${id}] 组件挂载，创建/恢复时间: ${new Date().toLocaleTimeString()}`);
    console.log(`[KeepAlive ${id}] 是否来自缓存: ${isCached}`);
    
    return () => {
      console.log(`[KeepAlive ${id}] 组件将卸载，保存状态，计数器: ${counterRef.current}`);
      // 使用 ref 值确保获取最新计数器值
      setCache(id, {
        state: { counter: counterRef.current }, // 保存计数器状态
        scrollPosition: scrollPositionRef.current, // 保存滚动位置
        timestamp: new Date().toISOString(), // 保存时间戳
      });
    };
  }, [id, setCache, isCached]);
  
  // 使用统一的渲染，不再分条件渲染不同内容
  return (
    <div>
      <div className={isCached ? "bg-yellow-100 p-2 text-xs" : "bg-green-100 p-2 text-xs"}>
        <div>{isCached ? '🔄 从缓存恢复的组件' : '🆕 新创建的组件'} | ID: {id}</div>
        <div>⏱️ {isCached ? '缓存于' : '创建于'}: {
          isCached 
            ? new Date(cache.get(id).timestamp).toLocaleTimeString() 
            : new Date().toLocaleTimeString()
        }</div>
        <div>🔢 计数器: {counter}</div>
      </div>
      
      {/* 将children包装在一个有ref的div中，用于跟踪滚动位置 */}
      <div ref={containerRef} className="overflow-y-auto max-h-full">
        {children} {/* 渲染子组件 */}
      </div>
    </div>
  );
}; 