import { test, expect } from '@playwright/test';

const MOCK_CHILDREN = [
  { id: 1, familyId: 1, role: 'child', nickname: 'X-Ming', balance: 1000 },
  { id: 2, familyId: 1, role: 'child', nickname: 'X-Hong', balance: 500 },
];

const MOCK_TASKS = [
  { id: 1, familyId: 1, title: 'Task-BrushTeeth', childId: 1, points: 10, status: 1, description: '', photo: '', createdBy: 1, created_at: '', updated_at: '' },
  { id: 2, familyId: 1, title: 'Task-Homework', childId: 1, points: 50, status: 2, description: '', photo: '', createdBy: 1, created_at: '', updated_at: '' },
  { id: 3, familyId: 1, title: 'Task-Read', childId: 1, points: 30, status: 3, description: '', photo: '', createdBy: 1, created_at: '', updated_at: '' },
  { id: 4, familyId: 1, title: 'Task-Chore', childId: 1, points: 20, status: 1, description: '', photo: '', createdBy: 1, created_at: '', updated_at: '' },
  { id: 5, familyId: 1, title: 'Task-Sport', childId: 1, points: 100, status: 4, description: '', photo: '', createdBy: 1, created_at: '', updated_at: '' },
];

const MOCK_BALANCE = { balance: 1000, child_id: 1, child_name: 'X-Ming' };

function injectAuth(page: any) {
  page.addInitScript(() => {
    localStorage.setItem('token', 'e2e-test-token');
    localStorage.setItem('currentUser', JSON.stringify({ id: 1, nickname: 'tester', role: 'parent' }));
    localStorage.setItem('currentFamily', JSON.stringify({ id: 1, name: 'Test-Family' }));
  });
}

function setupMocks(page: any) {
  page.route('**/api/children', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: MOCK_CHILDREN }),
      });
    } else {
      await route.continue();
    }
  });

  page.route(/\/api\/score\/balance/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data: MOCK_BALANCE }),
    });
  });

  page.route(/\/api\/tasks/, async (route, request) => {
    if (request.method() === 'GET') {
      const url = new URL(request.url());
      const status = url.searchParams.get('status');
      const filtered = status === null ? MOCK_TASKS : MOCK_TASKS.filter((t: any) => String(t.status) === status);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: { items: filtered, total: filtered.length, page: 1, page_size: 50 } }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe('首页', () => {
  test('首页加载 - 显示积分卡和快捷操作', async ({ page }) => {
    injectAuth(page);
    setupMocks(page);
    await page.goto('/home');
    await page.waitForSelector('text=/发布任务/', { timeout: 30000 });
    await expect(page.getByText('X-Ming')).toBeVisible();
    await expect(page.getByText(/1000/)).toBeVisible();
    await expect(page.getByText(/创建商品/)).toBeVisible();
    await expect(page.getByText(/积分调整/)).toBeVisible();
  });

  test('首页显示统计摘要', async ({ page }) => {
    injectAuth(page);
    setupMocks(page);
    await page.goto('/home');
    await page.waitForSelector('text=/进行中/', { timeout: 30000 });
    await expect(page.getByText(/进行中/).first()).toBeVisible();
    await expect(page.getByText(/待验收/).first()).toBeVisible();
    await expect(page.getByText(/已完成/).first()).toBeVisible();
  });

  test('发布任务按钮 - 跳转到任务创建页', async ({ page }) => {
    injectAuth(page);
    setupMocks(page);
    await page.goto('/home');
    await page.waitForSelector('text=/发布任务/', { timeout: 30000 });
    await page.getByText(/发布任务/).first().click();
    await page.waitForURL('**/tasks/new');
    expect(page.url()).toContain('/tasks/new');
  });

  test('底部导航 - 切换到任务列表页', async ({ page }) => {
    injectAuth(page);
    setupMocks(page);
    await page.goto('/home');
    await page.waitForSelector('text=/发布任务/', { timeout: 30000 });
    await page.getByText('任务').first().click();
    await page.waitForURL('**/tasks');
    expect(page.url()).toContain('/tasks');
  });

  test('底部导航 - 切换到商城页', async ({ page }) => {
    injectAuth(page);
    setupMocks(page);
    await page.goto('/home');
    await page.waitForSelector('text=/发布任务/', { timeout: 30000 });
    await page.getByText('商城').click();
    await page.waitForURL('**/mall');
    expect(page.url()).toContain('/mall');
  });

  test('底部导航 - 切换到成长页', async ({ page }) => {
    injectAuth(page);
    setupMocks(page);
    await page.goto('/home');
    await page.waitForSelector('text=/发布任务/', { timeout: 30000 });
    await page.getByText('成长').click();
    await page.waitForURL('**/growth');
    expect(page.url()).toContain('/growth');
  });

  test('底部导航 - 切换到家庭页', async ({ page }) => {
    injectAuth(page);
    setupMocks(page);
    await page.goto('/home');
    await page.waitForSelector('text=/发布任务/', { timeout: 30000 });
    await page.getByText('家庭').first().click();
    await page.waitForURL('**/family');
    expect(page.url()).toContain('/family');
  });
});
