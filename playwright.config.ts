import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  workers: 1,
  use: { headless: false }, // Chrome extensions need a headed (or new-headless) persistent context
});
