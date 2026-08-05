"use client";

import { useEffect } from "react";

import { runDeliveryReminderSweep } from "@/utils/delivery-status-reminders";

/** Checks delivery reminders once per procurement session (1 day before expected date). */
export function useDeliveryReminderSweep() {
  useEffect(() => {
    runDeliveryReminderSweep();
  }, []);
}
