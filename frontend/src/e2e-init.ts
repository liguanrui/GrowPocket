/**
 * E2E 测试辅助：暴露 Zustand store 实例到 window
 * 通过 import 确保在应用启动时执行
 */
import { useChildStore } from './stores/childStore';
import { useStore } from './stores/useStore';
import { useAuthStore } from './stores/authStore';

if (typeof window !== 'undefined') {
  (window as any).__childStore = useChildStore;
  (window as any).__taskStore = useStore;
  (window as any).__authStore = useAuthStore;
}
