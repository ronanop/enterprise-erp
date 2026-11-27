"""Seed rich App Review demo content for review.employee / review.manager.

Covers the recording path:
  Login → Feed (posts + stories + comments) → Attendance readiness
  → Leave balances → Tasks → Profile deletion (UI already present)

Run:
  python scripts/_seed_review_demo.py
"""

from __future__ import annotations

import base64
import io
import json
import struct
import urllib.error
import urllib.request
import zlib
from datetime import date, timedelta

BASE = "https://ess-api.iconnectplus.in/api/v1"
UA = "iConnectPlus-EmployeeApp/store-review"
COMPANY = "CDPL0112"
MANAGER = ("review.manager@iconnectplus.in", "Review@2026")
EMPLOYEE = ("review.employee@iconnectplus.in", "Review@2026")


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def solid_png_b64(width: int, height: int, rgb: tuple[int, int, int]) -> str:
    """Minimal truecolor PNG (no deps) for feed/story media."""
    r, g, b = rgb
    raw = b"".join(b"\x00" + bytes([r, g, b]) * width for _ in range(height))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", zlib.compress(raw, 9))
        + _png_chunk(b"IEND", b"")
    )
    return base64.b64encode(png).decode("ascii")


BLUE = solid_png_b64(640, 640, (37, 99, 235))
TEAL = solid_png_b64(640, 640, (13, 148, 136))
SLATE = solid_png_b64(640, 640, (71, 85, 105))
AMBER = solid_png_b64(640, 640, (217, 119, 6))
ROSE = solid_png_b64(360, 640, (225, 29, 72))


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
        with urllib.request.urlopen(request, timeout=120) as res:
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
    print(f"OK login {email}")
    return token


def create_post(token: str, caption: str, png_b64: str, aspect: str = "1:1"):
    status, payload = req(
        "POST",
        "/ess/feed/posts",
        {
            "caption": caption,
            "aspect_ratio": aspect,
            "media": [
                {
                    "media_type": "image",
                    "file_name": "review-post.png",
                    "content_base64": png_b64,
                    "width": 640,
                    "height": 640 if aspect == "1:1" else 1138,
                }
            ],
        },
        token=token,
    )
    ok = status == 200
    pid = (payload.get("data") or {}).get("id") if isinstance(payload, dict) else None
    print(f"{'OK' if ok else 'FAIL'} feed post {status} {caption[:48]!r} id={pid}")
    return pid


def create_story(token: str, caption: str, png_b64: str):
    status, payload = req(
        "POST",
        "/ess/stories",
        {
            "media_type": "image",
            "file_name": "review-story.png",
            "content_base64": png_b64,
            "caption": caption,
            "width": 360,
            "height": 640,
        },
        token=token,
    )
    ok = status == 200
    print(f"{'OK' if ok else 'FAIL'} story {status} {caption[:40]!r}")
    return ok


def add_comment(token: str, post_id: str, body: str):
    status, payload = req(
        "POST",
        f"/ess/feed/posts/{post_id}/comments",
        {"body": body},
        token=token,
    )
    print(f"{'OK' if status == 200 else 'FAIL'} comment {status} on {post_id[:8]}")


def like_post(token: str, post_id: str):
    status, _ = req("POST", f"/ess/feed/posts/{post_id}/like", token=token)
    print(f"{'OK' if status == 200 else 'FAIL'} like {status} on {post_id[:8]}")


def ensure_tasks(creator_token: str, assignee_employee_id: str):
    status, payload = req("GET", "/ess/tasks?limit=20", token=creator_token)
    existing = (payload.get("data") if isinstance(payload, dict) else None) or []
    titles = {t.get("title") for t in existing if isinstance(t, dict)}
    wanted = [
        {
            "title": "App Review — verify attendance punch",
            "description": "Open Attendance and complete Check In / Check Out.",
        },
        {
            "title": "App Review — apply casual leave",
            "description": "Hub → Leave → apply CL on a weekday.",
        },
        {
            "title": "App Review — open data deletion",
            "description": "Profile → Request account / data deletion.",
        },
    ]
    for item in wanted:
        if item["title"] in titles:
            print(f"SKIP task already exists: {item['title']}")
            continue
        body = {
            "title": item["title"],
            "description": item["description"],
            "assignment_mode": "users",
            "assignee_employee_ids": [assignee_employee_id],
        }
        st, res = req("POST", "/ess/tasks", body, token=creator_token)
        if st in (200, 201):
            print(f"OK task {st} {item['title']}")
        else:
            print(f"FAIL task {st} {item['title']} {res}")


def next_weekday(start: date | None = None) -> date:
    d = start or (date.today() + timedelta(days=1))
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def summarize(token: str, label: str):
    paths = [
        "/ess/feed/posts?limit=20",
        "/ess/stories/tray",
        "/ess/leave-balances",
        "/ess/leave-types",
        "/ess/attendance",
        "/ess/attendance/punch-policy",
        "/ess/tasks?limit=20",
        "/ess/announcements",
        "/ess/notifications",
    ]
    print(f"\n=== {label} snapshot ===")
    for path in paths:
        st, payload = req("GET", path, token=token)
        data = payload.get("data") if isinstance(payload, dict) else None
        if isinstance(data, list):
            print(f"  {st} {path} n={len(data)}")
        elif isinstance(data, dict):
            print(f"  {st} {path} {json.dumps(data)[:160]}")
        else:
            msg = payload.get("message") if isinstance(payload, dict) else payload
            print(f"  {st} {path} {msg}")


def try_punch_ready(token: str):
    st, policy = req("GET", "/ess/attendance/punch-policy", token=token)
    print(f"punch-policy {st} {json.dumps(policy.get('data') if isinstance(policy, dict) else policy)[:200]}")
    st, att = req("GET", "/ess/attendance", token=token)
    rows = (att.get("data") if isinstance(att, dict) else None) or []
    today = date.today().isoformat()
    today_rows = [
        r
        for r in rows
        if isinstance(r, dict)
        and str(r.get("attendance_date") or r.get("date") or "")[:10] == today
    ]
    print(f"attendance today rows={len(today_rows)} sample={json.dumps(today_rows[:1])[:220]}")
    # Soft attempt — store-review mode may allow re-punch
    st, punched = req("POST", "/ess/attendance/punch", {}, token=token)
    print(f"punch attempt {st} {json.dumps(punched)[:220] if isinstance(punched, dict) else punched}")


def main() -> None:
    emp = login(*EMPLOYEE)
    mgr = login(*MANAGER)

    captions_mgr = [
        (
            "Team update: welcome to the iConnect+ workplace feed. "
            "Open ⋮ on this post → Report / Block author / Complain (App Review demo).",
            BLUE,
        ),
        (
            "Reminder: submit attendance from Attendance tab. Staging allows punch without geofence/selfie.",
            TEAL,
        ),
        (
            "HR tip: leave balances are ready — apply Casual Leave (CL) on a weekday from Hub → Leave.",
            SLATE,
        ),
        (
            "Safety: use Profile → Request account / data deletion to start an account deletion request.",
            AMBER,
        ),
    ]

    post_ids: list[str] = []
    for caption, png in captions_mgr:
        pid = create_post(mgr, caption, png)
        if pid:
            post_ids.append(pid)

    # One post from employee so feed feels two-sided
    emp_post = create_post(
        emp,
        "Thanks Rohan — testing Report / Block on manager posts for App Store review.",
        TEAL,
    )
    if emp_post:
        post_ids.append(emp_post)

    # Engagement on manager posts
    for pid in post_ids[:3]:
        like_post(emp, pid)
        add_comment(emp, pid, "Noted — reviewing this for App Store demo.")
        add_comment(mgr, pid, "Thanks Asha — use ⋮ → Report or Block if needed.")

    create_story(mgr, "Morning standup — App Review demo story", ROSE)
    create_story(emp, "On campus today · review build", AMBER)

    st, me = req("GET", "/ess/me", token=emp)
    emp_id = (me.get("data") or {}).get("employee_id") if isinstance(me, dict) else None
    if emp_id:
        ensure_tasks(mgr, emp_id)
    else:
        print(f"FAIL could not resolve employee id for tasks: {me}")

    # Leave readiness hint
    st, balances = req("GET", "/ess/leave-balances", token=emp)
    print(f"leave-balances {st} {json.dumps(balances.get('data') if isinstance(balances, dict) else balances)[:300]}")
    st, types = req("GET", "/ess/leave-types", token=emp)
    print(f"leave-types {st} {json.dumps(types.get('data') if isinstance(types, dict) else types)[:300]}")
    print(f"Suggested leave date (weekday): {next_weekday().isoformat()}")

    try_punch_ready(emp)

    summarize(emp, "employee (Asha)")
    summarize(mgr, "manager (Rohan)")
    print("\nDone. Review login: review.employee@iconnectplus.in / Review@2026")


if __name__ == "__main__":
    main()
