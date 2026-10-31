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

test("project shell keeps one header and tabs across sections", async ({ page, request }) => {
  const res = await request.post("/api/projects", { data: { name: "Shell E2E" } });
  const projectId = ((await res.json()) as { data: { id: string } }).data.id;

  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: "Shell E2E" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mulai Brief" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Dokumen", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/documents`));
  await expect(page.getByRole("heading", { name: "Dokumen" })).toBeVisible();
  // The project header survives navigation; pages no longer repeat it.
  await expect(page.getByRole("heading", { name: "Shell E2E" })).toBeVisible();
});
