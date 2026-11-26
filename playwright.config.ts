import { defineConfig } from '@playwright/test';

const url = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 3,
  timeout: 20_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/run.json' }]],
  use: {
    baseURL: url,
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url,
    timeout: 45_000,
  },
});
