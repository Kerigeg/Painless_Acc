import { test, expect } from "@playwright/test";
import { showcaseFixture } from "../showcase-fixture";
test("registration, account saves, logout, incorrect password and isolation", async ({
  page,
}, info) => {
  const username = "ui_" + crypto.randomUUID().replaceAll("-", "").slice(0, 18);
  const password = "test_only_password_123";
  await page.route("**/api/showcase?*", (route) =>
    route.fulfill({ json: showcaseFixture() }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "没有账号，去注册" }).click();
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码", { exact: true }).fill(password);
  await page.screenshot({
    path: `test-results/${info.project.name}-register.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "注册并登录", exact: true }).click();
  await expect(page.getByLabel("游戏 UID")).toBeVisible();
  await page.getByLabel("游戏 UID").fill("123456789");
  await page.getByRole("button", { name: "读取公开展柜", exact: true }).click();
  await page.getByRole("button", { name: "合并选中的 1 位角色" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已保存到账号" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".checkup")).toContainText("菲谢尔");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
  expect((await page.request.get("/api/showcase?uid=123456789")).status()).toBe(
    401,
  );
  await page.getByLabel("用户名", { exact: true }).fill(username);
  await page.getByLabel("密码", { exact: true }).fill("wrong_password_123");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("用户名或密码不正确");
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.locator(".checkup")).toContainText("菲谢尔");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await page.getByRole("button", { name: "没有账号，去注册" }).click();
  await page.getByLabel("用户名", { exact: true }).fill(username + "_b");
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "注册并登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "先导入你的公开角色展柜" }),
  ).toBeVisible();
  await expect(page.locator(".checkup")).toHaveCount(0);
  await page.screenshot({
    path: `test-results/${info.project.name}-account.png`,
    fullPage: true,
  });
});
