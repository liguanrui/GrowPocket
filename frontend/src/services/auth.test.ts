import { describe, it, expect, vi, beforeEach } from 'vitest';

// 使用 vi.hoisted 在同一作用域定义 mock 函数
const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn<any>(),
}));

vi.mock('./api', () => ({
  request: requestMock,
}));

import { register, login, logout } from './auth';

describe('services/auth.ts — 登录注册请求构造', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestMock.mockReset();
    localStorage.clear();
  });

  describe('register', () => {
    it('POST /auth/register，body 含 nickname 和 password', async () => {
      requestMock.mockResolvedValueOnce({
        token: 'tok1',
        user: { id: 1, nickname: 'Dad', role: 'parent' },
        family: { id: 1, name: 'Family' },
      });

      await register('Dad', '123456');

      expect(requestMock).toHaveBeenCalledWith({
        method: 'POST',
        url: '/auth/register',
        data: { nickname: 'Dad', password: '123456' },
      });
    });
  });

  describe('login', () => {
    it('POST /auth/login，body 含 nickname 和 password', async () => {
      requestMock.mockResolvedValueOnce({
        token: 'tok2',
        user: { id: 2, nickname: 'Mom', role: 'parent' },
        family: { id: 1, name: 'Family' },
      });

      await login('Mom', 'pass99');

      expect(requestMock).toHaveBeenCalledWith({
        method: 'POST',
        url: '/auth/login',
        data: { nickname: 'Mom', password: 'pass99' },
      });
    });
  });

  describe('logout', () => {
    it('清除所有 auth 相关 localStorage 字段', () => {
      localStorage.setItem('token', 'tok');
      localStorage.setItem('currentUser', JSON.stringify({ id: 1 }));
      localStorage.setItem('currentFamily', JSON.stringify({ id: 1 }));

      logout();

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('currentUser')).toBeNull();
      expect(localStorage.getItem('currentFamily')).toBeNull();
    });
  });
});
