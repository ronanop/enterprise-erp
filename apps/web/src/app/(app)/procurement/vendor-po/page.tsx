import { redirect } from "next/navigation";

/** Vendors & PO merged into Purchase Orders — keep URL for old bookmarks. */
export default function ProcurementVendorPoPage() {
  redirect("/procurement/orders");
}
