import { test, expect } from '@playwright/test';

const TEST_IMG = '/Users/Admin1/Workhome/GrowPocket/frontend/public/images/photo-cleanup.jpg';

test.describe('上传功能调试 @upload-debug', () => {
  test('任务详情 - 上传图片并提交', async ({ page }) => {
    // 捕获所有控制台错误和未捕获的异常
    const consoleErrors: string[] = [];
    const uncaughtErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[console.error] ${msg.text()}`);
      }
      // 也记录所有日志方便调试
      console.log(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      uncaughtErrors.push(`[pageerror] ${err.message}\n${err.stack || ''}`);
      console.error('[Page Uncaught Error]', err.message, err.stack);
    });
    page.on('requestfailed', (req) => {
      console.error('[Request Failed]', req.method(), req.url(), req.failure()?.errorText);
    });
    page.on('response', async (res) => {
      if (!res.ok()) {
        const url = res.url();
        const status = res.status();
        let body = '';
        try { body = await res.text(); } catch {}
        console.error(`[Response ${status}]`, url, body.slice(0, 300));
      } else if (res.url().includes('/upload') || res.url().includes('/submit')) {
        const url = res.url();
        let body = '';
        try { body = await res.text(); } catch {}
        console.log(`[OK Response] ${url}`, body.slice(0, 300));
      }
    });

    // 注入登录态
    await page.addInitScript(() => {
      localStorage.setItem('token', 'e2e-test-token');
      localStorage.setItem('currentUser', JSON.stringify({ id: 1, nickname: 'tester', role: 'parent' }));
      localStorage.setItem('currentFamily', JSON.stringify({ id: 1, name: 'Debug家庭' }));
    });

    // Mock 所有 GET 接口，POST /upload 走真实后端
    await page.route('**/api/children', async (route, req) => {
      if (req.method() === 'GET') {
        await route.fulfill({
          json: { code: 0, data: [{ id: 1, nickname: '小明', role: 'child', balance: 1000, family_id: 1 }] },
        });
      } else {
        await route.continue();
      }
    });
    await page.route(/\/api\/score\/\d+\/balance/, async (route) => {
      await route.fulfill({ json: { code: 0, data: { balance: 1000, child_id: 1 } } });
    });

    // 获取单个任务详情：返回 status=1（进行中），允许上传和提交
    await page.route(/\/api\/tasks\/\d+$/, async (route, req) => {
      if (req.method() === 'GET') {
        await route.fulfill({
          json: {
            code: 0,
            data: {
              id: 1,
              title: '测试任务 - 打扫房间',
              description: '请把自己的房间打扫干净，可以拍打扫完的照片作为成果',
              points: 20,
              status: 1,
              child_id: 1,
              child_name: '小明',
              family_id: 1,
              created_by: 1,
              created_at: '2026-08-06 10:00:00',
              updated_at: '2026-08-06 10:00:00',
              task_kind: 'daily',
              photo: '',
            },
          },
        });
      } else {
        await route.continue();
      }
    });

    // 获取任务列表
    await page.route(/\/api\/tasks(\?|$)/, async (route, req) => {
      if (req.method() === 'GET') {
        await route.fulfill({
          json: {
            code: 0,
            data: {
              items: [
                {
                  id: 1, title: '测试任务 - 打扫房间', points: 20, status: 1,
                  child_id: 1, family_id: 1, created_by: 1,
                  created_at: '2026-08-06 10:00:00', updated_at: '2026-08-06 10:00:00',
                },
              ],
              total: 1, page: 1, page_size: 50,
            },
          },
        });
      } else {
        await route.continue();
      }
    });

    // 其他未定义接口：走真实后端（尤其 /upload 和 /submit）
    await page.goto('http://localhost:5175/task/1', { waitUntil: 'domcontentloaded' });

    // 等待任务详情加载
    await page.waitForSelector('text=/测试任务 - 打扫房间/', { timeout: 30000 });
    console.log('✅ 任务详情加载成功');
    await page.screenshot({ path: '/tmp/step1-task-loaded.png', fullPage: true });

    // 检查 MediaUploader 是否存在
    const uploadButton = page.getByRole('button', { name: /相册/ }).first();
    await expect(uploadButton).toBeVisible({ timeout: 10000 });
    console.log('✅ 相册按钮可见');

    // 点击相册按钮前先设置文件选择处理器
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15000 }),
      uploadButton.click(),
    ]);
    console.log('✅ 打开文件选择框');

    // 选择测试图片
    await fileChooser.setFiles(TEST_IMG);
    console.log('✅ 已选择图片，等待上传...');

    // 等待：要么上传成功出现缩略图，要么出现错误提示
    let uploadedOk = false;
    try {
      // 上传成功：缩略图区域应该出现 img 标签
      await page.waitForSelector('.grid-cols-4 img, .grid-cols-4 video', { timeout: 60000 });
      uploadedOk = true;
      console.log('✅ 缩略图出现，上传成功！');
    } catch (e) {
      console.error('❌ 等待缩略图超时', e);
    }
    await page.screenshot({ path: '/tmp/step2-after-upload.png', fullPage: true });

    // 同时检查提交按钮文案，看是否识别到「上传中」
    const submitBtn = page.getByRole('button', { name: /提交验收/ });
    try {
      await expect(submitBtn).toBeVisible({ timeout: 5000 });
      const btnText = await submitBtn.textContent();
      console.log(`ℹ️  提交按钮当前文案：${btnText}`);
    } catch {
      console.log('ℹ️  暂未找到提交验收按钮');
    }

    // 打印所有收集到的错误
    if (consoleErrors.length > 0) {
      console.log('\n========= 捕获的 console.error =========');
      console.log(consoleErrors.join('\n---\n'));
    }
    if (uncaughtErrors.length > 0) {
      console.log('\n========= 捕获的 pageerror（未捕获的 Promise） =========');
      console.log(uncaughtErrors.join('\n---\n'));
    }
    if (!uploadedOk) {
      console.log('\n❌ 最终：上传未成功，截图已保存在 /tmp/step1-task-loaded.png 和 /tmp/step2-after-upload.png');
      process.exit(1);
    }
    console.log('\n🎉 上传流程完全通过！');
  });
});
