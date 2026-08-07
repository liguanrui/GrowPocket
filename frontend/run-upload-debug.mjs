import { chromium } from 'playwright';

const TEST_IMG = '/Users/Admin1/Workhome/GrowPocket/frontend/public/images/photo-cleanup.jpg';
const BASE_URL = 'http://localhost:5175';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-extensions'],
  });
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
  });
  const page = await context.newPage();
  const logs = [];
  const pushLog = (type, text) => {
    const now = new Date().toISOString().slice(11, 23);
    logs.push({ type, text, time: now });
    console.log(`[${now}] [${type}] ${text}`);
  };
  let hasThumb = false;

  page.on('console', (msg) => {
    const t = msg.type();
    const txt = msg.text();
    if (t === 'error') pushLog('console.error', txt);
    else if (t === 'warn') pushLog('console.warn', txt);
    else if (/ediaUploader|上传|Media|Upload/.test(txt)) pushLog('console.' + t, txt);
  });
  page.on('pageerror', (err) => pushLog('pageerror', `${err.message}\n${err.stack || ''}`));
  page.on('framenavigated', (f) => pushLog('navigation', `-> ${f.url()}`));

  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api') && !u.includes('/node_modules') && !u.includes('/src/')) {
      pushLog('req', `${req.method()} ${u}`);
    }
  });
  page.on('response', async (res) => {
    const u = res.url();
    if (!u.includes('/api') || u.includes('/node_modules') || u.includes('/src/')) return;
    let body = '';
    try { body = await res.text(); } catch { body = '<cannot-read>'; }
    pushLog(res.ok() ? 'res-ok' : 'res-err', `${res.status()} ${u.slice(-80)} body=${body.slice(0, 200)}`);
  });
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (u.includes('/api')) pushLog('req-fail', `${req.method()} ${u} => ${req.failure()?.errorText || ''}`);
  });

  await page.addInitScript(() => {
    localStorage.setItem('token', 'e2e-debug-token');
    localStorage.setItem('currentUser', JSON.stringify({ id: 1, nickname: 'tester', role: 'parent' }));
    localStorage.setItem('currentFamily', JSON.stringify({ id: 1, name: 'Debug' }));
  });

  // ===== 全部 mock：先验证前端逻辑（组件状态、onChange、缩略图渲染），无需真实 token =====
  await page.route('**/api/**', async (route, req) => {
    const u = req.url();
    const method = req.method();

    // 上传：mock 成功返回（延迟 800ms 模拟网络耗时，用于测试 mediaUploading 状态）
    if (u.includes('/api/upload') && method === 'POST') {
      pushLog('mock', '拦截 /upload，800ms 后返回 mock 成功 URL');
      await new Promise((r) => setTimeout(r, 800));
      return route.fulfill({
        json: {
          code: 0,
          data: { url: '/uploads/mock-' + Date.now() + '.jpg', type: 'image' },
        },
      });
    }
    // 提交：mock 成功
    if (/\/api\/tasks\/\d+\/submit/.test(u) && method === 'PUT') {
      pushLog('mock', '拦截 /submit，mock 返回');
      return route.fulfill({
        json: {
          code: 0,
          data: {
            id: 1, title: '测试任务 - 打扫房间',
            points: 20, status: 2, child_id: 1, child_name: 'X', family_id: 1,
            created_by: 1, created_at: '2026-08-06 10:00:00', updated_at: new Date().toISOString(),
            task_kind: 'daily', photo: '',
          },
        },
      });
    }
    if (u.includes('/api/children')) {
      return route.fulfill({ json: { code: 0, data: [{ id: 1, nickname: 'X', role: 'child', balance: 1000, family_id: 1 }] } });
    }
    if (/\/api\/score\/.*\/balance/.test(u) || u.includes('/score/balance')) {
      return route.fulfill({ json: { code: 0, data: { balance: 1000, child_id: 1 } } });
    }
    if (/\/api\/tasks\/\d+$/.test(u) && method === 'GET') {
      return route.fulfill({
        json: {
          code: 0,
          data: {
            id: 1, title: '测试任务 - 打扫房间',
            description: '请把房间打扫干净',
            points: 20, status: 1, child_id: 1, child_name: 'X', family_id: 1,
            created_by: 1, created_at: '2026-08-06 10:00:00', updated_at: '2026-08-06 10:00:00',
            task_kind: 'daily', photo: '',
          },
        },
      });
    }
    if (u.includes('/api/tasks')) {
      return route.fulfill({ json: { code: 0, data: { items: [], total: 0, page: 1, page_size: 50 } } });
    }
    return route.fulfill({ json: { code: 0, data: null } });
  });

  pushLog('info', `导航到 ${BASE_URL}/task/1`);
  await page.goto(`${BASE_URL}/task/1`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  try {
    await page.waitForSelector('text=/测试任务 - 打扫房间/', { timeout: 30000 });
    pushLog('ok', '任务标题渲染成功');
  } catch (e) {
    pushLog('fatal', '任务标题未找到: ' + e.message);
    await page.screenshot({ path: '/tmp/step1-load.png', fullPage: true });
    return dumpAndExit(1);
  }
  await page.screenshot({ path: '/tmp/step1-load.png', fullPage: true });

  // 枚举所有按钮
  const btns = page.locator('button');
  const bCount = await btns.count();
  pushLog('info', `页面按钮总数: ${bCount}`);
  for (let i = 0; i < bCount; i++) {
    const t = (await btns.nth(i).textContent()) || '';
    const d = await btns.nth(i).isDisabled();
    pushLog('info', `  btn[${i}]: "${t.trim().slice(0, 40)}" disabled=${d}`);
  }

  // 先等 mediaUploader 渲染出来
  await page.waitForSelector('button:has-text("拍摄")', { timeout: 10000 }).catch(() => {});

  // 定位相册按钮
  const albumBtn = page.locator('button').filter({ hasText: /相册/ }).first();
  await albumBtn.waitFor({ state: 'visible', timeout: 10000 });
  pushLog('ok', '相册按钮已定位，即将点击');

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 20000 }).catch((e) => {
      pushLog('fatal', '没出现文件选择框: ' + e.message);
      throw e;
    }),
    albumBtn.click(),
  ]);
  pushLog('ok', `文件选择器出现, multiple=${fileChooser.isMultiple()}`);

  await fileChooser.setFiles(TEST_IMG);
  pushLog('ok', `已设置文件 ${TEST_IMG}，等待上传请求与响应...`);

  try {
    await page.waitForResponse((res) => res.url().includes('/api/upload'), { timeout: 60000 });
    pushLog('ok', '观察到 /api/upload 响应返回');
  } catch (e) {
    pushLog('err', '等待 /api/upload 超时: ' + e.message);
  }

  // 稍微等 React 渲染
  await page.waitForTimeout(2000);

  try {
    await page.waitForSelector('.grid-cols-4 img, .grid-cols-4 video', { timeout: 30000 });
    hasThumb = true;
    pushLog('ok', '缩略图出现，上传成功！');
  } catch (e) {
    pushLog('err', '缩略图未出现: ' + e.message);
  }

  // 提交按钮状态
  const submit = page.locator('button').filter({ hasText: /提交验收/ }).first();
  if (await submit.isVisible().catch(() => false)) {
    const txt = (await submit.textContent()) || '';
    const d = await submit.isDisabled();
    pushLog('info', `提交按钮: text="${txt}" disabled=${d}`);
  } else {
    pushLog('warn', '没找到提交按钮');
  }

  // DOM 检查：看看是不是已有 data-uid 或 img
  const imgCount = await page.locator('.grid-cols-4 img').count().catch(() => 0);
  const videoCount = await page.locator('.grid-cols-4 video').count().catch(() => 0);
  pushLog('info', `网格内 img=${imgCount} video=${videoCount}`);

  await page.screenshot({ path: '/tmp/step2-after-upload.png', fullPage: true });

  return dumpAndExit(hasThumb ? 0 : 1);

  async function dumpAndExit(exitCode) {
    console.log('\n\n=============== 完整日志 ===============');
    logs.forEach((l) => console.log(`[${l.time}] [${l.type}] ${l.text}`));
    console.log(`\n截图:\n  - /tmp/step1-load.png\n  - /tmp/step2-after-upload.png`);
    await context.close();
    await browser.close();
    process.exit(exitCode);
  }
}

main().catch(async (e) => {
  console.error('FATAL UNHANDLED:', e);
  process.exit(2);
});
