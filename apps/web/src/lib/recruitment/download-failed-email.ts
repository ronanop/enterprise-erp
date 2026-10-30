/**
 * When SMTP send fails, download a .eml so HR can open/send manually.
 */

export type FailedEmailSnapshot = {
  to_address: string;
  subject: string;
  body_html: string;
  from_address?: string;
};

function toPlainText(html: string): string {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function foldSubject(subject: string): string {
  const s = (subject || "(no subject)").replace(/[\r\n]+/g, " ").trim();
  return s.slice(0, 200);
}

/** Build a minimal MIME message and trigger a browser download. */
export function downloadFailedEmailAsEml(opts: FailedEmailSnapshot): string {
  const to = (opts.to_address || "").trim() || "unknown@example.com";
  const from = (opts.from_address || "erp@iconnectplus.in").trim();
  const subject = foldSubject(opts.subject);
  const html = opts.body_html || "<p>(empty)</p>";
  const plain = toPlainText(html) || "(empty)";
  const boundary = `bound_${Date.now().toString(36)}`;
  const date = new Date().toUTCString();

  const eml = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "X-iConnectPlus-Note: Downloaded because SMTP send failed — open in Outlook/Mail and send manually.",
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    plain,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const safeTo = to.replace(/[^\w.@+-]+/g, "_").slice(0, 40);
  const fileName = `failed-email-${safeTo}-${Date.now()}.eml`;
  if (typeof document !== "undefined") {
    const blob = new Blob([eml], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return fileName;
}
