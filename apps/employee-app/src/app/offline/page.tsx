import Link from "next/link";
import { IconAlert, IconBrand } from "@/components/icons";
import * as ui from "@/theme/classes";

export default function OfflinePage() {
  return (
    <main className={`${ui.shellPlain} mx-auto flex max-w-lg flex-col items-center justify-center px-6 text-center`}>
      <div className={`${ui.card} w-full max-w-sm space-y-4 p-6`}>
        <div className="flex justify-center">
          <IconBrand size={56} />
        </div>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
          <IconAlert size={24} />
        </span>
        <h1 className="text-2xl font-bold text-[#004ac6]">You&apos;re offline</h1>
        <p className={`text-sm leading-relaxed ${ui.muted}`}>
          The app shell is cached. Reconnect to sync leave, attendance, and
          payslips.
        </p>
        <Link href="/home" className={`${ui.btn} w-full`}>
          Try again
        </Link>
      </div>
    </main>
  );
}
