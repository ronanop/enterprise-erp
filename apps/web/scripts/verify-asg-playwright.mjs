import { chromium } from "playwright";

const login = await fetch("http://127.0.0.1:3000/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@example.com", password: "Secure1!" }),
}).then((r) => r.json());
const token = login.data.access_token;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.addInitScript((t) => {
  localStorage.setItem("erp_access_token", t);
}, token);
await page.goto("http://127.0.0.1:3000/assets/asset-assignments", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForSelector('[data-testid="assignment-status-badge"]', { timeout: 45000 });

const info = await page.evaluate(() => {
  const table = document.querySelector('[data-testid="assignment-register-table"]');
  const badges = [...document.querySelectorAll('[data-testid="assignment-status-badge"]')].map(
    (el) => ({
      text: el.textContent?.trim(),
      display: el.getAttribute("data-status-display"),
      source: el.getAttribute("data-render-source"),
      raw: el.getAttribute("data-raw-status"),
    }),
  );
  const assignees = [...document.querySelectorAll('[data-testid="assignment-assignee-cell"]')].map(
    (el) => el.textContent?.trim(),
  );
  const actions = [...document.querySelectorAll('[data-testid="assignment-actions-cell"]')].map(
    (el) => el.querySelectorAll("button").length,
  );
  const headers = [...(table?.querySelectorAll("thead th") ?? [])].map((el) =>
    el.textContent?.trim(),
  );
  const body = table?.innerText ?? "";
  return {
    tableSource: table?.getAttribute("data-render-source"),
    headers,
    badges,
    assignees,
    actionButtonCounts: actions,
    hasActiveApproved: /active\s*\/\s*approved/i.test(body),
    hasReturnedApproved: /returned\s*\/\s*approved/i.test(body),
    hasAssetCodeCol: headers.some((h) => /asset code/i.test(h || "")),
    hasAssignedAssignee: assignees.some((a) => a === "Assigned"),
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();

const badgeOk = info.badges.every(
  (b) =>
    (b.text === "Active" || b.text === "Returned" || b.text === "Cancelled" || b.text === "—") &&
    !/\//.test(b.text || "") &&
    !/approved|submitted|draft/i.test(b.text || "") &&
    b.source === "AssetAssignmentWorkspace",
);
const ok =
  info.tableSource === "AssetAssignmentWorkspace" &&
  !info.hasActiveApproved &&
  !info.hasReturnedApproved &&
  !info.hasAssetCodeCol &&
  !info.hasAssignedAssignee &&
  info.actionButtonCounts.every((n) => n === 0) &&
  badgeOk;

if (!ok) process.exit(1);
