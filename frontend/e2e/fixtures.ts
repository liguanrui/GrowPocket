import { test as base, expect, type Page } from '@playwright/test';

type TestFixtures = {
  mockAuth: void;
  mockTasks: void;
  mockChildren: void;
  mockBalance: void;
  mockAll: void;
};

type WorkerFixtures = {};

const test = base.extend<TestFixtures, WorkerFixtures>({
  mockAuth: [
    async ({ page }, use) => {
      await page.route('**/api/auth/login', async (route) => {
        const body = route.request().postData() ? JSON.parse(route.request().postData()!) : {};
        if (body.nickname && body.password) {
          await route.fulfill({
            json: {
              code: 0,
              data: {
                token: 'fake-jwt-token-' + Date.now(),
                user: { id: 1, nickname: body.nickname, role: 'parent', family_id: 1 },
                family: { id: 1, name: '测试家庭' },
              },
            },
          });
        } else {
          await route.fulfill({ json: { code: 400, message: '参数错误' } });
        }
      });
      await page.route('**/api/auth/register', async (route) => {
        const body = route.request().postData() ? JSON.parse(route.request().postData()!) : {};
        if (body.nickname && body.password) {
          await route.fulfill({
            json: {
              code: 0,
              data: {
                token: 'fake-jwt-token-' + Date.now(),
                user: { id: 1, nickname: body.nickname, role: 'parent', family_id: 1 },
                family: { id: 1, name: '新家庭' },
              },
            },
          });
        } else {
          await route.fulfill({ json: { code: 400, message: '参数错误' } });
        }
      });
      await use();
    },
    { auto: false },
  ],

  mockChildren: [
    async ({ page }, use) => {
      await page.route('**/api/children', async (route, request) => {
        if (request.method() === 'GET') {
          await route.fulfill({
            json: {
              code: 0,
              data: [
                { id: 1, nickname: '小明', role: 'child', balance: 1000, family_id: 1 },
                { id: 2, nickname: '小红', role: 'child', balance: 500, family_id: 1 },
              ],
            },
          });
        } else if (request.method() === 'POST') {
          await route.fulfill({
            json: { code: 0, data: { id: 99, nickname: '新孩子', role: 'child', balance: 0, family_id: 1 } },
          });
        } else {
          await route.continue();
        }
      });
      await use();
    },
    { auto: false },
  ],

  mockBalance: [
    async ({ page }, use) => {
      await page.route('**/api/score/*/balance', async (route) => {
        await route.fulfill({
          json: { code: 0, data: { balance: 1000, child_id: 1 } },
        });
      });
      await use();
    },
    { auto: false },
  ],

  mockTasks: [
    async ({ page }, use) => {
      await page.route('**/api/tasks**', async (route, request) => {
        const url = new URL(request.url());
        const status = url.searchParams.get('status');
        if (request.method() === 'GET') {
          const allTasks = [
            { id: 1, title: '刷牙洗脸', child_id: 1, points: 10, status: 1, description: '', photo: '' },
            { id: 2, title: '完成作业', child_id: 1, points: 50, status: 2, description: '', photo: '' },
            { id: 3, title: '阅读30分钟', child_id: 1, points: 30, status: 3, description: '', photo: '' },
            { id: 4, title: '做家务', child_id: 1, points: 20, status: 1, description: '', photo: '' },
            { id: 5, title: '运动1小时', child_id: 1, points: 100, status: 2, description: '', photo: '' },
          ];
          const filtered = status === null ? allTasks : allTasks.filter((t) => String(t.status) === status);
          await route.fulfill({
            json: { code: 0, data: { items: filtered, total: filtered.length, page: 1, page_size: 50 } },
          });
        } else if (request.method() === 'POST') {
          await route.fulfill({ json: { code: 0, data: { id: 99, title: '新建任务', points: 10, child_id: 1, status: 1 } } });
        } else {
          await route.continue();
        }
      });
      await page.route('**/api/tasks/*/review', async (route) => {
        await route.fulfill({ json: { code: 0, data: { id: 2, title: '完成作业', points: 50, status: 3 } } });
      });
      await use();
    },
    { auto: false },
  ],

  mockAll: [
    async ({ page }, use, testInfo) => {
      const postData = await page.evaluate(() => JSON.stringify({ nickname: 'tester', password: 'password' }));
      await page.route('**/api/auth/login', async (route) => {
        await route.fulfill({
          json: {
            code: 0,
            data: {
              token: 'e2e-test-token',
              user: { id: 1, nickname: 'tester', role: 'parent', family_id: 1 },
              family: { id: 1, name: 'E2E家庭' },
            },
          },
        });
      });
      await page.route('**/api/children', async (route, request) => {
        if (request.method() === 'GET') {
          await route.fulfill({
            json: {
              code: 0,
              data: [
                { id: 1, nickname: '小明', role: 'child', balance: 1000, family_id: 1 },
                { id: 2, nickname: '小红', role: 'child', balance: 500, family_id: 1 },
              ],
            },
          });
        } else {
          await route.fulfill({ json: { code: 0, data: { id: 99, nickname: '新孩子', role: 'child', balance: 0 } } });
        }
      });
      await page.route('**/api/score/*/balance', async (route) => {
        await route.fulfill({ json: { code: 0, data: { balance: 1000, child_id: 1 } } });
      });
      await page.route('**/api/tasks**', async (route, request) => {
        if (request.method() === 'GET') {
          await route.fulfill({
            json: {
              code: 0,
              data: {
                items: [
                  { id: 1, title: '刷牙洗脸', child_id: 1, points: 10, status: 1, description: '', photo: '' },
                  { id: 2, title: '完成作业', child_id: 1, points: 50, status: 2, description: '', photo: '' },
                  { id: 3, title: '阅读30分钟', child_id: 1, points: 30, status: 3, description: '', photo: '' },
                ],
                total: 3,
                page: 1,
                page_size: 50,
              },
            },
          });
        } else {
          await route.continue();
        }
      });
      await page.route('**/api/tasks/*/review', async (route) => {
        await route.fulfill({ json: { code: 0, data: { id: 2, status: 3 } } });
      });
      await use();
    },
    { auto: false },
  ],
});

export { test, expect };
