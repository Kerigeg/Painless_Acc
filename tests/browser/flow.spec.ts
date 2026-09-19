import { test, expect } from "@playwright/test";
test("blank profile → diagnosis → tutorial → feedback → reload → import/export", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "下一段旅途，轻松一点。" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-home.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "开始快速问诊" }).click();
  await page.getByRole("button", { name: "第二轮没能量", exact: true }).click();
  await page.getByLabel("本阶段可投入时间").fill("10");
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("蒙德区域").selectOption("已解锁");
  await page.getByRole("button", { name: "下一步" }).click();
  await page
    .getByRole("textbox", { name: "角色名称", exact: true })
    .fill("凯亚");
  await page.getByRole("button", { name: "添加角色" }).click();
  await page.getByLabel("当前队伍", { exact: true }).check();
  await page.getByRole("button", { name: "生成诊断" }).click();
  await expect(
    page.getByRole("heading", { name: "先找能量去了哪里" }),
  ).toBeVisible();
  await page
    .locator(".diagnosis")
    .filter({ hasText: "先找能量去了哪里" })
    .getByRole("button", { name: "基础教学", exact: true })
    .click();
  await expect(
    page.getByText("像把包裹送给正确的人", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "账号档案", exact: false })
    .first()
    .click();
  await page.getByLabel("能否应对当前低风险场景").selectOption("可用");
  await page.getByLabel("当前职责").selectOption("后台输出");
  await page
    .getByRole("button", { name: "行动计划", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "凯亚 · 看清微粒再切人" }),
  ).toBeVisible();
  await page
    .locator(".task")
    .first()
    .getByRole("button", { name: "记录执行结果" })
    .click();
  await page
    .getByLabel("场景标识")
    .first()
    .fill("蒙德，固定低风险场景，无增益");
  await page.getByLabel("舒适度（1—5）").first().fill("2");
  await page.getByRole("button", { name: "保存反馈并更新计划" }).click();
  await expect(page.getByRole("heading", { name: "历史记录" })).toContainText(
    "1 条",
  );
  await page
    .getByRole("button", { name: "行动计划", exact: false })
    .first()
    .click();
  await page
    .locator(".task")
    .filter({ hasText: "凯亚 · 看清微粒再切人" })
    .getByRole("button", { name: "记录执行结果" })
    .click();
  await page.getByLabel("实际执行结果").selectOption("操作不出来");
  await page.getByRole("button", { name: "保存反馈并更新计划" }).click();
  await page
    .getByRole("button", { name: "行动计划", exact: false })
    .first()
    .click();
  await expect(
    page.getByText("只按一次战技，等效果出现，不做连招。"),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-plan.png`,
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "账号档案", exact: false })
    .first()
    .click();
  await expect(page.getByLabel("当前职责")).toHaveValue("后台输出");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON 备份" }).click();
  const file = await download;
  await file.saveAs(`test-results/${info.project.name}-export.json`);
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await expect(page.getByRole("alert")).toContainText("导入失败");
  await page
    .locator("input[type=file]")
    .setInputFiles(`test-results/${info.project.name}-export.json`);
  await expect(page.getByRole("status")).toContainText("导入完成");
  await page.getByLabel("角色等级", { exact: true }).fill("999");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("角色等级", { exact: true }).fill("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("example Barbara path and enough branch", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "用示例体验" }).click();
  await page
    .getByRole("button", { name: "行动计划", exact: false })
    .first()
    .click();
  await page
    .locator(".task")
    .first()
    .getByRole("button", { name: "记录执行结果" })
    .click();
  await page.getByLabel("场景标识").first().fill("蒙德安全地带");
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
        name: "芭芭拉 · 先把血线稳下来",
        exact: true,
      }),
    })
    .getByRole("button", { name: "记录执行结果" })
    .click();
  await page.getByLabel("实际执行结果").selectOption("现在已经够用了");
  await page.getByRole("button", { name: "保存反馈并更新计划" }).click();
  await page
    .getByRole("button", { name: "行动计划", exact: false })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "本阶段结束" })).toBeVisible();
});
