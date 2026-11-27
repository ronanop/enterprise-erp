"""Ensure store-review feed has at least one post for UGC Report/Block demo.

Creates a published post as the manager account if the employee feed is empty.
Run from apps/employee-app-by-Rishabh:

  python scripts/_seed_review_feed.py
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request

BASE = "https://ess-api.iconnectplus.in/api/v1"
UA = "iConnectPlus-EmployeeApp/store-review"
COMPANY = "CDPL0112"
MANAGER = ("review.manager@iconnectplus.in", "Review@2026")
EMPLOYEE = ("review.employee@iconnectplus.in", "Review@2026")
# 1×1 PNG
PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def req(method: str, path: str, body=None, token: str | None = None):
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": UA,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(
        BASE + path, data=data, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = raw
        return exc.code, payload


def login(email: str, password: str) -> str:
    status, payload = req(
        "POST",
        "/auth/ess/login",
        {"company_code": COMPANY, "email": email, "password": password},
    )
    if status != 200 or not isinstance(payload, dict):
        raise SystemExit(f"Login failed for {email}: {status} {payload}")
    token = (payload.get("data") or {}).get("access_token")
    if not token:
        raise SystemExit(f"No token for {email}: {payload}")
    return token


def main() -> None:
    emp_token = login(*EMPLOYEE)
    status, posts = req("GET", "/ess/feed/posts?limit=5", token=emp_token)
    count = len((posts.get("data") if isinstance(posts, dict) else None) or [])
    print(f"Employee feed posts: {count}")
    if count > 0:
        print("OK — UGC demo content already present")
        return

    mgr_token = login(*MANAGER)
    status, created = req(
        "POST",
        "/ess/feed/posts",
        {
            "caption": (
                "Welcome to iConnect+ workplace feed — use the post menu to "
                "Report, Block author, or Complain."
            ),
            "aspect_ratio": "1:1",
            "media": [
                {
                    "media_type": "image",
                    "file_name": "review-welcome.png",
                    "content_base64": PNG_B64,
                    "width": 1,
                    "height": 1,
                }
            ],
        },
        token=mgr_token,
    )
    print(f"CREATE {status}")
    print(json.dumps(created, indent=2)[:600])
    if status != 200:
        raise SystemExit(1)
    print("Seeded manager welcome post for App Review UGC demo")


if __name__ == "__main__":
    main()
