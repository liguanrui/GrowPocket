import { test, expect } from '@playwright/test';

test.describe('调试', () => {
  test('检查首页状态', async ({ page }) => {
    // 在 goto 之前立即设置 localStorage（使用 page.evaluate，同步）
    await page.goto('/home');
    await page.evaluate(() => {
      localStorage.setItem('token', 'e2e-test-token');
      localStorage.setItem('currentUser', JSON.stringify({ id: 1, nickname: 'tester', role: 'parent' }));
      localStorage.setItem('currentFamily', JSON.stringify({ id: 1, name: 'Test-Family' }));
    });
    // 强制重新加载以使 ProtectedRoute 重新检查
    await page.reload();

    const url = page.url();
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const storeState = await page.evaluate(() => {
      const as = (window as any).__authStore;
      return as ? as.getState() : 'authStore not found';
    });
    process.stdout.write(`URL: ${url}\n`);
    process.stdout.write(`Token: ${token}\n`);
    process.stdout.write(`AuthStore: ${JSON.stringify(storeState)}\n`);

    // 等待页面稳定
    await page.waitForLoadState('networkidle');
    const finalUrl = page.url();
    process.stdout.write(`Final URL: ${finalUrl}\n`);
    expect(finalUrl).toContain('/home');
  });
});
