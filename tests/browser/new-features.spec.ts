import { test, expect } from "@playwright/test";
import { showcaseFixture } from "../showcase-fixture";
test("UID preview, merge, cached refresh, persistence and import history", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let calls = 0;
  await page.route("**/api/showcase?*", async (route) => {
    calls++;
    await route.fulfill({ json: showcaseFixture() });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "UID 导入配置", exact: true }).click();
  await page.getByLabel("游戏 UID").fill("123");
  await page.getByRole("button", { name: "读取公开展柜", exact: true }).click();
  await expect(page.locator(".uid-import").getByRole("alert")).toContainText(
    "9或10位",
  );
  expect(calls).toBe(0);
  await page.getByLabel("游戏 UID").fill("123456789");
  await page.getByRole("button", { name: "读取公开展柜", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "导入预览 · 测试旅人" }),
  ).toBeVisible();
  await expect(
    page.getByText("雷元素伤害% 46.6", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-uid.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "合并选中的 1 位角色" }).click();
  await expect(page.getByRole("status")).toContainText("已合并 1 位角色");
  await expect(page.getByLabel("当前职责")).toHaveValue("后台输出");
  await expect(page.getByLabel("能否应对当前低风险场景")).toHaveValue("未知");
  await expect(page.getByLabel("面板来源")).toHaveValue("展柜快照（增益未知）");
  await page.reload();
  await page
    .getByRole("button", { name: "账号档案", exact: false })
    .first()
    .click();
  await expect(page.getByLabel("游戏 UID")).toHaveValue("123456789");
  await expect(page.getByLabel("角色等级", { exact: true })).toHaveValue("90");
  await page
    .getByRole("button", { name: "反馈与历史", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "UID 导入快照 · 1 次" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("private showcase and provider errors do not mutate profile", async ({
  page,
}) => {
  let mode = "private";
  await page.route("**/api/showcase?*", (route) =>
    mode === "private"
      ? route.fulfill({ json: { ...showcaseFixture(), avatarInfoList: [] } })
      : route.fulfill({
          status: 429,
          headers: { "Retry-After": "30" },
          json: { error: "查询过于频繁，请稍后再试", retryAfter: 30 },
        }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "UID 导入配置", exact: true }).click();
  await page.getByLabel("游戏 UID").fill("123456789");
  await page.getByRole("button", { name: "读取公开展柜", exact: true }).click();
  await expect(
    page.getByText("未读取到公开角色详情。", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /合并选中的/ })).toHaveCount(0);
  mode = "error";
  await page.getByLabel("游戏 UID").fill("987654321");
  await page.getByRole("button", { name: "读取公开展柜", exact: true }).click();
  await expect(page.locator(".uid-import").getByRole("alert")).toContainText(
    "查询过于频繁",
  );
  await expect(page.getByRole("button", { name: /秒后可刷新/ })).toBeDisabled();
});
test("Lunar team ownership, observations, tutorial and feedback", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "进入月感电专题 →" }).click();
  await expect(
    page.getByRole("heading", { name: "先让水雷衔接起来。" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "应用这支已可用队伍" }).first(),
  ).toBeDisabled();
  for (const name of ["砂糖", "哥伦比娅", "菲林斯", "伊涅芙"]) {
    const card = page
      .locator(".lunar-character")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await card.getByRole("button", { name: "我已拥有，加入档案" }).click();
    await page.getByLabel(`${name}能否应对练习场景`).selectOption("可用");
  }
  await page
    .locator(".team-template")
    .first()
    .getByRole("button", { name: "应用这支已可用队伍" })
    .click();
  await page.getByLabel("雷云观察").selectOption("中断");
  await page.getByLabel("已有能应对的低风险场景").selectOption("已确认");
  await page.getByLabel("已解锁练习地区").fill("蒙德固定练习场景");
  await page.getByLabel("本阶段可投入时间").fill("8");
  await page.getByLabel("菲林斯战技状态中途切人").selectOption("是");
  await page.screenshot({
    path: `test-results/${info.project.name}-lunar.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "启用专项并查看诊断" }).click();
  await expect(
    page.getByRole("heading", { name: "先复核雷云与挂水断点" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "菲林斯先练短爆发窗口" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "行动计划", exact: false })
    .first()
    .click();
  await page
    .locator(".task")
    .first()
    .getByRole("button", { name: "记录执行结果" })
    .click();
  await page.getByLabel("场景标识").first().fill("同一低风险敌人");
  await page.getByLabel("舒适度（1—5）").first().fill("3");
  await page.getByRole("button", { name: "保存反馈并更新计划" }).click();
  await page
    .getByRole("button", { name: "行动计划", exact: false })
    .first()
    .click();
  await page
    .locator(".task")
    .filter({
      has: page.getByRole("heading", {
        name: "月感电 · 后台铺场到菲林斯短爆发",
        exact: true,
      }),
    })
    .getByRole("button", { name: "记录执行结果" })
    .click();
  await page.getByLabel("实际执行结果").selectOption("完成，没有改善");
  await page.getByRole("button", { name: "保存反馈并更新计划" }).click();
  await page
    .getByRole("button", { name: "诊断与教学", exact: false })
    .first()
    .click();
  await expect(
    page.locator(".diagnosis").filter({
      has: page.getByRole("heading", { name: "菲林斯先练短爆发窗口" }),
    }),
  ).toContainText("原判断未被验证");
  expect(errors).toEqual([]);
});

test("unknown character name can be corrected without losing imported configuration", async ({
  page,
}, info) => {
  const fixture = showcaseFixture();
  fixture.characters = {} as typeof fixture.characters;
  await page.route("**/api/showcase?*", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "UID 导入配置", exact: true }).click();
  await page.getByLabel("游戏 UID").fill(fixture.uid);
  await page.getByRole("button", { name: "读取公开展柜", exact: true }).click();
  await page.getByRole("button", { name: "合并选中的 1 位角色" }).click();
  await page.getByLabel("校正角色名称").fill("奥黛塔");
  await page.getByRole("button", { name: "保存校正名称" }).click();
  await expect(
    page.getByText("名称来源：用户校正", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("角色等级", { exact: true })).toHaveValue("90");
  await page.reload();
  await page.getByRole("button", { name: "▤ 账号档案", exact: true }).click();
  await expect(page.getByLabel("校正角色名称")).toHaveValue("奥黛塔");
  await expect(
    page.getByText("此角色未收录专属机制", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-name-correction.png`,
    fullPage: true,
  });
});
