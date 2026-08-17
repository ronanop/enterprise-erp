from pathlib import Path

root = Path(r"D:/ERP/apps/web/src")
old = "text-sm font-medium tracking-tight"
new = "text-base font-extrabold tracking-tight"
changed: list[str] = []

for path in root.rglob("*.tsx"):
    text = path.read_text(encoding="utf-8")
    if old not in text:
        continue
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    file_changed = False
    for line in lines:
        lower = line.lower()
        is_title_line = (
            "<h2" in lower
            or "<h3" in lower
            or ("id=" in lower and "title" in lower)
        )
        # Skip sidebar identity labels
        if "sidebar-foreground" in line or ("<p" in lower and "truncate" in line):
            out.append(line)
            continue
        if is_title_line and old in line:
            line2 = line.replace(old, new)
            file_changed = file_changed or line2 != line
            out.append(line2)
        else:
            out.append(line)
    if file_changed:
        path.write_text("".join(out), encoding="utf-8")
        changed.append(str(path.relative_to(root)))

print(f"updated {len(changed)} files")
for p in changed:
    print(p)
