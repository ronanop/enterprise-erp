"""Capture Employee App (demo mode, port 3001) screens at phone size for the deck."""

from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3001"
OUT = Path(__file__).resolve().parent.parent / "assets"
SCREENS = {
    "app-home": "/home",
    "app-attendance": "/attendance",
    "app-leave": "/leave",
    "app-payslips": "/payslips",
    "app-approvals": "/approvals",
}

HIDE_CHROME = """
() => {
  document.querySelectorAll('nextjs-portal').forEach((e) => e.remove());
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (/^\\s*DEMO DATA/i.test(el.textContent || '') && r.height > 0 && r.height < 60) {
      el.style.display = 'none';
      break;
    }
  }
}
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge")
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
        )
        page = ctx.new_page()
        page.goto(f"{BASE}/login")
        page.get_by_placeholder("e.g. CT535415102003").fill("CT535415102003")
        page.get_by_role("button", name="Sign In").click()
        page.wait_for_url("**/home", timeout=30_000)

        for name, path in SCREENS.items():
            page.goto(f"{BASE}{path}")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            page.evaluate(HIDE_CHROME)
            page.screenshot(path=str(OUT / f"{name}.png"))
            print(name, page.url)
        browser.close()


if __name__ == "__main__":
    main()
