"use client";

import { useEffect, useState } from "react";
import { IconAlert } from "@/components/icons";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white">
      <IconAlert size={16} />
      Offline — leave and punch need a connection.
    </div>
  );
}
