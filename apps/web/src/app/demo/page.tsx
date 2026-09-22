import type { Metadata } from "next";

import { DemoErpShell } from "@/components/demo/demo-erp-shell";

export const metadata: Metadata = {
  title: "Demo ERP — Connect Plus",
  description: "Sales demo workspace with sample enterprise data.",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoErpShell />;
}
