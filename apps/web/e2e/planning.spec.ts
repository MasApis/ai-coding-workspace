import { expect, test } from "@playwright/test";

async function seedProject(request: import("@playwright/test").APIRequestContext, name: string): Promise<string> {
  const res = await request.post("/api/projects", { data: { name } });
  if (!res.ok()) throw new Error(`seed failed: ${res.status()}`);
  const body = (await res.json()) as { data: { id: string } };
  return body.data.id;
}

test("manual edit, review, and approve flow", async ({ page, request }) => {
  const projectId = await seedProject(request, "Rencana E2E");

  await page.goto(`/projects/${projectId}/planning/prd`);
  await expect(page.getByRole("heading", { name: "Rencana E2E" })).toBeVisible();
  await expect(page.getByText("PRD belum ada")).toBeVisible();
  await page.getByRole("button", { name: "Buat kosong" }).click();
  await expect(page.getByText("Draf v1")).toBeVisible();

  await page.getByLabel("Isi Markdown").fill("# PRD E2E\n\nIsi awal.");
  await expect(page.getByText("Belum disimpan", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Simpan versi baru" }).click();
  await expect(page.getByText("Draf v2")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "Tandai direview" }).click();
  await expect(page.getByText("Direview").first()).toBeVisible();

  await page.getByRole("button", { name: "Setujui" }).click();
  await expect(page.getByText("Versi terkini akan dikunci sebagai approved.")).toBeVisible();
  await page.getByRole("button", { name: "Ya, setujui" }).click();
  await expect(page.getByText("Disetujui").first()).toBeVisible({ timeout: 15000 });
});

test("approved document requires an explicit new draft", async ({ page, request }) => {
  const projectId = await seedProject(request, "Kunci E2E");
  const doc = await request.post(`/api/projects/${projectId}/documents`, {
    data: { type: "PRD", title: "PRD", contentMd: "# v1" },
  });
  const docId = ((await doc.json()) as { data: { id: string } }).data.id;
  await request.post(`/api/documents/${docId}/review`);
  await request.post(`/api/documents/${docId}/approve`);

  await page.goto(`/projects/${projectId}/planning/prd`);
  await expect(page.getByText("Disetujui").first()).toBeVisible();
  const area = page.getByLabel("Isi Markdown");
  await area.fill("# v1\n\nPerubahan diam-diam.");
  await page.getByRole("button", { name: /Buat draf baru dari approved/ }).click();
  await expect(page.getByText("Draf v2")).toBeVisible({ timeout: 15000 });
});
