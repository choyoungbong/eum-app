test.describe("채팅", () => {

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]',    TEST_EMAIL);
    await page.fill('[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
  });

  test("채팅 페이지 접속 및 채팅방 목록 표시", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.locator("text=/채팅|대화/")).toBeVisible({ timeout: 5_000 });
  });

  test("채팅 메시지 전송", async ({ page }) => {
    await page.goto("/chat");
    // 채팅방 선택 (첫 번째)
    const firstRoom = page.locator('[data-testid="chat-room-item"]').first();
    if (await firstRoom.isVisible()) {
      await firstRoom.click();
      const msgInput = page.locator('[data-testid="chat-input"]');
      await msgInput.fill("E2E 테스트 메시지입니다");
      await msgInput.press("Enter");
      await expect(page.locator("text=E2E 테스트 메시지입니다")).toBeVisible({ timeout: 5_000 });
    }
  });
});
