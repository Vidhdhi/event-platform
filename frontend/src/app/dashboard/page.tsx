"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Protected from "@/components/Protected";
import { api } from "@/lib/api";
import { formatDate, money } from "@/lib/format";
import { btnCls, cardCls } from "@/lib/ui";

interface EventItem {
  event_id: string;
  title: string;
  event_type: string;
  event_date: string;
  city: string;
  guest_count: number;
  total_budget: string; // Postgres DECIMAL arrives as a string
}

function DashboardContent() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<EventItem[]>("/events")
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My events</h1>
        <Link href="/events/new" className={btnCls}>
          + New event
        </Link>
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {!events && !error && <p className="text-gray-500">Loading events...</p>}

      {events && events.length === 0 && (
        <div className={cardCls + " text-center text-gray-600"}>
          You have no events yet. Create your first one to start planning.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {events?.map((e) => (
          <Link
            key={e.event_id}
            href={`/events/${e.event_id}`}
            className={cardCls + " block hover:border-indigo-400"}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">{e.title}</h2>
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs capitalize text-indigo-700">
                {e.event_type}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              {formatDate(e.event_date)} · {e.city} · {e.guest_count} guests
            </p>
            <p className="mt-2 text-sm font-medium">Budget: {money(e.total_budget)}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Protected role="user">
      <DashboardContent />
    </Protected>
  );
}