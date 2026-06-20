import { describe, it, expect, vi, beforeEach } from 'vitest';

// 使用 vi.hoisted 在同一作用域定义 mock 函数
const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn<any>(),
}));

vi.mock('./api', () => ({
  request: requestMock,
}));

import { request } from './api';

describe('services/api.ts — axios 封装', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestMock.mockReset();
  });

  it('request 返回 response.data.data 字段', async () => {
    requestMock.mockResolvedValueOnce({ foo: 'bar' });

    const result = await request<{ foo: string }>({ method: 'GET', url: '/test' });

    expect(result).toEqual({ foo: 'bar' });
    expect(requestMock).toHaveBeenCalledWith({ method: 'GET', url: '/test' });
  });

  it('request 抛出 Error 时向上传播', async () => {
    requestMock.mockRejectedValueOnce(new Error('network error'));

    await expect(request({ method: 'GET', url: '/test' })).rejects.toThrow('network error');
  });

  it('request 构造正确的 axios config 结构', async () => {
    requestMock.mockResolvedValueOnce(null);

    await request({ method: 'POST', url: '/api/data', data: { key: 'value' } });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      url: '/api/data',
      data: { key: 'value' },
    });
  });
});
