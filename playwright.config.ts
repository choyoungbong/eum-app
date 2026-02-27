// playwright.config.ts
// npm install --save-dev @playwright/test
// npx playwright install

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir:     "./e2e",
  timeout:     30_000,
  retries:     process.env.CI ? 2 : 0,
  workers:     process.env.CI ? 1 : undefined,
  reporter:    [["html", { outputFolder: "playwright-report" }], ["line"]],

  use: {
    baseURL:     process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace:       "on-first-retry",
    screenshot:  "only-on-failure",
    video:       "retain-on-failure",
  },

  projects: [
    // 데스크탑
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox",  use: { ...devices["Desktop Firefox"] } },
    // 모바일
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 12"] } },
  ],

  // 테스트 실행 전 서버 자동 시작
  webServer: {
    command:            "npm run dev",
    url:                "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout:            120_000,
  },
});
