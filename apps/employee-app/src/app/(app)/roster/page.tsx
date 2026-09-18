"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/ui";
import { IconCalendar } from "@/components/icons";
import { essService } from "@/services/ess-service";
import type { EssMe } from "@/types/api";
import * as ui from "@/theme/classes";

export default function RosterPage() {
  const [me, setMe] = useState<EssMe | null>(null);

  useEffect(() => {
    essService
      .me()
      .then((res) => setMe(res.data))
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-5">
      <AppHeader title="Roster" name={me?.display_name} />
      <section className={`${ui.card} space-y-3 p-5`}>
        <EmptyState
          title="Roster coming soon"
          description="Your shift roster will appear here once HR publishes it to ESS. Until then, use Attendance for daily check-in."
          icon={<IconCalendar size={20} />}
        />
        <Link
          href="/attendance"
          className="block text-center text-sm font-semibold text-[#004ac6]"
        >
          Go to Attendance
        </Link>
      </section>
    </div>
  );
}
