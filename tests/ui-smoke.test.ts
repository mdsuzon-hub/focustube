// @vitest-environment jsdom
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PopupApp } from '../src/ui/popup/App';
import { DashboardApp } from '../src/ui/dashboard/App';
import { setStorageArea } from '../src/shared/storage';
import { memoryKV } from './helpers';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  setStorageArea(memoryKV());
  vi.stubGlobal('chrome', {
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    runtime: {
      sendMessage: vi.fn(async () => ({ ok: true })),
      getURL: (p: string) => p,
      openOptionsPage: vi.fn(),
    },
    tabs: { create: vi.fn() },
  });
  window.matchMedia = ((q: string) => ({
    matches: true,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  setStorageArea(null);
  vi.unstubAllGlobals();
});

async function mount(el: ReturnType<typeof createElement>): Promise<HTMLElement> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(el);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  return host;
}

describe('UI smoke tests', () => {
  it('renders the popup with empty-state data', async () => {
    const host = await mount(createElement(PopupApp));
    expect(host.textContent).toContain('FocusTube');
    expect(host.textContent).toContain('Watch with purpose. Learn without distraction.');
    expect(host.querySelector('[role="switch"][aria-label="Focus Mode"]')).not.toBeNull();
    expect(host.textContent).toContain('Nothing queued');
  });
  it.each(['overview', 'focus', 'search', 'queue', 'insights', 'rules', 'settings'])(
    'renders dashboard page %s without crashing',
    async (page) => {
      window.location.hash = `#/${page}`;
      const host = await mount(createElement(DashboardApp));
      expect(host.querySelector('main h1')?.textContent?.toLowerCase()).toBe(page);
    },
  );
});
