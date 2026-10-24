import { chromium, expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// NOT RUN in the authoring environment (no browser download access). Run `npx playwright install chromium`
// then `npm run build && npm run test:e2e`. It loads the unpacked extension and serves a fixture page in
// place of youtube.com, so it never touches the real site.
const dist = fileURLToPath(new URL('../dist', import.meta.url));

const FIXTURE = `<!doctype html><html><body><ytd-app>
  <ytd-rich-grid-renderer>
    <ytd-rich-item-renderer id="normal"><a href="/watch?v=abcDEF12345">Normal</a></ytd-rich-item-renderer>
    <ytd-rich-item-renderer id="short"><a href="/shorts/zzzzzzzzzzz">Short</a></ytd-rich-item-renderer>
  </ytd-rich-grid-renderer></ytd-app></body></html>`;

test('hides Shorts cards but keeps normal videos', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  await ctx.route('https://www.youtube.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: FIXTURE }),
  );
  const page = await ctx.newPage();
  await page.goto('https://www.youtube.com/feed/subscriptions');
  await expect(page.locator('#short')).toBeHidden();
  await expect(page.locator('#normal')).toBeVisible();
  await ctx.close();
});
