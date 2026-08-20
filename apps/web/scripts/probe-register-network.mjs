/**
 * Capture Asset Register network errors after login.
 */
import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const apiCalls = [];

  page.on("response", async (res) => {
    const u = res.url();
    if (!u.includes("/api/v1/")) return;
    let body = "";
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      body = "";
    }
    if (u.includes("/assets/") || u.includes("/auth/") || res.status() >= 400) {
      apiCalls.push({
        status: res.status(),
        url: u.replace("http://localhost:8000", ""),
        body,
      });
    }
  });

  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill("assets.user@example.com");
  await page.locator("#password").fill("Secure1!");
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });
  await page.goto("http://localhost:3000/assets/assets", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(12000);

  console.log(JSON.stringify(apiCalls, null, 2));
  await browser.close();
}

main();
