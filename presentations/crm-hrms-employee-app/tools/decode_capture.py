"""Decode a CDP Page.captureScreenshot JSON response into a PNG file."""

import base64
import json
import sys
from pathlib import Path


def main() -> None:
    src, dest = Path(sys.argv[1]), Path(sys.argv[2])
    payload = json.loads(src.read_text(encoding="utf-8"))
    data = payload.get("data") or payload.get("result", {}).get("data")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(base64.b64decode(data))
    print(dest)


if __name__ == "__main__":
    main()
