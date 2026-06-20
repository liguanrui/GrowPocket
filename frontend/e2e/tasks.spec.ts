import { test, expect } from '@playwright/test';

async function setupApp(page: any) {
  await page.route('**/api/children', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          data: [
            { id: 1, familyId: 1, role: 'child', nickname: 'X-Ming', balance: 1000 },
            { id: 2, familyId: 1, role: 'child', nickname: 'X-Hong', balance: 500 },
          ],
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route(/\/api\/score\/\d+\/balance/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data: { balance: 1000, child_id: 1 } }),
    });
  });

  await page.route(/\/api\/tasks/, async (route, request) => {
    if (request.method() === 'GET') {
      const url = new URL(request.url());
      const status = url.searchParams.get('status');
      const allTasks = [
        { id: 1, familyId: 1, title: 'Task-BrushTeeth', childId: 1, points: 10, status: 1, description: '', photo: '', createdBy: 1, created_at: '', updated_at: '' },
        { id: 2, familyId: 1, title: 'Task-Homework', childId: 1, points: 50, status: 2, description: '', photo: '', createdBy: 1, created_at: '', updated_at: '' },
        { id: 3, familyId: 1, title: 'Task-Read', childId: 1, points: 30, status: 3, description: '', photo: '', createdBy: 1, created_at: '', updated_at: '' },
        { id: 4, familyId: 1, title: 'Task-Chore', childId: 1, points: 20, status: 1, description: '', photo: '', createdBy: 1, created_at: '', updated_at: '' },
        { id: 5, familyId: 1, title: 'Task-Sport', childId: 1, points: 100, status: 4, description: '', photo: '', createdBy: 1, created_at: '', updated_at: '' },
      ];
      const filtered = status === null ? allTasks : allTasks.filter((t) => String(t.status) === status);
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

function injectAuth(page: any) {
  page.addInitScript(() => {
    localStorage.setItem('token', 'e2e-test-token');
    localStorage.setItem('currentUser', JSON.stringify({ id: 1, nickname: 'tester', role: 'parent' }));
    localStorage.setItem('currentFamily', JSON.stringify({ id: 1, name: 'Test-Family' }));
  });
}

test.describe('任务列表页', () => {
  test('加载任务列表 - 显示所有任务', async ({ page }) => {
    injectAuth(page);
    await setupApp(page);
    await page.goto('/tasks');
    await page.waitForSelector('text=/Task-BrushTeeth/', { timeout: 30000 });
    await expect(page.getByText('Task-BrushTeeth')).toBeVisible();
    await expect(page.getByText('Task-Homework')).toBeVisible();
    await expect(page.getByText('Task-Read')).toBeVisible();
    await expect(page.getByText('Task-Chore')).toBeVisible();
    await expect(page.getByText('Task-Sport')).toBeVisible();
  });

  test('统计卡片 - 显示任务状态数量', async ({ page }) => {
    injectAuth(page);
    await setupApp(page);
    await page.goto('/tasks');
    await page.waitForSelector('text=/全部/', { timeout: 30000 });
    await expect(page.getByText(/全部/).first()).toBeVisible();
    await expect(page.getByText(/进行中/).first()).toBeVisible();
    await expect(page.getByText(/待验收/).first()).toBeVisible();
    await expect(page.getByText(/已完成/).first()).toBeVisible();
  });

  test('状态标签切换 - 切换到"进行中"', async ({ page }) => {
    injectAuth(page);
    await setupApp(page);
    await page.goto('/tasks');
    await page.waitForSelector('text=/进行中/', { timeout: 30000 });
    await page.getByText('进行中').nth(1).click();
    await expect(page.getByText('Task-BrushTeeth')).toBeVisible();
    await expect(page.getByText('Task-Chore')).toBeVisible();
  });

  test('状态标签切换 - 切换到"待验收"', async ({ page }) => {
    injectAuth(page);
    await setupApp(page);
    await page.goto('/tasks');
    await page.waitForSelector('text=/待验收/', { timeout: 30000 });
    await page.getByText('待验收').nth(1).click();
    await expect(page.getByText('Task-Homework')).toBeVisible();
  });

  test('状态标签切换 - 切换到"已完成"', async ({ page }) => {
    injectAuth(page);
    await setupApp(page);
    await page.goto('/tasks');
    await page.waitForSelector('text=/已完成/', { timeout: 30000 });
    await page.getByText('已完成').nth(1).click();
    await expect(page.getByText('Task-Read')).toBeVisible();
  });

  test('点击任务卡片 - 跳转到详情', async ({ page }) => {
    injectAuth(page);
    await setupApp(page);
    await page.goto('/tasks');
    await page.waitForSelector('text=/Task-Homework/', { timeout: 30000 });
    await page.getByText('Task-Homework').click();
    await page.waitForURL('**/task/*');
    expect(page.url()).toContain('/task/');
  });
});
