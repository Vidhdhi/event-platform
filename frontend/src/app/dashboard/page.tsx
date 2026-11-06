"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Protected from "@/components/Protected";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { daysUntil, dueLabel, formatDate, money } from "@/lib/format";
import { typeChip } from "@/lib/ui";

interface EventItem {
  event_id: string;
  title: string;
  event_type: string;
  event_date: string;
  city: string;
  guest_count: number;
  total_budget: string;
}

function DashboardContent() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<EventItem[]>("/events")
      .then(setEvents)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load events")
      );
  }, []);

  const upcoming = events?.filter((e) => daysUntil(e.event_date) >= 0).length ?? 0;
  const firstName = user?.name.split(" ")[0];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hi {firstName}</h1>
          <p className="muted mt-1">
            {events
              ? upcoming === 0
                ? "No upcoming events yet."
                : `You have ${upcoming} upcoming ${upcoming === 1 ? "event" : "events"}.`
              : "Loading your events..."}
          </p>
        </div>
        <Link href="/events/new" className="btn">
          New event
        </Link>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!events && !error && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-36" />
          ))}
        </div>
      )}

      {events && events.length === 0 && (
        <div className="card mx-auto max-w-lg text-center">
          <h2 className="text-xl font-semibold">Start with your first event</h2>
          <p className="muted mt-2">
            Add the date, city and budget, and we will recommend vendors that
            fit.
          </p>
          <Link href="/events/new" className="btn mt-5">
            Create an event
          </Link>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {events?.map((e) => {
          const days = daysUntil(e.event_date);
          return (
            <Link
              key={e.event_id}
              href={`/events/${e.event_id}`}
              className="card card-link"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold leading-snug">{e.title}</h2>
                <span className={typeChip(e.event_type)}>{e.event_type}</span>
              </div>
              <p className="muted mt-2 text-sm">
                {formatDate(e.event_date)}, {e.city}
              </p>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="muted text-xs">Budget</p>
                  <p className="font-bold">{money(e.total_budget)}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    days < 0 ? "muted" : "text-violet-700"
                  }`}
                >
                  {dueLabel(days)}
                </span>
              </div>
            </Link>
          );
        })}
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