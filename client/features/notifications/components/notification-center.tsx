"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/components/auth-provider";
import ui from "@/components/ui/clinical.module.css";
import workspace from "@/components/ui/module-workspace.module.css";
import type { NotificationApi, NotificationPriority, NotificationType } from "../api-types";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../services/notification-api-service";
import {
  dateTime,
  notificationErrorMessage,
  notificationPriorityLabels,
  notificationTypeLabels,
  priorityTone,
} from "../services/notification-display";

const notificationTypes: Array<NotificationType | ""> = ["", "APPOINTMENT", "SURGERY", "PREOPERATIVE", "CARE", "BILLING", "SYSTEM"];
const priorities: Array<NotificationPriority | ""> = ["", "LOW", "NORMAL", "HIGH", "URGENT"];

function patientHref(role: string | undefined, patientId: number) {
  if (role === "NURSE") return `/nurse/patients/${patientId}`;
  if (role === "SECRETARY") return `/secretary/patients/${patientId}`;
  return `/patients/${patientId}`;
}

export function NotificationCenter({ onUnreadChange }: { onUnreadChange?: (count: number) => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationApi[]>([]);
  const [unread, setUnread] = useState(0);
  const [readFilter, setReadFilter] = useState<"" | "unread" | "read">("");
  const [typeFilter, setTypeFilter] = useState<NotificationType | "">("");
  const [priorityFilter, setPriorityFilter] = useState<NotificationPriority | "">("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [page, count] = await Promise.all([
        listNotifications({
          is_read: readFilter === "read" ? true : readFilter === "unread" ? false : "",
          notification_type: typeFilter,
          priority: priorityFilter,
        }),
        getUnreadNotificationCount(),
      ]);
      setItems(page.results);
      setUnread(count.unread_count);
      onUnreadChange?.(count.unread_count);
    } catch (cause) {
      setError(notificationErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange, priorityFilter, readFilter, typeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function toggleRead(notification: NotificationApi) {
    setBusy(true);
    setError("");
    try {
      await (notification.is_read ? markNotificationUnread(notification.id) : markNotificationRead(notification.id));
      await refresh();
    } catch (cause) {
      setError(notificationErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    setBusy(true);
    setError("");
    try {
      await markAllNotificationsRead();
      await refresh();
    } catch (cause) {
      setError(notificationErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={workspace.stack}>
      <div className={ui.actions}>
        <strong>{unread} non lue(s)</strong>
        <button className={ui.action} disabled={busy || unread === 0} onClick={() => void markAllRead()}>
          Tout marquer lu
        </button>
        <button className={ui.action} disabled={loading} onClick={() => void refresh()}>Actualiser</button>
      </div>
      <div className={workspace.filters}>
        <label>État
          <select value={readFilter} onChange={(event) => setReadFilter(event.target.value as typeof readFilter)}>
            <option value="">Toutes</option>
            <option value="unread">Non lues</option>
            <option value="read">Lues</option>
          </select>
        </label>
        <label>Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as NotificationType | "")}>
            {notificationTypes.map((value) => <option key={value || "all"} value={value}>{value ? notificationTypeLabels[value] : "Tous"}</option>)}
          </select>
        </label>
        <label>Priorité
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as NotificationPriority | "")}>
            {priorities.map((value) => <option key={value || "all"} value={value}>{value ? notificationPriorityLabels[value] : "Toutes"}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Chargement des notifications…</p> : (
        <ul className={workspace.list}>
          {items.map((notification) => (
            <li key={notification.id}>
              <div className={ui.actions}>
                <StatusBadge tone={priorityTone(notification.priority)}>{notificationPriorityLabels[notification.priority]}</StatusBadge>
                <StatusBadge tone={notification.is_read ? "neutral" : "teal"}>{notification.is_read ? "Lue" : "Non lue"}</StatusBadge>
                <small>{notificationTypeLabels[notification.notification_type]} · {dateTime(notification.created_at)}</small>
              </div>
              <strong>{notification.title}</strong>
              <small>{notification.message}</small>
              {notification.patient && (
                <Link className={workspace.link} href={patientHref(user?.role, notification.patient)}>
                  Dossier patient
                </Link>
              )}
              <div className={ui.actions}>
                <button className={ui.action} disabled={busy} onClick={() => void toggleRead(notification)}>
                  {notification.is_read ? "Marquer non lue" : "Marquer lue"}
                </button>
              </div>
            </li>
          ))}
          {!items.length && <li>Aucune notification réelle pour ces critères.</li>}
        </ul>
      )}
    </div>
  );
}
