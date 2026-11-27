"""Smoke-test ESS API for the store-review employee account."""
from __future__ import annotations

import json
import urllib.error
import urllib.request

BASE = "https://ess-api.iconnectplus.in/api/v1"
UA = "iConnectPlus-EmployeeApp/store-review"


def req(method: str, path: str, body=None, token: str | None = None):
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "Content-Type": "application/json",
        "User-Agent": UA,
        "Accept": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        BASE + path, data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {"raw": raw}
        return exc.code, payload


def summarize(data):
    if isinstance(data, list):
        return f"array[{len(data)}]"
    if isinstance(data, dict):
        return "object[" + ",".join(list(data)[:5]) + "]"
    return str(data)


def main() -> None:
    status, login = req(
        "POST",
        "/auth/ess/login",
        {
            "company_code": "CDPL0112",
            "email": "review.employee@iconnectplus.in",
            "password": "Review@2026",
        },
    )
    print("LOGIN", status, login.get("message"))
    token = (login.get("data") or {}).get("access_token")
    if not token:
        print(json.dumps(login, indent=2)[:1200])
        raise SystemExit(1)

    checks = [
        "/ess/me",
        "/ess/leave-balances",
        "/ess/leave-types",
        "/ess/leave-requests",
        "/ess/attendance",
        "/ess/attendance/summary?month=2026-11",
        "/ess/attendance/punch-policy",
        "/ess/hrms-profile",
        "/ess/profile/bank",
        "/ess/profile/emergency",
        "/ess/profile/education",
        "/ess/profile/kyc",
        "/ess/tasks?limit=10",
        "/ess/payslips",
        "/ess/holidays",
        "/ess/announcements",
        "/ess/meeting-rooms",
        "/ess/policies",
        "/ess/documents",
        "/ess/assets",
        "/ess/support-tickets",
        "/ess/training",
        "/ess/performance",
        "/ess/separation",
        "/ess/feed/posts?limit=5",
        "/ess/stories/tray",
        "/ess/security/face/status",
        "/ess/wfh-requests",
        "/ess/on-duty-requests",
        "/ess/compoff-requests",
        "/ess/attendance-corrections",
        "/ess/approvals",
        "/ess/notifications",
        "/ess/notifications/unread-count",
    ]
    fails = []
    for path in checks:
        code, payload = req("GET", path, token=token)
        msg = payload.get("message")
        print(f"{code} GET {path} :: {msg} :: {summarize(payload.get('data'))}")
        if code >= 400:
            fails.append((path, code, msg, payload))

    # Mutations expected to work for reviewers (weekday leave only).
    code, payload = req(
        "POST",
        "/ess/leave-requests",
        {
            "leave_type_id": "b7036273-4ea9-446d-83e8-06bd0a866ce6",
            "start_date": "2026-11-30",
            "end_date": "2026-11-30",
            "days_count": 1,
            "reason": "Store review smoke test - casual leave",
        },
        token,
    )
    print("LEAVE APPLY", code, payload.get("message"), json.dumps(payload)[:500])
    # 409 duplicate same-day leave is acceptable after prior smoke runs.
    if code >= 400 and "already" not in str(payload.get("message", "")).lower():
        if code != 409:
            fails.append(
                ("POST /ess/leave-requests", code, payload.get("message"), payload)
            )

    code, payload = req(
        "POST",
        "/ess/wfh-requests",
        {
            "wfh_date": "2026-11-30",
            "portion": "full_day",
            "reason": "Store review WFH",
        },
        token,
    )
    print("WFH APPLY", code, payload.get("message"), json.dumps(payload)[:500])
    if code >= 400 and code != 409:
        fails.append(("POST /ess/wfh-requests", code, payload.get("message"), payload))

    code, payload = req(
        "POST",
        "/ess/attendance/punch",
        {"image_base64": None},
        token,
    )
    print("PUNCH", code, payload.get("message"), json.dumps(payload.get("data"))[:400])
    # Until store-review re-punch is deployed, same-day re-check-in after
    # checkout returns 409 — treat as known staging limitation.
    if code >= 400 and payload.get("message") != "Already checked out for today":
        fails.append(("POST /ess/attendance/punch", code, payload.get("message"), payload))

    me = req("GET", "/ess/me", token=token)[1].get("data") or {}
    emp_id = me.get("employee_id")
    if emp_id:
        code, payload = req(
            "POST",
            "/ess/tasks",
            {
                "title": "Store review follow-up",
                "description": "Self-assigned smoke task",
                "assignee_employee_ids": [emp_id],
            },
            token,
        )
        print("TASK CREATE", code, payload.get("message"))
        if code >= 400:
            fails.append(("POST /ess/tasks", code, payload.get("message"), payload))


    print("\nFAIL COUNT", len(fails))
    for item in fails:
        print("FAIL", item[0], item[1], item[2])
        print(json.dumps(item[3])[:400])


if __name__ == "__main__":
    main()
