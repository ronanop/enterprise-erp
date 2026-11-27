import json
import urllib.error
import urllib.request

BASE = "https://ess-api.iconnectplus.in/api/v1"
UA = "iConnectPlus-EmployeeApp/store-review"


def req(method, path, body=None, token=None):
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
        with urllib.request.urlopen(request, timeout=60) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode())


def login(email):
    status, payload = req(
        "POST",
        "/auth/ess/login",
        {"company_code": "CDPL0112", "email": email, "password": "Review@2026"},
    )
    assert status == 200, payload
    return payload["data"]["access_token"]


def main():
    mgr = login("review.manager@iconnectplus.in")
    st, p = req("POST", "/ess/attendance/punch", {}, token=mgr)
    print("MGR_PUNCH1", st, p.get("message"), (p.get("data") or {}).get("action"))
    st, p = req("POST", "/ess/attendance/punch", {}, token=mgr)
    print("MGR_PUNCH2", st, p.get("message"), (p.get("data") or {}).get("action"))

    emp = login("review.employee@iconnectplus.in")
    for path in [
        "/ess/feed/posts?limit=20",
        "/ess/stories/tray",
        "/ess/tasks?limit=20",
        "/ess/leave-balances",
        "/ess/leave-requests",
        "/ess/attendance",
    ]:
        st, payload = req("GET", path, token=emp)
        data = payload.get("data")
        if isinstance(data, list):
            print(path, "n=", len(data))
        else:
            print(path, data)


if __name__ == "__main__":
    main()
