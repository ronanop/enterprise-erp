/**
 * Organisational documents / policies under EDoc → Other.
 * HR creates & sends; employees accept in ESS (PWA). Stored locally for now.
 */

export type OrgDocKind = "policy" | "handbook" | "contract" | "notice" | "other";

export type OrgDocAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  size: number;
};

export type OrgDocAcceptance = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  email: string;
  status: "pending" | "accepted" | "declined";
  sentAt: string;
  respondedAt?: string;
};

export type OrgDocument = {
  id: string;
  code: string;
  title: string;
  kind: OrgDocKind;
  body: string;
  attachments: OrgDocAttachment[];
  status: "draft" | "sent" | "archived";
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  acceptances: OrgDocAcceptance[];
};

const STORAGE_KEY = "erp_edoc_org_documents_v1";

/** Soft cap — attachments are stored in localStorage for the PWA demo. */
export const MAX_ORG_DOC_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_ORG_DOC_ATTACHMENTS = 8;

function readAll(): OrgDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OrgDocument[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => ({
      ...row,
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
    }));
  } catch {
    return [];
  }
}

function writeAll(rows: OrgDocument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function nowIso() {
  return new Date().toISOString();
}

function nextCode(existing: OrgDocument[]): string {
  let max = 0;
  for (const r of existing) {
    const m = /^ORG-(\d+)$/i.exec(r.code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `ORG-${String(max + 1).padStart(3, "0")}`;
}

export function listOrgDocuments(): OrgDocument[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getOrgDocument(id: string): OrgDocument | null {
  return readAll().find((r) => r.id === id) ?? null;
}

export function createOrgDocument(input: {
  title: string;
  kind: OrgDocKind;
  body: string;
  attachments?: OrgDocAttachment[];
}): OrgDocument {
  const all = readAll();
  const row: OrgDocument = {
    id: crypto.randomUUID(),
    code: nextCode(all),
    title: input.title.trim(),
    kind: input.kind,
    body: input.body.trim(),
    attachments: input.attachments ?? [],
    status: "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    acceptances: [],
  };
  writeAll([row, ...all]);
  return row;
}

export function updateOrgDocument(
  id: string,
  patch: Partial<Pick<OrgDocument, "title" | "kind" | "body" | "status" | "attachments">>,
): OrgDocument | null {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const next = {
    ...all[idx],
    ...patch,
    updatedAt: nowIso(),
  };
  all[idx] = next;
  writeAll(all);
  return next;
}

export function deleteOrgDocument(id: string): boolean {
  const all = readAll();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}

export type SendRecipient = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  email: string;
};

/** Send (or re-send) document to employees. Pending recipients are added; already accepted stay. */
export function sendOrgDocument(id: string, recipients: SendRecipient[]): OrgDocument | null {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const doc = all[idx];
  const sentAt = nowIso();
  const byId = new Map(doc.acceptances.map((a) => [a.employeeId, a]));

  for (const r of recipients) {
    const existing = byId.get(r.employeeId);
    if (existing?.status === "accepted") continue;
    byId.set(r.employeeId, {
      employeeId: r.employeeId,
      employeeCode: r.employeeCode,
      employeeName: r.employeeName,
      email: r.email,
      status: "pending",
      sentAt,
    });
  }

  const next: OrgDocument = {
    ...doc,
    status: "sent",
    sentAt,
    updatedAt: sentAt,
    acceptances: Array.from(byId.values()),
  };
  all[idx] = next;
  writeAll(all);
  return next;
}

export function acceptOrgDocument(
  docId: string,
  employeeId: string,
  decision: "accepted" | "declined" = "accepted",
): OrgDocument | null {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === docId);
  if (idx < 0) return null;
  const doc = all[idx];
  const acceptances = doc.acceptances.map((a) =>
    a.employeeId === employeeId
      ? { ...a, status: decision, respondedAt: nowIso() }
      : a,
  );
  const next = { ...doc, acceptances, updatedAt: nowIso() };
  all[idx] = next;
  writeAll(all);
  return next;
}

/** Docs pending acceptance for an employee (match by id, code, or email). */
export function listPendingForEmployee(opts: {
  employeeId?: string;
  employeeCode?: string;
  email?: string;
}): OrgDocument[] {
  const id = (opts.employeeId || "").trim().toLowerCase();
  const code = (opts.employeeCode || "").trim().toLowerCase();
  const email = (opts.email || "").trim().toLowerCase();

  return listOrgDocuments().filter((doc) => {
    if (doc.status === "archived") return false;
    return doc.acceptances.some((a) => {
      if (a.status !== "pending") return false;
      const aid = a.employeeId.toLowerCase();
      const acode = a.employeeCode.toLowerCase();
      const aemail = a.email.toLowerCase();
      return (
        (id && aid === id) ||
        (code && acode === code) ||
        (email && aemail === email)
      );
    });
  });
}

export function acceptanceStats(doc: OrgDocument): {
  total: number;
  pending: number;
  accepted: number;
  declined: number;
} {
  const total = doc.acceptances.length;
  let pending = 0;
  let accepted = 0;
  let declined = 0;
  for (const a of doc.acceptances) {
    if (a.status === "pending") pending += 1;
    else if (a.status === "accepted") accepted += 1;
    else declined += 1;
  }
  return { total, pending, accepted, declined };
}
