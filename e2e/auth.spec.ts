import { test, expect } from "@playwright/test";

const TEST_EMAIL    = process.env.E2E_TEST_EMAIL    ?? "e2e@eum.app";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "TestPass1!";
const TEST_NAME     = "E2E 테스터";

test.describe("인증 플로우", () => {

  test("회원가입 → 로그인 → 로그아웃", async ({ page }) => {
    const unique = `e2e_${Date.now()}@eum.app`;

    // 회원가입
    await page.goto("/register");
    await expect(page).toHaveURL(/register/);
    await page.fill('[name="name"]',     TEST_NAME);
    await page.fill('[name="email"]',    unique);
    await page.fill('[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // 로그인 후 대시보드로 이동 확인
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
    await expect(page.locator("text=대시보드")).toBeVisible();

    // 로그아웃
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-btn"]');
    await expect(page).toHaveURL(/login|\//, { timeout: 5_000 });
  });

  test("잘못된 비밀번호로 로그인 시 에러 표시", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]',    TEST_EMAIL);
    await page.fill('[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/비밀번호|인증|오류/")).toBeVisible({ timeout: 5_000 });
  });

  test("로그인 없이 보호된 페이지 접근 시 로그인으로 리디렉션", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/, { timeout: 5_000 });
  });

  test("로그인 상태에서 /login 접근 시 대시보드로 리디렉션", async ({ page }) => {
    // 먼저 로그인
    await page.goto("/login");
    await page.fill('[name="email"]',    TEST_EMAIL);
    await page.fill('[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });

    // 로그인 페이지로 다시 이동
    await page.goto("/login");
    await expect(page).toHaveURL(/dashboard/, { timeout: 5_000 });
  });
});
