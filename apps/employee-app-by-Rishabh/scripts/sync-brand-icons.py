"""Generate employee-app icons from the Enterprise ERP Connect Plus mark."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

SRC = Path(
    r"c:\Users\cache\OneDrive\Documents\enterprise-erp\apps\web\public\brand\iconnect-plus-logo.png"
)
OUT = Path(
    r"c:\Users\cache\OneDrive\Documents\enterprise-erp\apps\employee-app-by-Rishabh\assets\images"
)
STORE = Path(
    r"c:\Users\cache\OneDrive\Documents\enterprise-erp\apps\employee-app-by-Rishabh\docs\store-assets\ios-real"
)

WHITE = (255, 255, 255)
SPLASH_BG = (248, 249, 255)


def is_bg(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return a < 8 or (r > 245 and g > 245 and b > 245)


def trim_logo(logo: Image.Image) -> Image.Image:
    pixels = logo.load()
    w, h = logo.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if not is_bg(pixels[x, y]):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x <= min_x:
        return logo
    return logo.crop((min_x, min_y, max_x + 1, max_y + 1))


def fit_on_canvas(
    logo: Image.Image,
    size: int,
    bg: tuple[int, int, int],
    pad_ratio: float = 0.14,
    *,
    transparent: bool = False,
) -> Image.Image:
    canvas = Image.new(
        "RGBA",
        (size, size),
        (0, 0, 0, 0) if transparent else (*bg, 255),
    )
    max_side = int(size * (1 - 2 * pad_ratio))
    lw, lh = logo.size
    scale = min(max_side / lw, max_side / lh)
    nw, nh = max(1, int(lw * scale)), max(1, int(lh * scale))
    resized = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, ((size - nw) // 2, (size - nh) // 2))
    return canvas


def to_monochrome(logo: Image.Image) -> Image.Image:
    out = logo.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_bg((r, g, b, a)):
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (0, 0, 0, max(a, 220))
    return out


def main() -> None:
    logo = trim_logo(Image.open(SRC).convert("RGBA"))
    print("trimmed", logo.size)

    icon = fit_on_canvas(logo, 1024, WHITE, pad_ratio=0.12)
    icon.convert("RGB").save(OUT / "icon.png", "PNG", optimize=True)

    splash = fit_on_canvas(logo, 1024, SPLASH_BG, pad_ratio=0.18)
    splash.save(OUT / "splash-icon.png", "PNG", optimize=True)

    fav = fit_on_canvas(logo, 48, WHITE, pad_ratio=0.1)
    fav.save(OUT / "favicon.png", "PNG", optimize=True)

    fg = fit_on_canvas(logo, 1024, WHITE, pad_ratio=0.18, transparent=True)
    fg.save(OUT / "android-icon-foreground.png", "PNG", optimize=True)

    Image.new("RGB", (1024, 1024), WHITE).save(
        OUT / "android-icon-background.png", "PNG", optimize=True
    )

    mono = fit_on_canvas(
        to_monochrome(logo), 1024, WHITE, pad_ratio=0.18, transparent=True
    )
    mono.save(OUT / "android-icon-monochrome.png", "PNG", optimize=True)

    STORE.mkdir(parents=True, exist_ok=True)
    icon.convert("RGB").save(STORE / "app-icon-1024.png", "PNG", optimize=True)
    icon.convert("RGB").save(STORE / "app-icon-1024-light.png", "PNG", optimize=True)

    for path in [
        OUT / "icon.png",
        OUT / "splash-icon.png",
        OUT / "favicon.png",
        OUT / "android-icon-foreground.png",
        OUT / "android-icon-background.png",
        OUT / "android-icon-monochrome.png",
        STORE / "app-icon-1024.png",
    ]:
        im = Image.open(path)
        print(f"{im.size} {im.mode} {path.name} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
