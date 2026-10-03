import { initialStore, newCharacter } from "../../src/domain/model";
import { test, expect } from "@playwright/test";
import { showcaseFixture } from "../showcase-fixture";
test.beforeEach(async ({ page, baseURL }) => {
  const r = await page.request.post("/api/auth/register", {
    headers: { Origin: baseURL! },
    data: {
      username: "e2e_" + crypto.randomUUID().replaceAll("-", "").slice(0, 20),
      password: "test_only_password_123",
    },
  });
  expect(r.ok()).toBe(true);
});
async function importShowcase(page: any) {
  await page.route("**/api/showcase?*", (route: any) =>
    route.fulfill({ json: showcaseFixture() }),
  );
  await page.goto("/");
  await page.getByLabel("游戏 UID").fill("123456789");
  await page.getByRole("button", { name: "读取公开展柜", exact: true }).click();
  await page.getByRole("button", { name: "合并选中的 1 位角色" }).click();
}
test("two entry points, import directly to analysis, restore on reload", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await importShowcase(page);
  await expect(
    page.getByRole("navigation", { name: "主要功能" }).getByRole("button"),
  ).toHaveCount(2);
  for (const name of [
    "快速问诊",
    "诊断与教学",
    "行动计划",
    "反馈与历史",
    "资料与工具",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  await expect(
    page.getByRole("heading", { name: "菲谢尔 · 基础体检" }),
  ).toBeVisible();
  await expect(page.locator(".checkup-grid article")).toHaveCount(5);
  await expect(page.getByLabel("角色等级", { exact: true })).toHaveCount(0);
  await page.getByLabel("本次检查的玩法").selectOption("月感电");
  await expect(page.locator(".main-stat-details")).toContainText("KQM");
  await page
    .getByText("实际使用队伍（可选，最多四人）", { exact: true })
    .click();
  await page.getByRole("checkbox", { name: "菲谢尔", exact: true }).check();
  await expect(
    page.getByRole("status").filter({ hasText: "已保存到账号" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("游戏 UID")).toHaveValue("123456789");
  await expect(
    page.getByRole("heading", { name: "菲谢尔 · 基础体检" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-focused.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("invalid UID and empty showcase never create results", async ({
  page,
}) => {
  await page.route("**/api/showcase?*", (route) =>
    route.fulfill({ json: { ...showcaseFixture(), avatarInfoList: [] } }),
  );
  await page.goto("/");
  await page.getByLabel("游戏 UID").fill("123");
  await page.getByRole("button", { name: "读取公开展柜", exact: true }).click();
  await expect(page.locator(".uid-import").getByRole("alert")).toContainText(
    "9或10位",
  );
  await page.getByLabel("游戏 UID").fill("123456789");
  await page.getByRole("button", { name: "读取公开展柜", exact: true }).click();
  await expect(
    page.getByText("未读取到公开角色详情。", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".checkup")).toHaveCount(0);
});
test("lunar topic stays usable and returns to UID page", async ({
  page,
}, info) => {
  await importShowcase(page);
  await page.getByRole("button", { name: "☾ 月感电专题", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "六位角色，各司其职" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "启用专项并查看分析", exact: false })
    .click();
  await expect(page.locator("#lunar-results")).toContainText(
    "先确认谁开启月感电",
  );
  await expect(page.getByLabel("本阶段可投入时间（分钟）")).toHaveCount(0);
  await page.screenshot({
    path: `test-results/${info.project.name}-focused-lunar.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "返回 UID 导入与分析", exact: false })
    .click();
  await expect(page.getByLabel("游戏 UID")).toHaveValue("123456789");
});
test("backup roundtrip keeps old data and invalid file does not overwrite", async ({
  page,
}) => {
  await importShowcase(page);
  await page.getByText("本地备份", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载备份" }).click();
  const file = await downloadPromise;
  const path = await file.path();
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".checkup")).toContainText("菲谢尔");
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".checkup")).toContainText("菲谢尔");
});

test("saved unknown character migrates on load and persists without losing level", async ({
  page,
  baseURL,
}) => {
  const { user } = await (await page.request.get("/api/auth/me")).json();
  const store = initialStore();
  const c = newCharacter("未知角色 #10000125");
  c.id = "enka-123456789-10000125";
  c.level = 90;
  store.profile.characters = [c];
  store.profile.team = [c.id];
  const saved = await page.request.put("/api/account/data", {
    headers: { Origin: baseURL!, "X-Account-Id": user.id },
    data: { store, revision: 0 },
  });
  expect(saved.ok()).toBe(true);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "哥伦比娅 · 基础体检" }),
  ).toBeVisible();
  const data = await (
    await page.request.get("/api/account/data", {
      headers: { "X-Account-Id": user.id },
    })
  ).json();
  expect(data.store.profile.characters[0].name).toBe("哥伦比娅");
  expect(data.store.profile.characters[0].level).toBe(90);
  expect(data.store.profile.team).toEqual([c.id]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "哥伦比娅 · 基础体检" }),
  ).toBeVisible();
});
