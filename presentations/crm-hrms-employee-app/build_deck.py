"""Build the branded CRM / HRMS / Employee App deck.

Run from anywhere:  python presentations/crm-hrms-employee-app/build_deck.py
Output:             presentations/crm-hrms-employee-app/iConnect-Plus_CRM-HRMS-Employee-App.pptx
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
ASSETS = HERE / "assets"
BUILD = HERE / "build"
BRAND = ROOT / "apps" / "web" / "public" / "brand"
CRM_SHOTS = ROOT / "docs" / "user-manuals" / "crm" / "assets" / "screenshots"
HR_SHOTS = ROOT / "docs" / "user-manuals" / "hrms" / "assets" / "screenshots"
OUT = HERE / "iConnect-Plus_CRM-HRMS-Employee-App.pptx"

# Brand tokens: apps/web/src/app/globals.css (OKLCH -> sRGB) + Cache logo red.
RED = RGBColor(0xD8, 0x31, 0x35)
TEAL = RGBColor(0x00, 0x58, 0x65)
TEAL_BRIGHT = RGBColor(0x4A, 0xB9, 0xB2)
RAIL = RGBColor(0x01, 0x0F, 0x18)
RAIL_TO = RGBColor(0x00, 0x2B, 0x2F)
INK = RGBColor(0x12, 0x1C, 0x23)
MUTED_INK = RGBColor(0x59, 0x65, 0x6E)
CANVAS = RGBColor(0xF7, 0xFB, 0xFC)
MUTED = RGBColor(0xEB, 0xF1, 0xF4)
MINT = RGBColor(0xDD, 0xF0, 0xF0)
BORDER = RGBColor(0xD7, 0xE0, 0xE3)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
RED_SOFT = RGBColor(0xFC, 0xEC, 0xEC)
ON_DARK_MUTED = RGBColor(0xB4, 0xC6, 0xCC)

FONT = "Segoe UI"
FONT_SEMI = "Segoe UI Semibold"

SLIDE_W, SLIDE_H = 13.333, 7.5
MARGIN = 0.6


# --------------------------------------------------------------------------- images


def _rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius, fill=255)
    return mask


def _with_shadow(img: Image.Image, radius: int, blur: int = 18, offset: int = 10, alpha: int = 70) -> Image.Image:
    pad = blur * 3
    canvas = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [pad, pad + offset, pad + img.width, pad + img.height + offset], radius, fill=(1, 15, 24, alpha)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(img, (pad, pad))
    return canvas


def desktop_frame(src: Path, name: str, crop_frac: float | None = None) -> tuple[Path, float]:
    """Screenshot in a light window frame. Returns (path, pad_ratio) where pad_ratio is shadow pad / width."""
    shot = Image.open(src).convert("RGBA")
    if crop_frac:
        shot = shot.crop((0, 0, shot.width, int(shot.height * crop_frac)))
    scale = 2048 / shot.width
    shot = shot.resize((2048, round(shot.height * scale)), Image.LANCZOS)
    scale = 2
    bar = 22 * scale
    border = 1 * scale
    w, h = shot.width + border * 2, shot.height + bar + border
    frame = Image.new("RGBA", (w, h), (215, 224, 227, 255))
    ImageDraw.Draw(frame).rectangle([border, border, w - border - 1, bar], fill=(235, 241, 244, 255))
    d = ImageDraw.Draw(frame)
    for i, col in enumerate([(216, 49, 53), (232, 185, 76), (74, 185, 178)]):
        cx, cy, r = border + 16 * scale + i * 14 * scale, bar // 2 + border // 2, 4 * scale
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col + (255,))
    frame.alpha_composite(shot, (border, bar))
    radius = 10 * scale
    frame.putalpha(ImageChops.multiply(frame.getchannel("A"), _rounded_mask(frame.size, radius)))
    out = _with_shadow(frame, radius, blur=14 * scale, offset=6 * scale, alpha=55)
    path = BUILD / f"{name}.png"
    out.save(path)
    return path, (14 * scale * 3) / out.width


def phone_frame(src: Path, name: str) -> tuple[Path, float]:
    shot = Image.open(src).convert("RGBA")
    bezel = 22
    radius_in = 58
    shot.putalpha(ImageChops.multiply(shot.getchannel("A"), _rounded_mask(shot.size, radius_in)))
    w, h = shot.width + bezel * 2, shot.height + bezel * 2
    body = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle([0, 0, w - 1, h - 1], radius_in + bezel, fill=(18, 28, 35, 255))
    body.alpha_composite(shot, (bezel, bezel))
    out = _with_shadow(body, radius_in + bezel, blur=26, offset=14, alpha=80)
    path = BUILD / f"{name}.png"
    out.save(path)
    return path, (26 * 3) / out.width


def prepare_logos() -> dict[str, Path]:
    BUILD.mkdir(parents=True, exist_ok=True)
    cache = Image.open(BRAND / "iconnect-plus-wordmark.png").convert("RGBA")
    cache = cache.crop(cache.getchannel("A").getbbox())
    cache.thumbnail((1600, 1600), Image.LANCZOS)
    cache_red = BUILD / "cache-red.png"
    cache.save(cache_red)

    white = Image.new("RGBA", cache.size, (255, 255, 255, 0))
    white.putalpha(cache.getchannel("A"))
    cache_white = BUILD / "cache-white.png"
    white.save(cache_white)

    mark = Image.open(BRAND / "iconnect-plus-logo.png").convert("L")
    alpha = mark.point(lambda v: 255 - v)
    alpha = alpha.crop(alpha.getbbox())
    paths = {"cache_red": cache_red, "cache_white": cache_white}
    for key, rgb in {"mark_teal": (0, 88, 101), "mark_white": (255, 255, 255)}.items():
        tinted = Image.new("RGBA", alpha.size, rgb + (0,))
        tinted.putalpha(alpha)
        p = BUILD / f"{key}.png"
        tinted.save(p)
        paths[key] = p
    return paths


# --------------------------------------------------------------------------- pptx helpers


def rgb_hex(c: RGBColor) -> str:
    return str(c)


def set_bg(slide, color: RGBColor) -> None:
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def rect(slide, x, y, w, h, color: RGBColor | None, line: RGBColor | None = None, shape=MSO_SHAPE.RECTANGLE, radius: float | None = None):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if color is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = color
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(0.75)
    s.shadow.inherit = False
    if radius is not None and shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = radius
    s.text_frame.text = ""
    return s


def gradient(shape, c1: RGBColor, c2: RGBColor, angle: float = 135) -> None:
    shape.fill.gradient()
    shape.fill.gradient_angle = angle
    stops = shape.fill.gradient_stops
    stops[0].color.rgb = c1
    stops[0].position = 0
    stops[1].color.rgb = c2
    stops[1].position = 1.0


def text(
    slide,
    x,
    y,
    w,
    h,
    content,
    size=14,
    color=INK,
    bold=False,
    font=FONT,
    align=PP_ALIGN.LEFT,
    anchor=MSO_ANCHOR.TOP,
    spacing: float | None = None,
    line_spacing: float | None = None,
    inset: float = 0.0,
):
    """content: str, or list of paragraphs; a paragraph is str or list of (text, overrides) runs."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for side in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, side, Inches(inset))
    paragraphs = content if isinstance(content, list) else [content]
    for i, para in enumerate(paragraphs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if line_spacing:
            p.line_spacing = line_spacing
        if spacing is not None and i > 0:
            p.space_before = Pt(spacing)
        runs = para if isinstance(para, list) else [(para, {})]
        for run_text, over in runs:
            r = p.add_run()
            r.text = run_text
            f = r.font
            f.name = over.get("font", font)
            f.size = Pt(over.get("size", size))
            f.bold = over.get("bold", bold)
            f.color.rgb = over.get("color", color)
            if over.get("tracking"):
                rPr = r._r.get_or_add_rPr()
                rPr.set("spc", str(over["tracking"]))
    return tb


def eyebrow(slide, x, y, label: str, color=RED, w=8.0):
    return text(slide, x, y, w, 0.3, [[(label.upper(), {"tracking": 200})]], size=10.5, color=color, font=FONT_SEMI)


def bullet_list(slide, x, y, w, h, items, size=13, color=INK, lead_color=INK, gap=7, marker_color=RED):
    """items: list of (lead, body). Lead is rendered semibold."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    for side in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, side, 0)
    for i, (lead, body) in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_before = Pt(0 if i == 0 else gap)
        p.line_spacing = 1.08
        pPr = p._p.get_or_add_pPr()
        pPr.set("marL", str(Inches(0.2)))
        pPr.set("indent", str(-Inches(0.2)))
        bu_clr = pPr.makeelement(qn("a:buClr"), {})
        srgb = bu_clr.makeelement(qn("a:srgbClr"), {"val": rgb_hex(marker_color)})
        bu_clr.append(srgb)
        pPr.append(bu_clr)
        bu_font = pPr.makeelement(qn("a:buFont"), {"typeface": "Arial"})
        pPr.append(bu_font)
        bu = pPr.makeelement(qn("a:buChar"), {"char": "\u25A0"})
        pPr.append(bu)
        if lead:
            r = p.add_run()
            r.text = lead + "  "
            r.font.name, r.font.size, r.font.color.rgb = FONT_SEMI, Pt(size), lead_color
        r = p.add_run()
        r.text = body
        r.font.name, r.font.size, r.font.color.rgb = FONT, Pt(size), color
    return tb


def picture(slide, path: Path, x, y, w=None, h=None, pad_ratio: float = 0.0):
    """Place an image so its visible (un-shadowed) content starts at x,y with width w."""
    if pad_ratio and w is not None:
        full_w = w / (1 - 2 * pad_ratio)
        pad = full_w * pad_ratio
        return slide.shapes.add_picture(str(path), Inches(x - pad), Inches(y - pad), width=Inches(full_w))
    kwargs = {}
    if w is not None:
        kwargs["width"] = Inches(w)
    if h is not None:
        kwargs["height"] = Inches(h)
    return slide.shapes.add_picture(str(path), Inches(x), Inches(y), **kwargs)


def notes(slide, body: str) -> None:
    slide.notes_slide.notes_text_frame.text = body.strip()


def header(slide, kicker: str, title: str, subtitle: str | None = None):
    rect(slide, MARGIN, 0.5, 0.06, 0.95 if subtitle else 0.78, RED)
    eyebrow(slide, MARGIN + 0.2, 0.46, kicker)
    text(slide, MARGIN + 0.2, 0.72, 11.5, 0.6, title, size=28, font=FONT_SEMI, color=INK)
    if subtitle:
        text(slide, MARGIN + 0.2, 1.3, 11.8, 0.4, subtitle, size=13.5, color=MUTED_INK)


def footer(slide, n: int, logos: dict[str, Path], dark: bool = False):
    col = ON_DARK_MUTED if dark else MUTED_INK
    rect(slide, MARGIN, 6.98, SLIDE_W - 2 * MARGIN, 0.01, RGBColor(0x1E, 0x3A, 0x44) if dark else BORDER)
    text(slide, MARGIN, 7.06, 6, 0.3, "iConnect Plus  \u00b7  CRM  \u00b7  HRMS  \u00b7  Employee App", size=9, color=col)
    logo = logos["cache_white" if dark else "cache_red"]
    picture(slide, logo, SLIDE_W - MARGIN - 0.95 - 0.45, 7.07, h=0.24)
    text(slide, SLIDE_W - MARGIN - 0.35, 7.06, 0.35, 0.3, f"{n:02d}", size=9, color=col, align=PP_ALIGN.RIGHT, font=FONT_SEMI)


def stepper(slide, x, y, w, steps: list[str], h=0.58, size=10, fill=TEAL, last_fill=RED):
    gap = -0.06
    sw = (w - gap * (len(steps) - 1)) / len(steps)
    for i, label in enumerate(steps):
        shape_type = MSO_SHAPE.PENTAGON if i == 0 else MSO_SHAPE.CHEVRON
        s = rect(slide, x + i * (sw + gap), y, sw, h, last_fill if i == len(steps) - 1 else fill, shape=shape_type)
        s.adjustments[0] = 0.28
        tf = s.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.16 if i else 0.06)
        tf.margin_right = Inches(0.04)
        tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = label
        r.font.name, r.font.size, r.font.color.rgb = FONT_SEMI, Pt(size), WHITE


def _cell_border(cell, color: RGBColor, width_pt: float = 0.75, sides=("a:lnB",)):
    tcPr = cell._tc.get_or_add_tcPr()
    for tag in ("a:lnL", "a:lnR", "a:lnT", "a:lnB"):
        ln = tcPr.makeelement(qn(tag), {"w": str(int(Pt(width_pt if tag in sides else 0))), "cmpd": "sng"})
        if tag in sides:
            solid = ln.makeelement(qn("a:solidFill"), {})
            solid.append(solid.makeelement(qn("a:srgbClr"), {"val": rgb_hex(color)}))
            ln.append(solid)
        else:
            ln.append(ln.makeelement(qn("a:noFill"), {}))
        tcPr.append(ln)


def comparison_table(slide, x, y, w, rows: list[tuple[str, str, str]], legacy_label: str, new_label: str, row_h=0.62, size=11.5):
    col_w = [2.0, (w - 2.0) / 2, (w - 2.0) / 2]
    n_rows = len(rows) + 1
    gt = slide.shapes.add_table(n_rows, 3, Inches(x), Inches(y), Inches(w), Inches(0.5 + row_h * len(rows)))
    tbl = gt.table
    tblPr = tbl._tbl.tblPr
    for attr in ("firstRow", "bandRow"):
        tblPr.set(attr, "0")
    style = tblPr.find(qn("a:tableStyleId"))
    if style is None:
        style = tblPr.makeelement(qn("a:tableStyleId"), {})
        tblPr.append(style)
    style.text = "{2D5ABB26-0587-4C30-8999-92F81FD0307C}"
    for i, cw in enumerate(col_w):
        tbl.columns[i].width = Inches(cw)
    tbl.rows[0].height = Inches(0.5)
    for r in range(1, n_rows):
        tbl.rows[r].height = Inches(row_h)

    def fill_cell(cell, value, bg, fg, font=FONT, sz=size, bold=False):
        cell.fill.solid()
        cell.fill.fore_color.rgb = bg
        cell.margin_left = cell.margin_right = Inches(0.14)
        cell.margin_top = cell.margin_bottom = Inches(0.05)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf = cell.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = ""
        run = p.add_run()
        run.text = value
        run.font.name, run.font.size, run.font.color.rgb, run.font.bold = font, Pt(sz), fg, bold

    fill_cell(tbl.cell(0, 0), "AREA", MUTED, MUTED_INK, FONT_SEMI, 10)
    fill_cell(tbl.cell(0, 1), legacy_label.upper(), MUTED, MUTED_INK, FONT_SEMI, 10)
    fill_cell(tbl.cell(0, 2), new_label.upper(), TEAL, WHITE, FONT_SEMI, 10)
    for c in range(3):
        _cell_border(tbl.cell(0, c), BORDER)
    for r, (area, legacy, new) in enumerate(rows, start=1):
        fill_cell(tbl.cell(r, 0), area, WHITE, INK, FONT_SEMI)
        fill_cell(tbl.cell(r, 1), legacy, WHITE, MUTED_INK)
        fill_cell(tbl.cell(r, 2), new, RGBColor(0xF1, 0xF8, 0xF8), INK)
        for c in range(3):
            _cell_border(tbl.cell(r, c), BORDER)
    return gt


def card(slide, x, y, w, h, fill=WHITE, line=BORDER):
    return rect(slide, x, y, w, h, fill, line, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06)


# --------------------------------------------------------------------------- slides


def build() -> None:
    logos = prepare_logos()
    crm_dash, crm_dash_pad = desktop_frame(CRM_SHOTS / "sidebar" / "01-dashboard.png", "crm-dashboard")
    crm_opp, crm_opp_pad = desktop_frame(CRM_SHOTS / "process" / "process-10-opportunity-detail.png", "crm-opportunity")
    crm_jobs, crm_jobs_pad = desktop_frame(CRM_SHOTS / "process" / "process-15-approve-quote-my-jobs.png", "crm-my-jobs", crop_frac=0.66)
    hr_dash, hr_dash_pad = desktop_frame(HR_SHOTS / "sidebar" / "01-dashboard.png", "hr-dashboard")
    hr_pay, hr_pay_pad = desktop_frame(HR_SHOTS / "process" / "process-09-payroll.png", "hr-payroll", crop_frac=0.72)
    phones = {k: phone_frame(ASSETS / f"app-{k}.png", f"phone-{k}") for k in ("home", "attendance", "leave", "payslips")}

    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(SLIDE_W), Inches(SLIDE_H)
    blank = prs.slide_layouts[6]
    n = 0

    def new_slide(bg=CANVAS):
        nonlocal n
        n += 1
        s = prs.slides.add_slide(blank)
        set_bg(s, bg)
        return s

    # 1 ── Title ---------------------------------------------------------------
    s = new_slide(WHITE)
    panel = rect(s, 7.35, 0, SLIDE_W - 7.35, SLIDE_H, RAIL)
    gradient(panel, RAIL, RAIL_TO, 120)
    picture(s, logos["cache_red"], MARGIN + 0.05, 0.7, h=0.8)
    rect(s, MARGIN + 0.05, 2.35, 0.06, 2.05, RED)
    eyebrow(s, MARGIN + 0.3, 2.3, "iConnect Plus  \u00b7  Platform overview", w=6)
    text(s, MARGIN + 0.3, 2.62, 6.4, 1.3, ["CRM  \u00b7  HRMS", "Employee App"], size=40, font=FONT_SEMI, color=INK, line_spacing=0.95)
    text(s, MARGIN + 0.3, 3.95, 6.3, 0.5, "Software built around the way we work", size=18, color=TEAL, font=FONT_SEMI)
    text(
        s, MARGIN + 0.05, 4.95, 6.2, 0.8,
        "What each module does, and why it serves us better than the legacy systems it replaces.",
        size=13, color=MUTED_INK,
    )
    picture(s, logos["mark_teal"], MARGIN + 0.05, 6.45, h=0.42)
    text(s, MARGIN + 0.55, 6.47, 4, 0.4, [[("iConnect Plus", {"font": FONT_SEMI, "color": INK}), ("   |   November 2026", {})]], size=11, color=MUTED_INK, anchor=MSO_ANCHOR.MIDDLE)
    picture(s, crm_dash, 7.95, 1.05, w=4.95, pad_ratio=crm_dash_pad)
    picture(s, hr_dash, 8.45, 3.55, w=4.4, pad_ratio=hr_dash_pad)
    picture(s, phones["home"][0], 7.6, 2.55, w=1.95, pad_ratio=phones["home"][1])
    notes(s, """
Welcome. Today I'll walk through three modules of iConnect Plus, our in-house platform: the Sales CRM, the HRMS, and the Employee App.
For each one I'll briefly cover what it does and then compare it directly with the legacy systems we used before.
The theme throughout: we built the software around our own operating process.
""")

    # 2 ── Philosophy ----------------------------------------------------------
    s = new_slide(RAIL)
    bg = rect(s, 0, 0, SLIDE_W, SLIDE_H, RAIL)
    gradient(bg, RAIL, RAIL_TO, 135)
    eyebrow(s, MARGIN, 1.25, "Our approach", color=TEAL_BRIGHT)
    text(s, MARGIN - 0.05, 1.35, 1.2, 1.2, "\u201c", size=96, color=RED, font="Georgia")
    text(
        s, MARGIN + 0.9, 1.85, 11.0, 1.9,
        [
            [("We didn\u2019t change our business to fit the software.", {})],
            [("We changed the software to fit our business.", {"color": TEAL_BRIGHT})],
        ],
        size=32, color=WHITE, font=FONT_SEMI, line_spacing=1.05, spacing=4,
    )
    pillars = [
        ("Process first", "Every screen, stage and approval mirrors how our teams already work: our sales blueprint, our HR policies, our approval chain."),
        ("One connected platform", "Sales, HR, payroll and employees work on the same live data with one login, one set of roles and one audit trail."),
        ("Ours to evolve", "When our process changes, the software changes with it. No waiting on a vendor roadmap or paying for customisation."),
    ]
    cw, gap, top = 3.85, 0.33, 3.95
    for i, (title_, body) in enumerate(pillars):
        x = MARGIN + i * (cw + gap)
        c = card(s, x, top, cw, 2.35, fill=RGBColor(0x0A, 0x24, 0x2C), line=RGBColor(0x1E, 0x45, 0x4E))
        rect(s, x + 0.3, top + 0.35, 0.42, 0.06, RED)
        text(s, x + 0.3, top + 0.55, cw - 0.6, 0.45, title_, size=17, color=WHITE, font=FONT_SEMI)
        text(s, x + 0.3, top + 1.05, cw - 0.6, 1.2, body, size=12.5, color=ON_DARK_MUTED, line_spacing=1.1)
    footer(s, n, logos, dark=True)
    notes(s, """
This is the core idea behind iConnect Plus.
With off-the-shelf products, the business bends to the tool: teams build workarounds in spreadsheets, email and chat.
We did the opposite. We mapped how our sales, HR and employees actually operate, and encoded that process into the software.
Three principles: process first, one connected platform, and full ownership so the system evolves with us.
""")

    # 3 ── Legacy pain points --------------------------------------------------
    s = new_slide()
    header(s, "Why we moved on", "Where legacy systems held us back",
           "Generic tools forced our teams to work around the software instead of with it.")
    pains = [
        ("Generic workflows", "Built for every company, so they fit none exactly. Our real steps (BOQ, SOW, OEM quotes, OVF, biometric shifts) lived outside the tool."),
        ("Disconnected data", "Sales, HR, attendance and payroll sat in separate systems and spreadsheets. The same data was typed again and again."),
        ("Approvals off the record", "Sign-offs happened over email, calls and chat. No single place to see what is pending, and no trail of who approved what."),
        ("Rigid and costly to change", "Every change meant a vendor request, extra licences or a workaround. The process had to wait for the software."),
    ]
    cw, gap, top = 2.85, 0.233, 2.05
    for i, (t_, b_) in enumerate(pains):
        x = MARGIN + i * (cw + gap)
        card(s, x, top, cw, 3.45)
        circ = rect(s, x + 0.3, top + 0.35, 0.55, 0.55, RED_SOFT, shape=MSO_SHAPE.OVAL)
        text(s, x + 0.3, top + 0.35, 0.55, 0.55, f"{i + 1:02d}", size=13, color=RED, font=FONT_SEMI, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.3, top + 1.15, cw - 0.6, 0.8, t_, size=17, font=FONT_SEMI, color=INK, line_spacing=1.0)
        text(s, x + 0.3, top + 1.95, cw - 0.6, 1.4, b_, size=12.5, color=MUTED_INK, line_spacing=1.12)
    strip = card(s, MARGIN, 5.75, SLIDE_W - 2 * MARGIN, 0.85, fill=RED_SOFT, line=RED_SOFT)
    text(s, MARGIN + 0.35, 5.75, SLIDE_W - 2 * MARGIN - 0.7, 0.85,
         [[("The result:  ", {"font": FONT_SEMI, "color": RED}),
           ("our teams spent time managing the tools instead of running the business.", {})]],
         size=14, color=INK, anchor=MSO_ANCHOR.MIDDLE)
    footer(s, n, logos)
    notes(s, """
Before iConnect Plus, these were our daily frustrations.
One: generic workflows. The tools didn't know our steps, so the important parts of our process happened outside them.
Two: disconnected data, so the same customer or employee information was re-entered across systems.
Three: approvals happened over email and chat, so nobody had a single view of what was pending, and there was no audit trail.
Four: every change needed the vendor, more licences, or another workaround.
""")

    # 4 ── The three modules ---------------------------------------------------
    s = new_slide()
    header(s, "The modules", "Three modules, one platform",
           "Each module was designed from our own operating process, then connected through a shared core.")
    mods = [
        ("CRM", "Sales, from first enquiry to Deal Won",
         "Our exact sales blueprint: company, lead, opportunity, BOQ, SOW, quote, customer PO, OVF and Deal Won, with approvals at every gate.",
         "Sales  \u00b7  Pre-sales  \u00b7  Management  \u00b7  Finance  \u00b7  Legal  \u00b7  Accounts"),
        ("HRMS", "The complete employee lifecycle",
         "Recruitment, onboarding, employee records, attendance, leave, performance, training, payroll and offboarding in one HR workspace.",
         "HR admin  \u00b7  HR executives  \u00b7  Managers  \u00b7  Payroll  \u00b7  IT & Admin"),
        ("Employee App", "HR self-service on every phone",
         "Check in, apply for leave, view payslips, raise requests and approve your team, from a mobile app connected live to the HRMS.",
         "Every employee  \u00b7  Managers"),
    ]
    cw, gap, top = 3.85, 0.33, 2.05
    for i, (name, tag, body, users) in enumerate(mods):
        x = MARGIN + i * (cw + gap)
        card(s, x, top, cw, 4.45)
        text(s, x + 0.35, top + 0.4, 1.0, 0.35, f"0{i + 1}", size=12, color=RED, font=FONT_SEMI)
        text(s, x + 0.35, top + 0.7, cw - 0.7, 0.55, name, size=24, color=INK, font=FONT_SEMI)
        text(s, x + 0.35, top + 1.3, cw - 0.7, 0.4, tag, size=13, color=TEAL, font=FONT_SEMI)
        text(s, x + 0.35, top + 1.8, cw - 0.7, 1.6, body, size=12.5, color=MUTED_INK, line_spacing=1.12)
        rect(s, x + 0.35, top + 3.45, cw - 0.7, 0.01, BORDER)
        eyebrow(s, x + 0.35, top + 3.55, "Used by", color=MUTED_INK, w=cw - 0.7)
        text(s, x + 0.35, top + 3.82, cw - 0.7, 0.55, users, size=10.5, color=INK, line_spacing=1.1)
    footer(s, n, logos)
    notes(s, """
Three modules. The CRM runs our sales process end to end. The HRMS covers the full employee lifecycle including payroll.
The Employee App puts HR self-service on every employee's phone and talks to the same HRMS data.
All three share one login, one role model, one approval engine and one audit trail.
""")

    # 5 ── CRM overview --------------------------------------------------------
    s = new_slide()
    header(s, "Module 01  \u00b7  CRM", "CRM: our sales blueprint, built into the software")
    stepper(s, MARGIN, 1.6, SLIDE_W - 2 * MARGIN,
            ["Company", "Lead", "Opportunity", "BOQ & SOW", "Deal Reg & OEM", "Quote", "Customer PO", "OVF", "Deal Won"], size=9.5)
    bullet_list(s, MARGIN, 2.55, 5.35, 4.3, [
        ("Company first.", "Every lead is created from a verified company account, so there are no orphan or duplicate leads."),
        ("Guided stages.", "Each opportunity shows only the actions allowed at its current stage, so steps can't be skipped."),
        ("Approvals at every gate.", "Pre-sales signs off the BOQ; Finance, Legal and Management approve the customer PO; Management approves the OVF."),
        ("Margin-aware quotes.", "GST/HSN line items with a reverse margin calculator. Low-margin quotes go to Management automatically."),
        ("Clean hand-off.", "The approved Order Value Form (OVF) goes straight to SCM before the deal is marked Won."),
    ], size=12.5, gap=8)
    picture(s, crm_opp, 6.35, 2.6, w=6.35, pad_ratio=crm_opp_pad)
    footer(s, n, logos)
    notes(s, """
The CRM follows the exact sales blueprint our team uses, from company to Deal Won.
A lead can only be created from a company account. Opportunities are guided: the screen only offers the actions allowed at that stage.
BOQ goes to pre-sales; the customer PO goes through Finance, Legal and Management; the OVF is approved before the deal is marked won.
Quotes include a reverse margin calculator; if margin falls below threshold the quote is routed for approval automatically.
The screenshot shows an opportunity with its current state and the transitions available.
""")

    # 6 ── CRM vs legacy -------------------------------------------------------
    s = new_slide()
    header(s, "Module 01  \u00b7  CRM", "CRM vs. legacy CRM")
    comparison_table(s, MARGIN, 1.6, 8.05, [
        ("Sales process", "Generic lead-to-deal pipeline; our real steps tracked outside the tool", "Our full blueprint (BOQ, SOW, Deal Reg, OEM, PO, OVF) enforced in the system"),
        ("Approvals", "Email, calls and chat; no record of who approved what", "In-app approvals through My Jobs, with remarks and a full audit trail"),
        ("Pricing & margin", "Quotes built in spreadsheets; margins checked by hand", "Reverse margin calculator; low-margin quotes routed to Management"),
        ("Order hand-off", "PO and order details re-typed for Accounts and SCM", "Approved OVF flows to SCM and Accounts, with no re-entry"),
        ("Data quality", "Duplicate and orphan leads, free-text everywhere", "Company-first rule, gated steps, fields synced from parent records"),
        ("Visibility", "Status found by asking around", "Live pipeline, win rate, won value and pending tasks"),
        ("Change", "Vendor customisation requests and per-user licences", "Changed in-house as our sales process evolves"),
    ], "Legacy CRM", "iConnect Plus CRM", row_h=0.66, size=11)
    picture(s, crm_jobs, 9.05, 1.62, w=3.68, pad_ratio=crm_jobs_pad)
    text(s, 9.05, 3.2, 3.68, 0.5, "My Jobs: one inbox for every pending approval across Sales, Pre-sales, Management and Projects.", size=10.5, color=MUTED_INK, line_spacing=1.1)
    picture(s, crm_dash, 9.05, 3.85, w=3.68, pad_ratio=crm_dash_pad)
    text(s, 9.05, 6.2, 3.68, 0.5, "Dashboard: open leads, opportunities, win rate and won value in \u20b9.", size=10.5, color=MUTED_INK, line_spacing=1.1)
    footer(s, n, logos)
    notes(s, """
Here is the direct comparison with the legacy CRM.
The key difference is the first row: our process is the system, not something tracked on the side.
Approvals moved from email and chat into My Jobs, with an audit trail.
Quotes and margins are calculated in the system, and the OVF hands the order to SCM and Accounts without re-typing.
And when our sales process changes, we change the CRM ourselves.
""")

    # 7 ── HRMS overview -------------------------------------------------------
    s = new_slide()
    header(s, "Module 02  \u00b7  HRMS", "HRMS: the complete employee lifecycle in one place")
    stepper(s, MARGIN, 1.6, SLIDE_W - 2 * MARGIN,
            ["Recruit", "Onboard", "Employee records", "Attendance & shifts", "Leave", "Performance & training", "Payroll", "Offboarding"], size=10)
    bullet_list(s, MARGIN, 2.55, 5.35, 4.3, [
        ("Hire to onboard.", "Recruitment and a careers portal flow into onboarding with background verification."),
        ("One employee record.", "Profile, documents (EDoc), org chart and assigned assets kept together."),
        ("Attendance our way.", "Biometric device sync, location-verified mobile punches, shifts and rosters, overtime and comp-off."),
        ("Our leave policies.", "Leave types, balances and holiday calendars configured to company rules, with manager and HR approval."),
        ("Controlled payroll.", "Salary structures, monthly runs, approvals, month lock, revisions, bonuses and payslips."),
        ("Clean exits.", "Separation and offboarding with clearance."),
    ], size=12.5, gap=7)
    picture(s, hr_dash, 6.35, 2.6, w=6.35, pad_ratio=hr_dash_pad)
    footer(s, n, logos)
    notes(s, """
The HRMS covers the whole employee lifecycle in one workspace, from recruitment through onboarding, attendance, leave, performance, payroll and exit.
Attendance reflects how we actually work: biometric devices at the office, location-verified punches from the mobile app, shifts, rosters, overtime and comp-off.
Payroll is driven by that same attendance and leave data, with approvals and a month lock so processed months can't be changed by accident.
The screenshot is the HR executive dashboard with quick actions and today's attendance.
""")

    # 8 ── HRMS vs legacy ------------------------------------------------------
    s = new_slide()
    header(s, "Module 02  \u00b7  HRMS", "HRMS vs. legacy HRMS")
    comparison_table(s, MARGIN, 1.6, 8.05, [
        ("Lifecycle", "Separate tools for hiring, attendance and payroll", "One system from recruitment to exit"),
        ("Attendance", "Registers and biometric exports reconciled in Excel", "Biometric sync plus location-verified mobile punches; missing punches and late arrivals flagged"),
        ("Policies", "Generic rules; exceptions handled manually", "Our leave, comp-off, overtime and shift rules configured in the system"),
        ("Payroll", "Spreadsheet calculations; attendance keyed in again", "Payroll runs on live attendance and leave, with approvals and month lock"),
        ("Documents", "Files scattered across email and shared drives", "EDoc keeps every document on the employee record"),
        ("Control & audit", "Hard to trace who changed what", "Role-based access and an audit trail on every change"),
        ("Employee queries", "Every request goes through the HR desk", "Self-service through the Employee App"),
    ], "Legacy HRMS", "iConnect Plus HRMS", row_h=0.66, size=11)
    picture(s, hr_pay, 9.05, 1.62, w=3.68, pad_ratio=hr_pay_pad)
    text(s, 9.05, 3.42, 3.68, 0.6, "Payroll: run, approve and lock each month, then generate payslips.", size=10.5, color=MUTED_INK, line_spacing=1.1)
    hi = card(s, 9.05, 4.25, 3.68, 2.45, fill=MINT, line=MINT)
    eyebrow(s, 9.3, 4.45, "One source of truth", color=TEAL, w=3.3)
    text(s, 9.3, 4.78, 3.25, 1.85,
         "Attendance, leave and salary data that HR sees is exactly what payroll uses and what employees see in their app. No reconciliation between systems.",
         size=12, color=INK, line_spacing=1.12)
    footer(s, n, logos)
    notes(s, """
Compared with the legacy HRMS: one system instead of several, attendance captured directly instead of reconciled in Excel,
and our own policies configured rather than generic defaults handled by exception.
Payroll uses live attendance and leave, with approvals and a month lock.
Most importantly, HR, payroll and the employee all see the same data, with no reconciliation between systems.
""")

    # 9 ── Employee App overview -----------------------------------------------
    s = new_slide()
    header(s, "Module 03  \u00b7  Employee App", "Employee App: HR in every employee\u2019s pocket")
    bullet_list(s, MARGIN, 1.75, 4.55, 5.0, [
        ("Secure sign-in.", "Company login with optional face verification."),
        ("One-tap attendance.", "Location-verified check-in and out; WFH, on-duty, comp-off and correction requests."),
        ("Leave in seconds.", "Apply, track or cancel leave; see balances, holidays and the team calendar."),
        ("Pay on demand.", "Payslips, salary breakdown and tax details, anytime."),
        ("Managers on the move.", "Approve team requests from the phone."),
        ("Everything else.", "Assets with QR scan, documents, meeting rooms, helpdesk, training, performance, policies and announcements."),
        ("Installable app.", "Works on Android and iOS from the browser, with no app-store dependency."),
    ], size=12, gap=6)
    pw, top = 2.42, 1.68
    for i, (key, cap) in enumerate([("home", "Home"), ("attendance", "Attendance"), ("payslips", "Salary")]):
        x = 5.55 + i * (pw + 0.2)
        path, pad = phones[key]
        picture(s, path, x, top, w=pw, pad_ratio=pad)
    footer(s, n, logos)
    notes(s, """
The Employee App is a mobile app every employee installs from the browser, with no app store needed.
Daily tasks take seconds: check in with location verification, apply for leave, download a payslip.
Managers can approve their team's requests from the phone.
These are real screens from the app: home with today's working hours, attendance with location verification, and salary with net pay and trend.
""")

    # 10 ── Employee App vs legacy ---------------------------------------------
    s = new_slide()
    header(s, "Module 03  \u00b7  Employee App", "Employee App vs. legacy self-service")
    comparison_table(s, MARGIN, 1.6, 8.05, [
        ("Access", "Desktop portal or a visit to the HR desk", "On every employee\u2019s phone, anytime"),
        ("Attendance", "Office register or biometric only; field staff hard to track", "Location-verified mobile punch plus biometric sync; WFH and on-duty requests"),
        ("Leave & requests", "Email or paper forms; status unknown", "Apply in seconds with live status and notifications"),
        ("Payslips & tax", "Requested from HR or payroll by email", "Self-serve payslip, salary breakdown and tax view"),
        ("Manager approvals", "Wait until back at the desk", "Approve from the phone; pending count on the home screen"),
        ("HR workload", "HR answers the same queries every day", "Routine requests handled by self-service"),
        ("Data", "Separate from the HR system", "Same live data as the HRMS"),
    ], "Legacy self-service", "iConnect Plus Employee App", row_h=0.66, size=11)
    path, pad = phones["leave"]
    picture(s, path, 9.65, 1.62, w=2.3, pad_ratio=pad)
    footer(s, n, logos)
    notes(s, """
Against legacy self-service, which was a desktop portal, email or a visit to HR, the app is always in the employee's pocket.
Attendance works for office and field staff alike. Leave and requests have live status. Payslips are self-serve.
Managers approve from anywhere, and HR spends less time on routine queries.
Because the app reads the same HRMS data, there is nothing to sync or reconcile.
""")

    # 11 ── Connected platform -------------------------------------------------
    s = new_slide()
    header(s, "One platform", "How the modules work together",
           "Separate modules, one shared core. Data entered once is used everywhere it is needed.")
    cx, cy, cwid, chei = 4.67, 2.3, 4.0, 2.2
    side_h, app_y = 2.2, 5.15
    core = rect(s, cx, cy, cwid, chei, RAIL, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08)
    gradient(core, RAIL, RAIL_TO, 135)
    picture(s, logos["mark_white"], cx + 0.35, cy + 0.32, h=0.5)
    text(s, cx + 0.95, cy + 0.3, 2.9, 0.55, "iConnect Plus core", size=17, color=WHITE, font=FONT_SEMI, anchor=MSO_ANCHOR.MIDDLE)
    text(s, cx + 0.35, cy + 0.98, cwid - 0.6, 1.0, [
        "Single sign-on & role-based access",
        "Workflow & approvals  \u00b7  Notifications",
        "Audit trail  \u00b7  Shared master data",
    ], size=11.5, color=ON_DARK_MUTED, line_spacing=1.15, spacing=2)
    nodes = [
        (MARGIN, cy, "CRM", "Sales blueprint, quotes, PO and OVF", "Approved OVF goes to SCM and Accounts"),
        (SLIDE_W - MARGIN - 3.4, cy, "HRMS", "Lifecycle, attendance, leave, payroll", "Attendance and leave feed payroll"),
        (cx + (cwid - 3.4) / 2, app_y, "Employee App", "Self-service on mobile", None),
    ]
    for x, y, t_, b_, flow in nodes:
        card(s, x, y, 3.4, 1.3 if flow is None else side_h)
        rect(s, x, y + 0.25, 0.07, 0.7, RED)
        text(s, x + 0.3, y + 0.22, 2.9, 0.4, t_, size=17, font=FONT_SEMI, color=INK)
        text(s, x + 0.3, y + 0.62, 2.9, 0.4, b_, size=11.5, color=MUTED_INK)
        if flow:
            rect(s, x + 0.3, y + 1.25, 2.8, 0.01, BORDER)
            text(s, x + 0.3, y + 1.4, 2.9, 0.6, [[("\u2192  ", {"color": RED, "font": FONT_SEMI}), (flow, {})]], size=11.5, color=INK)
    mid = cy + chei / 2
    for x1, y1, x2, y2 in [(MARGIN + 3.4, mid, cx, mid), (cx + cwid, mid, SLIDE_W - MARGIN - 3.4, mid), (cx + cwid / 2, cy + chei, cx + cwid / 2, app_y)]:
        ln = s.shapes.add_connector(1, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
        ln.line.color.rgb = TEAL
        ln.line.width = Pt(2)
    text(s, 8.85, app_y + 0.35, 3.9, 0.7, [[("\u2192  ", {"color": RED, "font": FONT_SEMI}), ("App and HRMS share the same live employee data", {})]], size=11.5, color=INK)
    footer(s, n, logos)
    notes(s, """
Behind the three modules is a shared core: one login, one role model, one workflow and approval engine, notifications and audit.
The CRM's approved OVF flows to SCM and Accounts. In the HRMS, attendance and leave feed payroll directly.
The Employee App reads and writes the same HRMS data, so what an employee sees is exactly what HR sees.
""")

    # 12 ── Summary ------------------------------------------------------------
    s = new_slide()
    header(s, "At a glance", "Legacy systems vs. iConnect Plus")
    colw, top, h = 5.9, 1.65, 4.05
    left = card(s, MARGIN, top, colw, h, fill=WHITE)
    right = card(s, MARGIN + colw + 0.33, top, colw, h, fill=TEAL, line=TEAL)
    gradient(right, TEAL, RGBColor(0x00, 0x3E, 0x48), 135)
    eyebrow(s, MARGIN + 0.4, top + 0.35, "Legacy systems", color=MUTED_INK, w=5)
    text(s, MARGIN + 0.4, top + 0.65, colw - 0.8, 0.5, "We adapted to the software", size=20, font=FONT_SEMI, color=INK)
    eyebrow(s, MARGIN + colw + 0.73, top + 0.35, "iConnect Plus", color=RGBColor(0xA8, 0xE3, 0xDF), w=5)
    text(s, MARGIN + colw + 0.73, top + 0.65, colw - 0.8, 0.5, "The software adapts to us", size=20, font=FONT_SEMI, color=WHITE)
    legacy_points = [
        ("", "Generic workflows; real steps handled outside the tool"),
        ("", "Data re-entered across sales, HR and payroll"),
        ("", "Approvals lost in email and chat"),
        ("", "Desk-bound HR self-service"),
        ("", "Changes depend on vendor roadmaps and licences"),
    ]
    new_points = [
        ("", "Our sales blueprint and HR policies built into the system"),
        ("", "Enter once, use everywhere on one platform"),
        ("", "Every approval tracked in-app with an audit trail"),
        ("", "HR self-service on every employee\u2019s phone"),
        ("", "Owned in-house and evolves with our process"),
    ]
    bullet_list(s, MARGIN + 0.4, top + 1.45, colw - 0.8, 3.3, legacy_points, size=13, color=MUTED_INK, gap=12, marker_color=BORDER)
    bullet_list(s, MARGIN + colw + 0.73, top + 1.45, colw - 0.8, 3.3, new_points, size=13, color=WHITE, gap=12, marker_color=RED)
    text(s, MARGIN, 5.95, SLIDE_W - 2 * MARGIN, 0.6,
         [[("Built on our process.  ", {"color": INK}), ("Owned by us.  ", {"color": TEAL}), ("Ready to grow with us.", {"color": RED})]],
         size=18, font=FONT_SEMI, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    footer(s, n, logos)
    notes(s, """
To summarise: with legacy systems, we adapted to the software. With iConnect Plus, the software adapts to us.
Our process is built in, data is entered once, approvals are tracked, employees serve themselves from their phones,
and because we own the platform, it keeps evolving with the business.
""")

    # 13 ── Thank you ----------------------------------------------------------
    s = new_slide(RAIL)
    bg = rect(s, 0, 0, SLIDE_W, SLIDE_H, RAIL)
    gradient(bg, RAIL, RAIL_TO, 135)
    picture(s, logos["mark_white"], SLIDE_W / 2 - 0.45, 1.55, h=1.0)
    text(s, 0, 2.85, SLIDE_W, 0.9, "Thank you", size=44, color=WHITE, font=FONT_SEMI, align=PP_ALIGN.CENTER)
    text(s, 0, 3.75, SLIDE_W, 0.5, "Questions and live demo", size=18, color=TEAL_BRIGHT, align=PP_ALIGN.CENTER)
    rect(s, SLIDE_W / 2 - 0.3, 4.5, 0.6, 0.05, RED)
    text(s, 0, 4.75, SLIDE_W, 0.5, "iConnect Plus  \u00b7  CRM  \u00b7  HRMS  \u00b7  Employee App", size=12, color=ON_DARK_MUTED, align=PP_ALIGN.CENTER)
    chip = rect(s, SLIDE_W / 2 - 1.05, 5.75, 2.1, 0.8, WHITE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.2)
    picture(s, logos["cache_red"], SLIDE_W / 2 - 0.8, 5.88, h=0.54)
    notes(s, """
Thank you. Happy to take questions, or walk through a live demo of any of the three modules.
""")

    prs.save(OUT)
    print(f"Saved {OUT} ({n} slides)")


if __name__ == "__main__":
    build()
