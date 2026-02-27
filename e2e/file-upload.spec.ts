test.describe("파일 업로드", () => {

  test.beforeEach(async ({ page }) => {
    // 로그인 상태 확보
    await page.goto("/login");
    await page.fill('[name="email"]',    TEST_EMAIL);
    await page.fill('[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
  });

  test("파일 업로드 성공", async ({ page }) => {
    // 업로드 버튼 또는 드래그존 탐지
    const uploadInput = page.locator('input[type="file"]').first();
    await uploadInput.setInputFiles({
      name:     "test-upload.txt",
      mimeType: "text/plain",
      buffer:   Buffer.from("이음 E2E 테스트 파일입니다"),
    });

    // 업로드 완료 확인
    await expect(page.locator("text=test-upload.txt")).toBeVisible({ timeout: 10_000 });
  });

  test("50MB 초과 파일 업로드 시 에러 표시", async ({ page }) => {
    const uploadInput = page.locator('input[type="file"]').first();
    const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB
    await uploadInput.setInputFiles({
      name:     "too-large.bin",
      mimeType: "application/octet-stream",
      buffer:   largeBuffer,
    });
    await expect(page.locator("text=/크기|초과|MB/")).toBeVisible({ timeout: 5_000 });
  });

  test("파일 검색", async ({ page }) => {
    await page.goto("/dashboard");
    const searchInput = page.locator('[placeholder*="검색"]').first();
    await searchInput.fill("test-upload");
    await expect(page.locator("text=test-upload.txt")).toBeVisible({ timeout: 5_000 });
  });
});
