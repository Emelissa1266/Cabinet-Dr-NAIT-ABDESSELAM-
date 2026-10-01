"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/shared/icon";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { getUnreadNotificationCount } from "../services/notification-api-service";
import { NotificationCenter } from "./notification-center";

export function NotificationBell({ label = "Notifications" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const response = await getUnreadNotificationCount();
      setCount(response.unread_count);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshCount();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshCount]);

  return (
    <>
      <button className="notification-button" aria-label={`${label} · ${count} non lue(s)`} onClick={() => setOpen(true)}>
        <Icon name="notifications" />
        {count > 0 && <span aria-hidden="true">{count > 99 ? "99+" : count}</span>}
      </button>
      <DetailDialog title={label} open={open} onClose={() => setOpen(false)}>
        <NotificationCenter onUnreadChange={setCount} />
      </DetailDialog>
    </>
  );
}
