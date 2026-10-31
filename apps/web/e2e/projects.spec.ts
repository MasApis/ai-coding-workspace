import { expect, test } from "@playwright/test";

test("wizard creates a project and it appears in the list", async ({ page, request }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Proyek" })).toBeVisible();

  await page.getByRole("link", { name: "Buat proyek baru" }).click();
  await expect(page).toHaveURL(/\/projects\/new/);
  await expect(page.getByRole("heading", { name: "Ide" })).toBeVisible();

  await page.getByLabel("Nama proyek").fill("Toko E2E");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(page.getByRole("heading", { name: "Audiens" })).toBeVisible();
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(page.getByRole("heading", { name: "Batasan" })).toBeVisible();
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(page.getByRole("heading", { name: "Ulasan" })).toBeVisible();
  await page.getByRole("button", { name: "Buat proyek" }).click();

  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+/, { timeout: 15000 });
  await expect(page.getByText("Toko E2E").first()).toBeVisible();

  const list = await request.get("/api/projects?state=all");
  expect(list.ok()).toBe(true);
  const body = (await list.json()) as { data: { items: Array<{ name: string }> } };
  expect(body.data.items.some((p) => p.name === "Toko E2E")).toBe(true);
});
