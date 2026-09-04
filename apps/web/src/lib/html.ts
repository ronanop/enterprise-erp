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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Build a same-origin detail href from a validated UUID segment. */
export function safeEntityHref(basePath: string, id: string): string {
  const base = basePath.startsWith("/") ? basePath.replace(/\/$/, "") : `/${basePath.replace(/\/$/, "")}`;
  if (!UUID_RE.test(id)) {
    return "#";
  }
  return safeAppHref(`${base}/${id}`);
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
