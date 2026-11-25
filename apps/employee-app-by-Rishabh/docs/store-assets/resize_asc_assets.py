from pathlib import Path

from PIL import Image

assets = Path(
    r"C:\Users\cache\.cursor\projects\c-Users-cache-OneDrive-Documents-enterprise-erp\assets"
)
out = Path(
    r"c:\Users\cache\OneDrive\Documents\enterprise-erp\apps\employee-app-by-Rishabh\docs\store-assets\ios"
)
out.mkdir(parents=True, exist_ok=True)


def cover_resize(src: Path, dest: Path, size: tuple[int, int]) -> None:
    im = Image.open(src).convert("RGB")
    tw, th = size
    sw, sh = im.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale + 0.5), int(sh * scale + 0.5)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    im = im.crop((left, top, left + tw, top + th))
    im.save(dest, "PNG", optimize=True)
    print(f"{dest.name}: {im.size}")


cover_resize(assets / "asc-header-source.jpg", out / "01-header-3840x1646.png", (3840, 1646))
cover_resize(assets / "asc-header-source.jpg", out / "01-header-5244x2950.png", (5244, 2950))
cover_resize(assets / "asc-search-source.jpg", out / "02-search-3840x1646.png", (3840, 1646))

shots = [
    ("asc-shot-home.jpg", "03-screenshot-home-1206x2622.png"),
    ("asc-shot-attendance.jpg", "04-screenshot-attendance-1206x2622.png"),
    ("asc-shot-leave.jpg", "05-screenshot-leave-1206x2622.png"),
    ("asc-shot-payslip.jpg", "06-screenshot-payslip-1206x2622.png"),
]
for src_name, dest_name in shots:
    cover_resize(assets / src_name, out / dest_name, (1206, 2622))

print("DONE", out)
