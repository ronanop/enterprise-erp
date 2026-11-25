import json
import ssl
import urllib.request
from pathlib import Path

state = json.loads(Path.home().joinpath(".expo/state.json").read_text(encoding="utf-8"))
auth = state.get("auth") or {}
print("auth keys", list(auth.keys()))
session = auth.get("sessionSecret") or auth.get("accessToken")
if isinstance(session, dict):
    session = json.dumps(session)

build_id = "af6862e3-95ef-442f-a326-acacee6725f8"
# GraphQL endpoint used by Expo
query = {
    "query": """
      query GetBuild($buildId: String!) {
        builds {
          byId(buildId: $buildId) {
            id
            status
            error {
              errorCode
              message
            }
            logFiles
          }
        }
      }
    """,
    "variables": {"buildId": build_id},
}
body = json.dumps(query).encode("utf-8")
req = urllib.request.Request(
    "https://api.expo.dev/graphql",
    data=body,
    headers={
        "Content-Type": "application/json",
        "expo-session": session or "",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
        print(json.dumps(payload, indent=2)[:4000])
except Exception as exc:
    print("graphql err", exc)
