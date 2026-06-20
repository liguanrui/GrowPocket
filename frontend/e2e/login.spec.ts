import { test, expect } from '@playwright/test';

test.describe('登录页面', () => {
  test('页面加载正确 - 显示登录表单', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('欢迎回到童劳童得')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
    await expect(page.getByPlaceholder('请输入昵称')).toBeVisible();
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
  });

  test('空表单提示错误', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page.getByText('请填写昵称和密码')).toBeVisible();
  });

  test('登录成功 - 跳转到首页', async ({ page }) => {
    await page.route('**/api/auth/login', async (route: any) => {
      await route.fulfill({
        json: {
          code: 0,
          data: {
            token: 'fake-jwt-token-' + Date.now(),
            user: { id: 1, nickname: 'tester', role: 'parent', family_id: 1 },
            family: { id: 1, name: 'Test-Family' },
          },
        },
      });
    });

    await page.route('**/api/children', async (route: any, request: any) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          json: {
            code: 0,
            data: [{ id: 1, nickname: 'X-Ming', role: 'child', balance: 1000, family_id: 1 }],
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/score/*/balance', async (route: any) => {
      await route.fulfill({ json: { code: 0, data: { balance: 1000, child_id: 1 } } });
    });

    await page.route('**/api/tasks**', async (route: any, request: any) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          json: {
            code: 0,
            data: {
              items: [{ id: 1, title: 'Task-Test', child_id: 1, points: 10, status: 1, description: '', photo: '' }],
              total: 1,
              page: 1,
              page_size: 50,
            },
          },
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/login');

    await page.getByPlaceholder('请输入昵称').fill('tester');
    await page.getByPlaceholder('请输入密码').fill('password');
    await page.getByRole('button', { name: '登录' }).click();

    await page.waitForURL('**/home');
    expect(page.url()).toContain('/home');

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).not.toBeNull();
    expect(token).toContain('fake-jwt-token');
  });

  test('登录链接到注册页', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('立即注册').click();
    await page.waitForURL('**/register');
    expect(page.url()).toContain('/register');
  });
});
