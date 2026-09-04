/** Escape text interpolated into HTML generated for print/export windows. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Same-origin app paths only — blocks javascript: and protocol-relative hrefs. */
export function safeAppHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return "#";
  }
  return trimmed;
}

/** Open a print preview without injecting a <script> tag into the document. */
export function openPrintDocument(html: string, width = 1200, height = 800): void {
  const win = window.open("", "_blank", `noopener,noreferrer,width=${width},height=${height}`);
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  const print = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* popup blockers / closed window */
    }
  };
  if (win.document.readyState === "complete") {
    print();
    return;
  }
  win.addEventListener("load", print, { once: true });
}
