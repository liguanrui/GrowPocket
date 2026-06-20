import { describe, it, expect, vi, beforeEach } from 'vitest';

// 使用 vi.hoisted 在同一作用域定义 mock 函数
const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn<any>(),
}));

vi.mock('./api', () => ({
  request: requestMock,
}));

import { createTask, getTasks, submitTask, reviewTask, deleteTask } from './tasks';

describe('services/tasks.ts — 任务 CRUD 请求构造', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestMock.mockReset();
  });

  it('createTask: POST /tasks，childId 映射为 child_id', async () => {
    requestMock.mockResolvedValueOnce({ id: 1 });

    await createTask({ title: 'Math', points: 10, childId: 5 });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      url: '/tasks',
      data: { title: 'Math', points: 10, child_id: 5 },
    });
  });

  it('createTask: status=3 时传入已完成状态', async () => {
    requestMock.mockResolvedValueOnce({ id: 2 });

    await createTask({ title: 'Test', points: 50, childId: 3, status: 3 });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'POST',
      url: '/tasks',
      data: { title: 'Test', points: 50, child_id: 3, status: 3 },
    });
  });

  it('getTasks: GET /tasks，childId 和 status 映射为 snake_case', async () => {
    requestMock.mockResolvedValueOnce({ items: [], total: 0 });

    await getTasks({ childId: 5, status: 2, page: 1, pageSize: 10 });

    expect(requestMock).toHaveBeenCalledWith({
      method: 'GET',
      url: '/tasks',
      params: { child_id: 5, status: 2, page: 1, page_size: 10 },
    });
  });

  it('getTasks: 无参数时只发空 params', async () => {
    requestMock.mockResolvedValueOnce({ items: [] });

    await getTasks();

    expect(requestMock).toHaveBeenCalledWith({
      method: 'GET',
      url: '/tasks',
      params: {},
    });
  });

  it('submitTask: PUT /tasks/:id/submit，body 含 photo', async () => {
    requestMock.mockResolvedValueOnce({ id: 7 });

    await submitTask(7, 'https://cdn.example.com/p.jpg');

    expect(requestMock).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/tasks/7/submit',
      data: { photo: 'https://cdn.example.com/p.jpg' },
    });
  });

  it('reviewTask: approved=true', async () => {
    requestMock.mockResolvedValueOnce({ id: 8 });

    await reviewTask(8, true);

    expect(requestMock).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/tasks/8/review',
      data: { approved: true },
    });
  });

  it('reviewTask: approved=false', async () => {
    requestMock.mockResolvedValueOnce({ id: 8 });

    await reviewTask(8, false);

    expect(requestMock).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/tasks/8/review',
      data: { approved: false },
    });
  });

  it('reviewTask: 自定义 points 正确传递', async () => {
    requestMock.mockResolvedValueOnce({ id: 9 });

    await reviewTask(9, true, 80);

    expect(requestMock).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/tasks/9/review',
      data: { approved: true, points: 80 },
    });
  });

  it('deleteTask: DELETE /tasks/:id', async () => {
    requestMock.mockResolvedValueOnce(null);

    await deleteTask(10);

    expect(requestMock).toHaveBeenCalledWith({
      method: 'DELETE',
      url: '/tasks/10',
    });
  });
});
