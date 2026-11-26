import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page, type TestInfo } from '@playwright/test';

interface SimulatedPlatform {
  hints?: string;
  platform?: string;
  userAgent?: string;
}

const windows = { platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
const invokePath = '**/api/assistant/invoke';
const message = (page: Page) => page.getByRole('textbox', { name: '消息', exact: true });
const modal = (page: Page) => page.getByRole('dialog', { name: '工作台助手' });
const launch = (page: Page) => page.getByRole('button', { name: '打开助手' });
const name = (page: Page) => page.getByLabel('记录名称');

async function load(page: Page, platform: SimulatedPlatform = windows) {
  await page.addInitScript(({ hints, platform, userAgent }) => {
    Object.defineProperties(navigator, {
      userAgentData: { configurable: true, value: hints === undefined ? undefined : { platform: hints } },
      platform: { configurable: true, value: platform ?? '' },
      userAgent: { configurable: true, value: userAgent ?? '' },
    });
  }, platform);
  await page.goto('/');
  await expect(page.getByTestId('access-state')).toHaveText('可用');
}

type KeyOptions = Pick<KeyboardEventInit, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'repeat' | 'isComposing' | 'cancelable'>;

async function dispatch(page: Page, options: KeyOptions): Promise<boolean> {
  return page.evaluate((keyOptions) => {
    const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true, composed: true, ...keyOptions });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event.defaultPrevented;
  }, options);
}

async function watchPayloads(page: Page) {
  const intercepted: Array<{ method: string; path: string; body: unknown }> = [];
  await page.route(invokePath, async (route) => {
    const request = route.request();
    intercepted.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postDataJSON() });
    await route.continue();
  });
  return intercepted;
}

test('macOS client hint takes priority and captures only Command+K', async ({ page }) => {
  await load(page, { ...windows, hints: 'macOS' });
  await name(page).focus();
  expect(await dispatch(page, { ctrlKey: true })).toBe(false);
  await expect(modal(page)).toBeHidden();
  expect(await dispatch(page, { metaKey: true })).toBe(true);
  await expect(modal(page)).toBeVisible();
  await expect(message(page)).toBeFocused();
});

test('Windows legacy platform captures Control+K and preserves Command+K', async ({ page }) => {
  await load(page);
  expect(await dispatch(page, { metaKey: true })).toBe(false);
  await expect(modal(page)).toBeHidden();
  expect(await dispatch(page, { ctrlKey: true })).toBe(true);
  await expect(modal(page)).toBeVisible();
});

test('Linux user agent fallback captures Control+K when platform metadata is absent', async ({ page }) => {
  await load(page, { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' });
  expect(await dispatch(page, { metaKey: true })).toBe(false);
  expect(await dispatch(page, { ctrlKey: true })).toBe(true);
  await expect(modal(page)).toBeVisible();
});

test('legacy macOS platform uses Command+K without a client hint', async ({ page }) => {
  await load(page, { platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1)' });
  expect(await dispatch(page, { ctrlKey: true })).toBe(false);
  expect(await dispatch(page, { metaKey: true })).toBe(true);
  await expect(modal(page)).toBeVisible();
});

test('combined modifiers, alternate keys, IME composition and noncancelable events are preserved', async ({ page }) => {
  await load(page);
  for (const extra of [{ metaKey: true }, { shiftKey: true }, { altKey: true }, { isComposing: true }, { key: 'j' }, { cancelable: false }]) {
    expect(await dispatch(page, { ctrlKey: true, ...extra })).toBe(false);
  }
  await expect(modal(page)).toBeHidden();
});

test('holding the accelerator captures repeats without closing or invoking again', async ({ page }) => {
  const requests = await watchPayloads(page);
  await load(page);
  await page.keyboard.press('Control+k');
  await expect(modal(page)).toBeVisible();
  expect(await dispatch(page, { ctrlKey: true, repeat: true })).toBe(true);
  await expect(modal(page)).toBeVisible();
  expect(requests).toHaveLength(1);
});

for (const label of ['局部快捷键输入框', '富文本编辑器', '代码编辑器']) {
  test(`editor opt-out preserves the browser event at ${label}`, async ({ page }) => {
    const requests = await watchPayloads(page);
    await load(page);
    const editor = page.getByRole('textbox', { name: label });
    await editor.focus();
    expect(await dispatch(page, { ctrlKey: true })).toBe(false);
    await expect(modal(page)).toBeHidden();
    await expect(editor).toBeFocused();
    expect(requests).toHaveLength(0);
  });
}

test('a control that already handles the accelerator retains it', async ({ page }) => {
  await load(page);
  await name(page).evaluate((element) => element.addEventListener('keydown', (event) => event.preventDefault(), { once: true }));
  await name(page).focus();
  expect(await dispatch(page, { ctrlKey: true })).toBe(true);
  await expect(modal(page)).toBeHidden();
});

test('Escape closes and restores exact focus to the shortcut opener', async ({ page }) => {
  await load(page);
  await name(page).focus();
  await page.keyboard.press('Control+k');
  await expect(message(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal(page)).toBeHidden();
  await expect(name(page)).toBeFocused();
});

test('repeated accelerator closes and restores focus without sending another request', async ({ page }) => {
  const requests = await watchPayloads(page);
  await load(page);
  await name(page).focus();
  await page.keyboard.press('Control+k');
  await expect(message(page)).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(modal(page)).toBeHidden();
  await expect(name(page)).toBeFocused();
  expect(requests).toHaveLength(1);
});

test('named close button restores focus to the pointer launcher', async ({ page }) => {
  await load(page);
  await launch(page).click();
  await expect(message(page)).toBeFocused();
  await page.getByRole('button', { name: '关闭助手' }).click();
  await expect(modal(page)).toBeHidden();
  await expect(launch(page)).toBeFocused();
});

test('modal has an accessible title and loops keyboard focus in both directions', async ({ page }) => {
  await load(page);
  await launch(page).click();
  await expect(modal(page)).toHaveAttribute('aria-modal', 'true');
  await expect(modal(page).getByRole('heading', { name: '工作台助手' })).toBeVisible();
  const first = modal(page).getByRole('button', { name: '关闭助手' });
  const last = modal(page).getByRole('button', { name: '发送' });
  await expect(message(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(message(page)).toBeFocused();
});

test('intercepted POST contains precisely the three identifiers and excludes page data', async ({ page }) => {
  const requests = await watchPayloads(page);
  await load(page);
  await name(page).fill('synthetic contents must never be serialized');
  await page.keyboard.press('Control+k');
  await expect(modal(page)).toBeVisible();
  await expect(page.getByText('当前页面：线索详情')).toBeVisible();
  expect(requests).toStrictEqual([{
    method: 'POST', path: '/api/assistant/invoke',
    body: { route: '/workbench/leads/detail', object_type: 'lead', object_id: 'd4005961-b169-4b74-8905-186300000012' },
  }]);
});

test('removing context keeps focus in chat and next invocation sends null object fields', async ({ page }) => {
  const requests = await watchPayloads(page);
  await load(page);
  await launch(page).click();
  await expect(page.getByText('当前页面：线索详情')).toBeVisible();
  await page.getByRole('button', { name: '移除页面上下文' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('当前页面：线索详情')).toBeHidden();
  await expect(message(page)).toBeFocused();
  await page.keyboard.type('本地测试');
  await page.keyboard.press('Enter');
  await expect(page.getByText('消息已在本地演示中接收，未附上记录标识。')).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.keyboard.press('Escape');
  await launch(page).click();
  await expect(modal(page)).toBeVisible();
  expect(requests[1]?.body).toStrictEqual({ route: '/workbench/leads/detail', object_type: null, object_id: null });
});

test('navigation unregisters the previous object and declares the next page', async ({ page }) => {
  const requests = await watchPayloads(page);
  await load(page);
  await page.getByRole('button', { name: '目录', exact: true }).click();
  await launch(page).click();
  await expect(modal(page)).toBeVisible();
  await expect(page.getByText('当前页面：线索详情')).toBeHidden();
  expect(requests[0]?.body).toStrictEqual({ route: '/workbench/directory', object_type: null, object_id: null });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '线索详情', exact: true }).click();
  await launch(page).click();
  await expect(page.getByText('当前页面：线索详情')).toBeVisible();
  expect(requests[1]?.body).toMatchObject({ route: '/workbench/leads/detail', object_type: 'lead' });
});

for (const label of ['系统暂停', '角色无权限']) {
  test(`${label} keeps the modal closed and announces a dismissible hint without an invocation`, async ({ page }) => {
    const requests = await watchPayloads(page);
    await load(page);
    await page.getByRole('button', { name: label }).click();
    await expect(page.getByTestId('access-state')).toHaveText(label);
    await name(page).focus();
    expect(await dispatch(page, { ctrlKey: true })).toBe(true);
    await expect(page.getByRole('status')).toHaveText('助手已暂停');
    await expect(name(page)).toBeFocused();
    await expect(modal(page)).toBeHidden();
    await page.getByRole('button', { name: '关闭提示' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toBeEmpty();
    await expect(name(page)).toBeFocused();
    expect(requests).toHaveLength(0);
  });
}

test('a backend authorization failure overrides stale allowed UI policy', async ({ page }) => {
  await load(page);
  await page.route(invokePath, (route) => route.fulfill({ status: 403 }));
  await launch(page).click();
  await expect(page.getByRole('status')).toHaveText('助手已暂停');
  await expect(modal(page)).toBeHidden();
  await expect(launch(page)).toBeFocused();
});

test('backend mock rejects any extra payload field and rechecks permissions independently', async ({ page }) => {
  await load(page);
  const payload = { route: '/workbench/leads/detail', object_type: null, object_id: null };
  const malformed = await page.request.post('/api/assistant/invoke', { data: { ...payload, extraData: 'synthetic' } });
  expect(malformed.status()).toBe(400);
  await page.getByRole('button', { name: '角色无权限' }).click();
  await expect(page.getByTestId('access-state')).toHaveText('角色无权限');
  const denied = await page.request.post('/api/assistant/invoke', { data: payload });
  expect(denied.status()).toBe(403);
});

async function scanModal(page: Page, testInfo: TestInfo, name: string) {
  const audit = await new AxeBuilder({ page }).include('dialog[open]').analyze();
  const report = {
    engine: audit.testEngine,
    viewport: page.viewportSize(),
    passedRules: audit.passes.map(({ id }) => id),
    incomplete: audit.incomplete.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) })),
    violations: audit.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) })),
  };

  await testInfo.attach(name, { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  expect(report.violations).toStrictEqual([]);
}

test('desktop modal is centered at 720px by 70vh and axe finds no violations', async ({ page }, testInfo) => {
  await load(page);
  await launch(page).click();
  await expect(modal(page)).toBeVisible();
  expect(await modal(page).boundingBox()).toMatchObject({ x: 360, y: 135, width: 720, height: 630 });
  await scanModal(page, testInfo, 'axe-desktop');
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });

  test('mobile modal fills the viewport, remains interactive and passes axe', async ({ page }, testInfo) => {
    await load(page, { hints: 'iOS', platform: 'iPhone' });
    await launch(page).tap();
    await expect(message(page)).toBeFocused();
    expect(await modal(page).boundingBox()).toMatchObject({ x: 0, y: 0, ...page.viewportSize() });
    await scanModal(page, testInfo, 'axe-mobile');
    await page.getByRole('button', { name: '关闭助手' }).tap();
    await expect(modal(page)).toBeHidden();
    await expect(launch(page)).toBeFocused();
  });
});
