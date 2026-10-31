import { expect, test } from "@playwright/test";

const WIDTHS = [320, 390, 768, 1024, 1440];

test("keyboard reaches the main content and provider form validates", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toContainText(/Lewati ke konten|Ringkasan|Proyek/);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Pengaturan" })).toBeVisible();
  await page.getByRole("button", { name: "Tambah provider" }).click();
  await expect(page.getByRole("heading", { name: "Tambah provider" })).toBeVisible();
  await page.getByLabel("Label", { exact: true }).fill("Buruk");
  await page.getByLabel("Protokol").selectOption("openai-compatible");
  await page.getByLabel("Base URL").fill("http://api.example.com/v1");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/valid|belum valid/i).first()).toBeVisible({ timeout: 15000 });
  await page.keyboard.press("Escape");
});

for (const width of WIDTHS) {
  test(`overview has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ringkasan" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `e2e/screenshots/overview-${width}.png` });
  });
}

test("chat without a provider shows the empty state", async ({ page, request }) => {
  const res = await request.post("/api/projects", { data: { name: "Chat E2E" } });
  const projectId = ((await res.json()) as { data: { id: string } }).data.id;
  await page.goto(`/projects/${projectId}/chat`);
  await expect(page.getByText("Belum ada provider AI")).toBeVisible();
  await expect(page.getByRole("link", { name: /Pengaturan/ }).first()).toBeVisible();
});
