"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CloudPoLine, SiteInstallation } from "@/services/projects-portal-service";

export type CloudPoDeliveryMode = "scm" | "onsite" | "install";

export type CloudPoDeliveryDraft = {
  project_name: string;
  circle_name: string;
  site_name: string;
  line_type: string;
  quantity: string;
  delivered_quantity: string;
  onsite_delivered_quantity: string;
  installed_quantity: string;
  customer_po_number: string;
  document_date: string;
  delivery_date: string;
  onsite_delivery_date: string;
  installed_date: string;
};

function qtyNumber(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function remainingQty(quantity: number, delivered: number): number {
  return Math.max(0, quantity - delivered);
}

export function cloudPoLinesFullyDelivered(lines: CloudPoDeliveryDraft[]): boolean {
  const meaningful = lines.filter((line) => qtyNumber(line.quantity) > 0);
  if (meaningful.length === 0) return true;
  return meaningful.every(
    (line) => qtyNumber(line.delivered_quantity) >= qtyNumber(line.quantity),
  );
}

/** Onsite complete only when every original PO qty has been received on site. */
export function cloudPoLinesFullyDeliveredOnsite(lines: CloudPoDeliveryDraft[]): boolean {
  const meaningful = lines.filter((line) => qtyNumber(line.quantity) > 0);
  if (meaningful.length === 0) return false;
  return meaningful.every(
    (line) => qtyNumber(line.onsite_delivered_quantity) >= qtyNumber(line.quantity),
  );
}

/** Installation complete only when every original PO qty has been installed. */
export function cloudPoLinesFullyInstalled(lines: CloudPoDeliveryDraft[]): boolean {
  const meaningful = lines.filter((line) => qtyNumber(line.quantity) > 0);
  if (meaningful.length === 0) return false;
  return meaningful.every(
    (line) => qtyNumber(line.installed_quantity) >= qtyNumber(line.quantity),
  );
}

function emptyDraft(): CloudPoDeliveryDraft {
  return {
    project_name: "",
    circle_name: "",
    site_name: "",
    line_type: "",
    quantity: "",
    delivered_quantity: "0",
    onsite_delivered_quantity: "0",
    installed_quantity: "0",
    customer_po_number: "",
    document_date: "",
    delivery_date: "",
    onsite_delivery_date: "",
    installed_date: "",
  };
}

/**
 * Stamp a delivery date when remaining hits 0; clear when qty remains.
 * Re-stamps to today only when the line newly becomes fully delivered.
 */
function withStampedDate(
  line: CloudPoDeliveryDraft,
  delivered: number,
  qty: number,
  dateKey: "delivery_date" | "onsite_delivery_date" | "installed_date",
  previousDelivered: number,
): CloudPoDeliveryDraft {
  if (qty > 0 && delivered >= qty) {
    const newlyCompleted = previousDelivered < qty;
    if (newlyCompleted || !line[dateKey].trim()) {
      return { ...line, [dateKey]: todayIsoDate() };
    }
    return line;
  }
  return { ...line, [dateKey]: "" };
}

/** Build editable drafts from stored cloud PO lines (or synthesize from legacy qty). */
export function draftsFromCloudPoLines(
  site: Pick<
    SiteInstallation,
    | "cloud_po_lines"
    | "server_qty"
    | "rack_qty"
    | "application"
    | "site_name"
    | "circle"
    | "cloud_name"
  >,
): CloudPoDeliveryDraft[] {
  const raw = Array.isArray(site.cloud_po_lines) ? site.cloud_po_lines : [];
  if (raw.length > 0) {
    return raw.map((line) => ({
      project_name: line.project_name?.trim() || "",
      circle_name: line.circle_name?.trim() || "",
      site_name: line.site_name?.trim() || "",
      line_type: line.line_type?.trim() || "",
      quantity: line.quantity != null ? String(line.quantity) : "",
      delivered_quantity:
        line.delivered_quantity != null ? String(line.delivered_quantity) : "0",
      onsite_delivered_quantity:
        line.onsite_delivered_quantity != null
          ? String(line.onsite_delivered_quantity)
          : "0",
      installed_quantity:
        line.installed_quantity != null ? String(line.installed_quantity) : "0",
      customer_po_number: line.customer_po_number?.trim() || "",
      document_date: line.document_date ? String(line.document_date).slice(0, 10) : "",
      delivery_date: line.delivery_date ? String(line.delivery_date).slice(0, 10) : "",
      onsite_delivery_date: line.onsite_delivery_date
        ? String(line.onsite_delivery_date).slice(0, 10)
        : "",
      installed_date: line.installed_date
        ? String(line.installed_date).slice(0, 10)
        : "",
    }));
  }

  const synthesized: CloudPoDeliveryDraft[] = [];
  if (site.server_qty != null && site.server_qty > 0) {
    synthesized.push({
      ...emptyDraft(),
      project_name: site.cloud_name?.trim() || "",
      circle_name: site.circle?.trim() || "",
      site_name: site.site_name?.trim() || "",
      line_type: site.application?.trim() || "Server",
      quantity: String(site.server_qty),
    });
  }
  if (site.rack_qty != null && site.rack_qty > 0) {
    synthesized.push({
      ...emptyDraft(),
      project_name: site.cloud_name?.trim() || "",
      circle_name: site.circle?.trim() || "",
      site_name: site.site_name?.trim() || "",
      line_type: "Rack",
      quantity: String(site.rack_qty),
    });
  }
  return synthesized;
}

export function serializeCloudPoDeliveryDrafts(lines: CloudPoDeliveryDraft[]): string {
  return JSON.stringify(lines);
}

export function parseCloudPoDeliveryDrafts(raw: string | undefined): CloudPoDeliveryDraft[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      if (!item || typeof item !== "object") return emptyDraft();
      const row = item as Record<string, unknown>;
      return {
        project_name: typeof row.project_name === "string" ? row.project_name : "",
        circle_name: typeof row.circle_name === "string" ? row.circle_name : "",
        site_name: typeof row.site_name === "string" ? row.site_name : "",
        line_type: typeof row.line_type === "string" ? row.line_type : "",
        quantity:
          row.quantity == null || row.quantity === "" ? "" : String(row.quantity),
        delivered_quantity:
          row.delivered_quantity == null || row.delivered_quantity === ""
            ? "0"
            : String(row.delivered_quantity),
        onsite_delivered_quantity:
          row.onsite_delivered_quantity == null || row.onsite_delivered_quantity === ""
            ? "0"
            : String(row.onsite_delivered_quantity),
        installed_quantity:
          row.installed_quantity == null || row.installed_quantity === ""
            ? "0"
            : String(row.installed_quantity),
        customer_po_number:
          typeof row.customer_po_number === "string" ? row.customer_po_number : "",
        document_date:
          typeof row.document_date === "string" ? row.document_date.slice(0, 10) : "",
        delivery_date:
          typeof row.delivery_date === "string" ? row.delivery_date.slice(0, 10) : "",
        onsite_delivery_date:
          typeof row.onsite_delivery_date === "string"
            ? row.onsite_delivery_date.slice(0, 10)
            : "",
        installed_date:
          typeof row.installed_date === "string" ? row.installed_date.slice(0, 10) : "",
      };
    });
  } catch {
    return [];
  }
}

export function draftsToCloudPoLines(lines: CloudPoDeliveryDraft[]): CloudPoLine[] {
  return lines.map((line) => {
    const quantity = qtyNumber(line.quantity);
    const delivered = Math.min(
      qtyNumber(line.delivered_quantity),
      quantity || qtyNumber(line.delivered_quantity),
    );
    const stamped = withStampedDate(
      { ...line, delivered_quantity: String(delivered) },
      delivered,
      quantity,
      "delivery_date",
      delivered,
    );
    // Cap at original qty; also cannot exceed what SCM has shipped so far.
    const onsiteCap =
      delivered > 0 ? Math.min(quantity || delivered, delivered) : quantity;
    const onsiteDelivered = Math.min(
      qtyNumber(line.onsite_delivered_quantity),
      onsiteCap || qtyNumber(line.onsite_delivered_quantity),
    );
    const onsiteStamped = withStampedDate(
      { ...stamped, onsite_delivered_quantity: String(onsiteDelivered) },
      onsiteDelivered,
      quantity,
      "onsite_delivery_date",
      onsiteDelivered,
    );
    // Installed cannot exceed what is on site (or full qty once onsite catches up).
    const installCap =
      onsiteDelivered > 0
        ? Math.min(quantity || onsiteDelivered, onsiteDelivered)
        : 0;
    const installed = Math.min(
      qtyNumber(line.installed_quantity),
      installCap || qtyNumber(line.installed_quantity),
    );
    const installStamped = withStampedDate(
      { ...onsiteStamped, installed_quantity: String(installed) },
      installed,
      quantity,
      "installed_date",
      installed,
    );
    return {
      project_name: line.project_name.trim() || null,
      circle_name: line.circle_name.trim() || null,
      site_name: line.site_name.trim() || null,
      line_type: line.line_type.trim() || null,
      quantity: quantity > 0 ? quantity : null,
      delivered_quantity: delivered,
      onsite_delivered_quantity: onsiteDelivered,
      installed_quantity: installed,
      customer_po_number: line.customer_po_number.trim() || null,
      document_date: line.document_date.trim() || null,
      delivery_date: stamped.delivery_date.trim() || null,
      onsite_delivery_date: onsiteStamped.onsite_delivery_date.trim() || null,
      installed_date: installStamped.installed_date.trim() || null,
    };
  });
}

export function CloudPoDeliveryLinesEditor({
  value,
  onChange,
  disabled,
  readOnlyDelivered = false,
  mode = "scm",
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Project detail / overview: show delivered as text, not inputs. */
  readOnlyDelivered?: boolean;
  /** SCM edits warehouse delivery; onsite edits site receipt; install edits installed qty. */
  mode?: CloudPoDeliveryMode;
}) {
  const lines = parseCloudPoDeliveryDrafts(value);
  const isOnsite = mode === "onsite";
  const isInstall = mode === "install";
  const visibleLines =
    isOnsite || isInstall
      ? lines
          .map((line, index) => ({ line, index }))
          .filter(({ line }) => qtyNumber(line.quantity) > 0)
      : lines.map((line, index) => ({ line, index }));

  function updateQty(sourceIndex: number, nextValue: string) {
    if (disabled || readOnlyDelivered) return;
    const next = lines.map((line, i) => {
      if (i !== sourceIndex) return line;

      if (isInstall) {
        const fullQty = qtyNumber(line.quantity);
        const onsite = qtyNumber(line.onsite_delivered_quantity);
        const inputMax =
          onsite > 0 ? Math.min(fullQty || onsite, onsite) : 0;
        const previous = qtyNumber(line.installed_quantity);
        const raw = nextValue.trim();
        if (raw === "") {
          return withStampedDate(
            { ...line, installed_quantity: "" },
            0,
            fullQty,
            "installed_date",
            previous,
          );
        }
        let n = Number(raw);
        if (!Number.isFinite(n)) return line;
        n = Math.max(0, Math.trunc(n));
        if (inputMax > 0) n = Math.min(n, inputMax);
        else n = 0;
        return withStampedDate(
          { ...line, installed_quantity: String(n) },
          n,
          fullQty,
          "installed_date",
          previous,
        );
      }

      if (isOnsite) {
        const fullQty = qtyNumber(line.quantity);
        const scmDelivered = qtyNumber(line.delivered_quantity);
        const inputMax =
          scmDelivered > 0 ? Math.min(fullQty || scmDelivered, scmDelivered) : 0;
        const previousDelivered = qtyNumber(line.onsite_delivered_quantity);
        const raw = nextValue.trim();
        if (raw === "") {
          return withStampedDate(
            {
              ...line,
              onsite_delivered_quantity: "",
              installed_quantity: String(
                Math.min(qtyNumber(line.installed_quantity), 0),
              ),
            },
            0,
            fullQty,
            "onsite_delivery_date",
            previousDelivered,
          );
        }
        let n = Number(raw);
        if (!Number.isFinite(n)) return line;
        n = Math.max(0, Math.trunc(n));
        if (inputMax > 0) n = Math.min(n, inputMax);
        else n = 0;
        const cappedInstalled = Math.min(qtyNumber(line.installed_quantity), n);
        return withStampedDate(
          {
            ...line,
            onsite_delivered_quantity: String(n),
            installed_quantity: String(cappedInstalled),
          },
          n,
          fullQty,
          "onsite_delivery_date",
          previousDelivered,
        );
      }

      const qty = qtyNumber(line.quantity);
      const previousDelivered = qtyNumber(line.delivered_quantity);
      const raw = nextValue.trim();
      if (raw === "") {
        return withStampedDate(
          { ...line, delivered_quantity: "" },
          0,
          qty,
          "delivery_date",
          previousDelivered,
        );
      }
      let n = Number(raw);
      if (!Number.isFinite(n)) return line;
      n = Math.max(0, Math.trunc(n));
      if (qty > 0) n = Math.min(n, qty);
      const cappedOnsite = Math.min(qtyNumber(line.onsite_delivered_quantity), n);
      const cappedInstalled = Math.min(qtyNumber(line.installed_quantity), cappedOnsite);
      return withStampedDate(
        {
          ...line,
          delivered_quantity: String(n),
          onsite_delivered_quantity: String(cappedOnsite),
          installed_quantity: String(cappedInstalled),
        },
        n,
        qty,
        "delivery_date",
        previousDelivered,
      );
    });
    onChange(serializeCloudPoDeliveryDrafts(next));
  }

  if (visibleLines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No type / quantity lines for this project yet.
      </p>
    );
  }

  return (
    <div className="erp-scroll overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="border-b border-border/70 bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">Type</th>
            <th className="whitespace-nowrap px-3 py-2 font-semibold">Qty</th>
            {isOnsite ? (
              <th className="whitespace-nowrap px-3 py-2 font-semibold">SCM Qty</th>
            ) : null}
            {isInstall ? (
              <>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Onsite</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Installed</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Remaining</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Install Date</th>
              </>
            ) : (
              <>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Delivered</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Remaining</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Delivery Date</th>
              </>
            )}
            <th className="whitespace-nowrap px-3 py-2 font-semibold">PO</th>
          </tr>
        </thead>
        <tbody>
          {visibleLines.map(({ line, index }) => {
            const fullQty = qtyNumber(line.quantity);
            const scmDelivered = qtyNumber(line.delivered_quantity);
            const onsiteQty = qtyNumber(line.onsite_delivered_quantity);
            const installedQty = qtyNumber(line.installed_quantity);
            const qty = fullQty;

            if (isInstall) {
              const remaining = remainingQty(qty, installedQty);
              const inputMax =
                onsiteQty > 0 ? Math.min(fullQty || onsiteQty, onsiteQty) : 0;
              return (
                <tr
                  key={`${line.line_type}-${index}`}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {line.line_type || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {qty > 0 ? qty : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {onsiteQty > 0 ? onsiteQty : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {readOnlyDelivered || disabled ? (
                      <span className="tabular-nums">{installedQty}</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        max={inputMax > 0 ? inputMax : undefined}
                        step={1}
                        value={line.installed_quantity}
                        className="h-8 w-24 cursor-pointer"
                        disabled={inputMax <= 0}
                        onChange={(e) => updateQty(index, e.target.value)}
                        aria-label={`Installed quantity for ${line.line_type || "line"}`}
                      />
                    )}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 tabular-nums",
                      remaining > 0 ? "font-medium text-amber-700" : "text-emerald-700",
                    )}
                  >
                    {qty > 0 ? remaining : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {line.installed_date || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                    {line.customer_po_number || "—"}
                  </td>
                </tr>
              );
            }

            const delivered = isOnsite ? onsiteQty : scmDelivered;
            const remaining = remainingQty(qty, delivered);
            const inputMax = isOnsite
              ? scmDelivered > 0
                ? Math.min(fullQty || scmDelivered, scmDelivered)
                : 0
              : fullQty;
            const deliveredValue = isOnsite
              ? line.onsite_delivered_quantity
              : line.delivered_quantity;
            const deliveryDate = isOnsite
              ? line.onsite_delivery_date
              : line.delivery_date;
            return (
              <tr
                key={`${line.line_type}-${index}`}
                className="border-b border-border/40 last:border-0"
              >
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  {line.line_type || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  {qty > 0 ? qty : "—"}
                </td>
                {isOnsite ? (
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {scmDelivered > 0 ? scmDelivered : "—"}
                  </td>
                ) : null}
                <td className="whitespace-nowrap px-3 py-2">
                  {readOnlyDelivered || disabled ? (
                    <span className="tabular-nums">{delivered}</span>
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={inputMax > 0 ? inputMax : undefined}
                      step={1}
                      value={deliveredValue}
                      className="h-8 w-24 cursor-pointer"
                      disabled={isOnsite && inputMax <= 0}
                      onChange={(e) => updateQty(index, e.target.value)}
                      aria-label={`${isOnsite ? "Onsite" : "SCM"} delivered quantity for ${line.line_type || "line"}`}
                    />
                  )}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-2 tabular-nums",
                    remaining > 0 ? "font-medium text-amber-700" : "text-emerald-700",
                  )}
                >
                  {qty > 0 ? remaining : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                  {deliveryDate || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                  {line.customer_po_number || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
