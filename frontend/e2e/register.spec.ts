import { test, expect } from '@playwright/test';

test.describe('注册页面', () => {
  test('页面加载正确 - 显示注册表单', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByText('创建家长账号')).toBeVisible();
    await expect(page.getByRole('button', { name: '注册并登录' })).toBeVisible();
    await expect(page.getByPlaceholder('请输入昵称')).toBeVisible();
    await expect(page.getByPlaceholder('至少 6 位')).toBeVisible();
    await expect(page.getByPlaceholder('请再次输入密码')).toBeVisible();
  });

  test('密码少于 6 位 - 显示错误', async ({ page }) => {
    await page.goto('/register');

    await page.getByPlaceholder('请输入昵称').fill('test');
    await page.getByPlaceholder('至少 6 位').fill('123');
    await page.getByPlaceholder('请再次输入密码').fill('123');
    await page.getByRole('button', { name: '注册并登录' }).click();

    await expect(page.getByText('密码至少 6 位')).toBeVisible();
  });

  test('两次密码不一致 - 显示错误', async ({ page }) => {
    await page.goto('/register');

    await page.getByPlaceholder('请输入昵称').fill('test');
    await page.getByPlaceholder('至少 6 位').fill('123456');
    await page.getByPlaceholder('请再次输入密码').fill('654321');
    await page.getByRole('button', { name: '注册并登录' }).click();

    await expect(page.getByText('两次输入的密码不一致')).toBeVisible();
  });

  test('注册成功 - 跳转到首页', async ({ page }) => {
    await page.route('**/api/auth/register', async (route: any) => {
      await route.fulfill({
        json: {
          code: 0,
          data: {
            token: 'fake-jwt-token-' + Date.now(),
            user: { id: 1, nickname: 'newuser', role: 'parent', family_id: 1 },
            family: { id: 1, name: 'New-Family' },
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

    await page.goto('/register');

    await page.getByPlaceholder('请输入昵称').fill('newuser');
    await page.getByPlaceholder('至少 6 位').fill('123456');
    await page.getByPlaceholder('请再次输入密码').fill('123456');
    await page.getByRole('button', { name: '注册并登录' }).click();

    await page.waitForURL('**/home');
    expect(page.url()).toContain('/home');

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).not.toBeNull();
  });

  test('注册链接回登录页', async ({ page }) => {
    await page.goto('/register');
    await page.getByText('去登录').click();
    await page.waitForURL('**/login');
    expect(page.url()).toContain('/login');
  });
});
