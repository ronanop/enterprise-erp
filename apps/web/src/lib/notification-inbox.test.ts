import assert from "node:assert/strict";
import { test } from "node:test";

import { mapInboxHref, NOTIFICATION_POLL_MS } from "./notification-inbox.ts";

test("poll interval is 15 seconds", () => {
  assert.equal(NOTIFICATION_POLL_MS, 15_000);
});

test("safe relative hrefs pass through", () => {
  assert.equal(mapInboxHref("/hr/ess-inbox", "leave"), "/hr/ess-inbox");
  assert.equal(mapInboxHref("  /hr  ", "birthday"), "/hr");
});

test("unsafe hrefs fall back to kind routes", () => {
  assert.equal(mapInboxHref("https://evil.example/phish", "interview"), "/hr/recruitment");
  assert.equal(mapInboxHref("//evil.example", "leave"), "/hr/ess-inbox");
  assert.equal(mapInboxHref(null, "birthday"), "/hr");
});
