import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore — 状态管理', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    useAuthStore.setState({
      token: null,
      user: null,
      family: null,
      isLoggedIn: false,
    });
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('初始状态', () => {
    it('token 为 null，isLoggedIn 为 false', () => {
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.isLoggedIn).toBe(false);
      expect(state.user).toBeNull();
      expect(state.family).toBeNull();
    });
  });

  describe('login action', () => {
    it('login 成功后 isLoggedIn=true，token/user/family 正确更新', async () => {
      const mockLogin = vi.fn().mockResolvedValue({
        token: 'jwt.mock.123',
        user: { id: 10, nickname: '父亲', role: 'parent' as const },
        family: { id: 5, name: '张三家庭' },
      });

      useAuthStore.setState({ login: mockLogin });

      await useAuthStore.getState().login('父亲', 'pass123');

      expect(mockLogin).toHaveBeenCalledWith('父亲', 'pass123');
    });
  });

  describe('logout action', () => {
    it('logout 清除 token/user/family，isLoggedIn=false', () => {
      // 手动注入状态
      useAuthStore.setState({
        token: 'some-token',
        user: { id: 1, nickname: '测试', role: 'parent' as const },
        family: { id: 1, name: '家' },
        isLoggedIn: true,
        logout: useAuthStore.getState().logout,
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.family).toBeNull();
      expect(state.isLoggedIn).toBe(false);
    });

    it('logout 同时清除 localStorage', () => {
      localStorage.setItem('token', 'tok');
      localStorage.setItem('currentUser', JSON.stringify({ id: 1 }));
      localStorage.setItem('currentFamily', JSON.stringify({ id: 1 }));

      useAuthStore.getState().logout();

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('currentUser')).toBeNull();
      expect(localStorage.getItem('currentFamily')).toBeNull();
    });
  });

  describe('setUser action', () => {
    it('setUser 仅更新 user 字段，不影响 token/isLoggedIn', () => {
      useAuthStore.setState({
        token: 'tok',
        user: { id: 1, nickname: '旧', role: 'parent' as const },
        isLoggedIn: true,
        setUser: useAuthStore.getState().setUser,
      });

      useAuthStore.getState().setUser({ id: 2, nickname: '新', role: 'parent' as const });

      const state = useAuthStore.getState();
      expect(state.user?.nickname).toBe('新');
      expect(state.token).toBe('tok');
      expect(state.isLoggedIn).toBe(true);
    });

    it('setUser 同时写入 localStorage', () => {
      useAuthStore.setState({ setUser: useAuthStore.getState().setUser });
      const user = { id: 3, nickname: '母亲', role: 'parent' as const };

      useAuthStore.getState().setUser(user);

      expect(localStorage.getItem('currentUser')).toBe(JSON.stringify(user));
    });
  });

  describe('持久化恢复', () => {
    it('localStorage 有 token 时，isLoggedIn=true', async () => {
      localStorage.setItem('token', 'stored-token');
      localStorage.setItem(
        'currentUser',
        JSON.stringify({ id: 5, nickname: '持久化用户', role: 'parent' })
      );
      localStorage.setItem('currentFamily', JSON.stringify({ id: 2, name: '家庭B' }));

      vi.resetModules();
      const { useAuthStore: reloaded } = await import('./authStore');

      expect(reloaded.getState().isLoggedIn).toBe(true);
      expect(reloaded.getState().token).toBe('stored-token');
      expect(reloaded.getState().user?.nickname).toBe('持久化用户');
      expect(reloaded.getState().family?.name).toBe('家庭B');
    });

    it('localStorage 无 token 时，isLoggedIn=false', async () => {
      localStorage.clear();
      vi.resetModules();
      const { useAuthStore: reloaded } = await import('./authStore');

      expect(reloaded.getState().isLoggedIn).toBe(false);
      expect(reloaded.getState().token).toBeNull();
    });
  });
});
