"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ unreadCount: number; items: NotificationItem[] }>(
        "/notifications"
      );
      setItems(res.items);
      setUnread(res.unreadCount);
    } catch {
      // not critical, try again at the next refresh
    }
  }, []);

  // Load now, then check again every 30 seconds while the tab is visible
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function openItem(n: NotificationItem) {
    setOpen(false);
    if (!n.is_read) {
      setItems((list) =>
        list.map((i) =>
          i.notification_id === n.notification_id ? { ...i, is_read: true } : i
        )
      );
      setUnread((c) => Math.max(0, c - 1));
      api(`/notifications/${n.notification_id}/read`, { method: "PATCH" }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  async function markAll() {
    setItems((list) => list.map((i) => ({ ...i, is_read: true })));
    setUnread(0);
    api("/notifications/read-all", { method: "POST" }).catch(() => {});
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-violet-100"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card rise absolute right-0 top-12 z-30 w-80 max-w-[calc(100vw-2rem)] !p-0"
          style={{ background: "#fff" }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="link text-xs">
                Mark all as read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="muted px-4 py-6 text-center text-sm">
              Nothing yet. Booking updates and reviews show up here.
            </p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {items.map((n) => (
                <li key={n.notification_id}>
                  <button
                    onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-violet-50 ${
                      n.is_read ? "" : "bg-violet-50/60"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        n.is_read ? "bg-transparent" : "bg-violet-600"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm">{n.message}</span>
                      <span className="muted text-xs">{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}