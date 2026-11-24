#!/usr/bin/env node
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACK = path.join(ROOT, "docs", "10_SECURITY_COMPLIANCE");
const PDF_DIR = path.join(PACK, "pdf");

const CSS = `
@page { size: A4; margin: 12mm 10mm 14mm 10mm; }
body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.4; color: #0f172a; }
h1 { font-size: 18pt; color: #0f172a; border-bottom: 2px solid #1e3a5f; padding-bottom: 6px; }
h2 { font-size: 13pt; color: #1e3a5f; margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px; page-break-after: avoid; }
h3 { font-size: 11pt; color: #334155; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 8pt; }
th, td { border: 1px solid #94a3b8; padding: 4px 6px; vertical-align: top; text-align: left; word-break: break-word; }
th { background: #e2e8f0; font-weight: 700; }
code, pre { font-family: Consolas, "Courier New", monospace; font-size: 8pt; }
pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px; white-space: pre-wrap; page-break-inside: avoid; }
img { display: block; max-width: 100%; height: auto; margin: 8px auto; border: 1px solid #cbd5e1; page-break-inside: avoid; }
blockquote { border-left: 3px solid #1e3a5f; background: #f8fafc; margin: 8px 0; padding: 6px 10px; color: #334155; }
hr { border: none; border-top: 1px solid #cbd5e1; margin: 14px 0; }
`;

function listMarkdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !["pdf", "_assets"].includes(entry.name)) {
      out.push(...listMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      out.push(full);
    }
  }
  return out.sort();
}

async function loadMdToPdf() {
  for (const id of ["md-to-pdf", path.join("/tmp/node_modules", "md-to-pdf"), path.join(ROOT, "node_modules", "md-to-pdf")]) {
    try {
      const mod = await import(id);
      if (mod.mdToPdf) return mod.mdToPdf;
    } catch {}
  }
  try {
    return require("md-to-pdf").mdToPdf;
  } catch {
    console.error("md-to-pdf not found");
    process.exit(1);
  }
}

async function main() {
  fs.mkdirSync(PDF_DIR, { recursive: true });
  const mdToPdf = await loadMdToPdf();
  const files = listMarkdownFiles(PACK);
  console.log(`Converting ${files.length} markdown files → ${PDF_DIR}`);
  let ok = 0, fail = 0;
  const opts = {
    pdf_options: { format: "A4", margin: { top: "12mm", right: "10mm", bottom: "14mm", left: "10mm" }, printBackground: true },
    launch_options: { args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] },
    css: CSS,
  };
  for (const mdPath of files) {
    const base = path.basename(mdPath, ".md");
    const pdfPath = path.join(PDF_DIR, `${base}.pdf`);
    process.stdout.write(`  ${base}.pdf ... `);
    try {
      await mdToPdf({ path: mdPath }, { ...opts, dest: pdfPath });
      console.log(`OK (${Math.round(fs.statSync(pdfPath).size / 1024)} KB)`);
      ok++;
    } catch (err) {
      console.log(`FAIL: ${err.message || err}`);
      fail++;
    }
  }
  const readme = path.join(PACK, "README.md");
  if (fs.existsSync(readme)) {
    const indexPdf = path.join(PDF_DIR, "00-Security-Compliance-Pack-Index.pdf");
    process.stdout.write("  00-Security-Compliance-Pack-Index.pdf ... ");
    try {
      await mdToPdf({ path: readme }, { ...opts, dest: indexPdf });
      console.log("OK");
      ok++;
    } catch (err) {
      console.log(`FAIL: ${err.message || err}`);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
