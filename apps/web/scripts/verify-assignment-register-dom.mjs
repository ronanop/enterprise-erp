/**
 * Live DOM smoke for /assets/asset-assignments.
 * Checks page shell + maps live API rows with the same lifecycle-only STATUS rule
 * the AssetAssignmentWorkspace STATUS cell uses.
 *
 * Usage: node scripts/verify-assignment-register-dom.mjs
 */

const API = process.env.VERIFY_API_BASE ?? "http://127.0.0.1:3000/api/v1";
const EMAIL = process.env.VERIFY_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.VERIFY_PASSWORD ?? "Secure1!";

function registerStatusLabel(status) {
  const lifecycle = String(status ?? "")
    .split("/")[0]
    ?.trim() ?? "";
  const EMPTY = "—";
  const raw = lifecycle.trim();
  if (!raw) return EMPTY;
  const key = raw.toLowerCase().replace(/-/g, "_");
  if (key === "active") return "Active";
  if (key === "returned") return "Returned";
  if (key === "cancelled") return "Cancelled";
  if (
    key === "draft" ||
    key === "submitted" ||
    key === "approved" ||
    key === "rejected" ||
    key === "in_progress" ||
    key === "pending"
  ) {
    return EMPTY;
  }
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
  const login = await loginRes.json();
  const token = login?.data?.access_token;
  if (!token) throw new Error("no access token");

  const asgRes = await fetch(`${API}/assets/asset-assignments?page=1&page_size=25`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!asgRes.ok) throw new Error(`assignments failed: ${asgRes.status}`);
  const asg = await asgRes.json();
  const items = asg?.data?.items ?? [];

  const pageHtml = await fetch("http://127.0.0.1:3000/assets/asset-assignments").then((r) =>
    r.text(),
  );
  const shellOk =
    pageHtml.includes('data-testid="assignment-register-table"') &&
    pageHtml.includes('data-render-source="AssetAssignmentWorkspace"') &&
    pageHtml.includes("Assigned assets") &&
    pageHtml.includes("Asset assignments");

  const rows = items.map((row) => ({
    id: row.id,
    status: row.status,
    workflow_status: row.workflow_status,
    assignee: row.manual_employee_name || row.employee_id || null,
    statusLabel: registerStatusLabel(row.status),
  }));

  const bad = rows.filter(
    (r) =>
      /approved|submitted|draft/i.test(r.statusLabel) ||
      /\//.test(r.statusLabel) ||
      /active\s*\/\s*approved/i.test(r.statusLabel),
  );

  const pageHasComposite =
    /active\s*\/\s*approved/i.test(pageHtml) || /returned\s*\/\s*approved/i.test(pageHtml);

  const ok = shellOk && !pageHasComposite && bad.length === 0;
  console.log(
    JSON.stringify(
      {
        renderComponent: "AssetAssignmentWorkspace",
        shellOk,
        pageHasComposite,
        rowCount: rows.length,
        sample: rows.slice(0, 5),
        badLabels: bad,
        ok,
      },
      null,
      2,
    ),
  );

  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
