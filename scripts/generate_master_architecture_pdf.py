"""Generate Master Architecture PDF with correctly rendered tables and diagrams.

Pipeline:
1. Render Mermaid -> PNG (mermaid-cli)
2. Build print-ready HTML with relative image paths + strong table CSS
3. Print to PDF via Playwright Chromium (accurate CSS/layout)
4. Rasterize every PDF page and write preview PNGs for visual QA
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import markdown
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "07_MASTER_ARCHITECTURE"
MD_PATH = OUT_DIR / "Enterprise_ERP_Master_Architecture.md"
PDF_PATH = OUT_DIR / "Enterprise_ERP_Master_Architecture.pdf"
HTML_PATH = OUT_DIR / "Enterprise_ERP_Master_Architecture.html"
DIAGRAM_DIR = OUT_DIR / "diagrams"
PREVIEW_DIR = OUT_DIR / "pdf_page_previews"

CSS = """
@page {
  size: A4;
  margin: 14mm 12mm 16mm 12mm;
}

* { box-sizing: border-box; }

html, body {
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
  font-size: 10pt;
  line-height: 1.4;
  color: #0f172a;
  background: #fff;
  margin: 0;
  padding: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

h1 {
  font-size: 20pt;
  color: #0f172a;
  border-bottom: 2px solid #1e3a5f;
  padding-bottom: 8px;
  margin: 0 0 14px;
  page-break-after: avoid;
}

h2 {
  font-size: 14pt;
  color: #1e3a5f;
  margin: 22px 0 10px;
  padding-top: 4px;
  border-top: 1px solid #e2e8f0;
  page-break-after: avoid;
  break-after: avoid-page;
}

h3 {
  font-size: 11.5pt;
  color: #334155;
  margin: 16px 0 8px;
  page-break-after: avoid;
  break-after: avoid-page;
}

h4 {
  font-size: 10.5pt;
  color: #475569;
  margin: 12px 0 6px;
  page-break-after: avoid;
}

p, li { orphans: 3; widows: 3; }

ul, ol { padding-left: 1.6em; margin: 6px 0 10px; }
ol { padding-left: 2.2em; list-style-position: outside; }
li { margin: 2px 0; }
ol li { padding-left: 0.35em; }

/* Tables — critical for print fidelity */
table {
  width: 100% !important;
  max-width: 100% !important;
  border-collapse: collapse;
  margin: 10px 0 14px;
  font-size: 8pt;
  table-layout: fixed;
  page-break-inside: auto;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}

thead { display: table-header-group; }
tr { page-break-inside: avoid; break-inside: avoid; }

th, td {
  border: 1px solid #94a3b8;
  padding: 5px 6px;
  vertical-align: top;
  text-align: left;
  word-break: break-word;
  overflow-wrap: anywhere;
  hyphens: auto;
}

th {
  background: #e2e8f0 !important;
  font-weight: 700;
  color: #0f172a;
}

code {
  font-family: Consolas, "Courier New", monospace;
  font-size: 8pt;
  background: #f1f5f9;
  padding: 1px 3px;
  border-radius: 2px;
}

pre {
  font-family: Consolas, "Courier New", monospace;
  font-size: 7.5pt;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  page-break-inside: avoid;
}

.figure {
  margin: 12px 0 16px;
  page-break-inside: avoid;
  break-inside: avoid;
}

.figure-caption {
  font-size: 8.5pt;
  color: #475569;
  font-style: italic;
  margin: 0 0 4px;
}

img.diagram {
  display: block;
  width: auto !important;
  max-width: 100% !important;
  max-height: 210mm;
  height: auto !important;
  margin: 0 auto;
  border: 1px solid #cbd5e1;
  background: #fff;
  object-fit: contain;
}

a { color: #1e3a5f; text-decoration: none; }
hr { border: none; border-top: 1px solid #cbd5e1; margin: 18px 0; }
strong { color: #0f172a; }

blockquote {
  margin: 8px 0;
  padding: 6px 10px;
  border-left: 3px solid #1e3a5f;
  background: #f8fafc;
  color: #334155;
}
"""

MERMAID_PATTERN = re.compile(r"```mermaid\n(.*?)```", re.DOTALL)


def find_mmdc() -> list[str]:
    which = shutil.which("mmdc")
    if which:
        cmd_shim = Path(which).with_suffix(".cmd")
        if cmd_shim.exists():
            return [str(cmd_shim)]
        return [which]
    npx = shutil.which("npx")
    if not npx:
        raise RuntimeError("mermaid-cli (mmdc) not found")
    npx_cmd = Path(npx).with_suffix(".cmd")
    launcher = str(npx_cmd) if npx_cmd.exists() else npx
    return [launcher, "--yes", "@mermaid-js/mermaid-cli@11.4.2"]


def render_mermaid_png(diagram: str, png_path: Path, mmdc_cmd: list[str]) -> None:
    png_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        mmd_path = Path(tmp) / "diagram.mmd"
        mmd_path.write_text(diagram.strip() + "\n", encoding="utf-8", newline="\n")
        cmd = [
            *mmdc_cmd,
            "-i",
            str(mmd_path),
            "-o",
            str(png_path),
            "-b",
            "white",
            "-s",
            "2",
            "-w",
            "1400",
        ]
        use_shell = os.name == "nt"
        result = subprocess.run(
            cmd if not use_shell else subprocess.list2cmdline(cmd),
            capture_output=True,
            text=True,
            check=False,
            shell=use_shell,
        )
        if result.returncode != 0 or not png_path.exists():
            raise RuntimeError(
                f"mmdc failed for {png_path.name}:\n"
                f"stdout: {result.stdout}\nstderr: {result.stderr}"
            )


def replace_mermaid_with_images(md_text: str) -> str:
    if os.environ.get("FORCE_RENDER") == "1" and DIAGRAM_DIR.exists():
        for old in DIAGRAM_DIR.glob("diagram_*.png"):
            old.unlink()
    DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)

    mmdc_cmd = find_mmdc()
    diagrams = list(MERMAID_PATTERN.finditer(md_text))
    print(f"Rendering {len(diagrams)} Mermaid diagrams with: {' '.join(mmdc_cmd)}")

    counter = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal counter
        counter += 1
        body = match.group(1).strip()
        png_path = DIAGRAM_DIR / f"diagram_{counter:02d}.png"
        rel = f"diagrams/{png_path.name}"
        print(f"  [{counter}/{len(diagrams)}] {png_path.name} ...", flush=True)
        try:
            if not png_path.exists():
                render_mermaid_png(body, png_path, mmdc_cmd)
            else:
                print("    (reusing existing PNG)", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"  WARN: render failed ({exc}); embedding source fallback")
            escaped = (
                body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            )
            return (
                '<p class="figure-caption">Diagram (render failed — source):</p>'
                f"<pre>{escaped}</pre>"
            )

        return (
            f'<div class="figure">'
            f'<p class="figure-caption">Figure {counter}</p>'
            f'<img class="diagram" src="{rel}" alt="Architecture diagram {counter}" />'
            f"</div>"
        )

    return MERMAID_PATTERN.sub(repl, md_text)


def build_html(md_text: str) -> str:
    processed = replace_mermaid_with_images(md_text)
    body = markdown.markdown(
        processed,
        extensions=["tables", "fenced_code", "toc", "sane_lists", "nl2br"],
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Enterprise ERP Platform — Master Architecture</title>
  <style>{CSS}</style>
</head>
<body>
{body}
</body>
</html>
"""


def html_to_pdf() -> None:
    html_uri = HTML_PATH.resolve().as_uri()
    print(f"Printing PDF via Playwright: {html_uri}")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(html_uri, wait_until="networkidle")
        # Wait until all diagram images are loaded
        page.wait_for_function(
            """() => {
              const imgs = Array.from(document.images);
              return imgs.length === 0 || imgs.every(i => i.complete && i.naturalWidth > 0);
            }""",
            timeout=120_000,
        )
        page.pdf(
            path=str(PDF_PATH),
            format="A4",
            print_background=True,
            margin={
                "top": "14mm",
                "right": "12mm",
                "bottom": "16mm",
                "left": "12mm",
            },
            display_header_footer=True,
            header_template=(
                '<div style="font-size:8px; width:100%; text-align:right; '
                'color:#64748b; padding-right:12mm;">'
                "Enterprise ERP — Master Architecture</div>"
            ),
            footer_template=(
                '<div style="font-size:8px; width:100%; text-align:center; '
                'color:#64748b;">'
                "Page <span class=\"pageNumber\"></span> of "
                '<span class="totalPages"></span></div>'
            ),
        )
        browser.close()


def export_page_previews() -> list[Path]:
    """Rasterize each PDF page with PyMuPDF for visual QA."""
    import pymupdf

    if PREVIEW_DIR.exists():
        for old in PREVIEW_DIR.glob("page_*.png"):
            old.unlink()
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    doc = pymupdf.open(PDF_PATH)
    previews: list[Path] = []
    print(f"Exporting {doc.page_count} page previews ...")
    zoom = 1.5
    mat = pymupdf.Matrix(zoom, zoom)
    for i in range(doc.page_count):
        page = doc.load_page(i)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        out = PREVIEW_DIR / f"page_{i + 1:02d}.png"
        pix.save(str(out))
        previews.append(out)
        print(f"  {out.name}: {out.stat().st_size:,} bytes")
    doc.close()
    return previews


def qa_check_previews(previews: list[Path]) -> None:
    """Automated QA: flag tiny pages; sample-check for table lines / images via size."""
    print("\n=== PDF page QA ===")
    problems = 0
    for prev in previews:
        size = prev.stat().st_size
        status = "OK" if size >= 20_000 else "WARN-small"
        if status != "OK":
            problems += 1
        print(f"  {prev.name}: {size:,} bytes [{status}]")
    print(f"Total pages: {len(previews)} | warnings: {problems}")
    if problems:
        print("Review WARN pages in pdf_page_previews/ before distributing.")


def main() -> None:
    md_text = MD_PATH.read_text(encoding="utf-8")
    html = build_html(md_text)
    HTML_PATH.write_text(html, encoding="utf-8")
    print(f"Wrote {HTML_PATH}")

    html_to_pdf()
    print(f"Wrote {PDF_PATH} ({PDF_PATH.stat().st_size:,} bytes)")

    previews = export_page_previews()
    qa_check_previews(previews)


if __name__ == "__main__":
    main()
