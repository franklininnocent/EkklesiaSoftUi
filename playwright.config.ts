import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.RBAC_E2E_BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /add-sacrament-responsive\.spec\.ts$/,
    },
    {
      name: 'chromium-responsive',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /add-sacrament-responsive\.spec\.ts$/,
    },
    {
      name: 'tablet',
      use: { ...devices['iPad (gen 7)'] },
      testMatch: /add-sacrament-responsive\.spec\.ts$/,
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
      testMatch: /add-sacrament-responsive\.spec\.ts$/,
    }
  ]
});
