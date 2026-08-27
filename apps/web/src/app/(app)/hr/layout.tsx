import type { ReactNode } from "react";

export default function HrLayout({ children }: { children: ReactNode }) {
  return <div className="w-full">{children}</div>;
}
