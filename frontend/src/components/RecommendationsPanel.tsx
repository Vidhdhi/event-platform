"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { CATEGORIES } from "@/lib/constants";
import type { BookingSummary, Recommendation } from "@/lib/types";
import ServiceCard from "./ServiceCard";
import BookDialog from "./BookDialog";

interface RecsResponse {
  count: number;
  recommendations: Recommendation[];
  aiMs?: number;
  totalMs?: number;
}

export default function RecommendationsPanel({
  eventId,
  onBooked,
}: {
  eventId: string;
  onBooked?: () => void;
}) {
  const [category, setCategory] = useState("");
  const [preferences, setPreferences] = useState("");
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [timing, setTiming] = useState<{ ai?: number; total?: number }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [booking, setBooking] = useState<Recommendation | null>(null);
  const requestId = useRef(0);

  // Which services already have a booking request for this event
  const loadStatuses = useCallback(async () => {
    try {
      const list = await api<BookingSummary[]>(`/bookings?eventId=${eventId}`);
      setStatuses(Object.fromEntries(list.map((b) => [b.service_id, b.status])));
    } catch {
      // not critical, the buttons simply stay enabled
    }
  }, [eventId]);

  const fetchRecs = useCallback(
    async (cat: string, prefs: string) => {
      const id = ++requestId.current;
      setLoading(true);
      setError("");

      const params = new URLSearchParams({ limit: "8" });
      if (cat) params.set("category", cat);
      if (prefs.trim()) params.set("preferences", prefs.trim());

      try {
        const res = await api<RecsResponse>(
          `/events/${eventId}/recommendations?${params}`
        );
        if (id !== requestId.current) return; // a newer request replaced this one
        setRecs(res.recommendations);
        setTiming({ ai: res.aiMs, total: res.totalMs });
      } catch (err) {
        if (id !== requestId.current) return;
        setRecs(null);
        if (err instanceof ApiError && err.status === 503) {
          setError(
            "The recommendation service is not running. Start the AI service on port 8000 and try again."
          );
        } else {
          setError(
            err instanceof Error ? err.message : "Could not load recommendations"
          );
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    fetchRecs("", "");
    loadStatuses();
  }, [fetchRecs, loadStatuses]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    fetchRecs(category, preferences);
  }

  return (
    <section className="card">
      <h2 className="text-lg font-semibold">Recommended vendors</h2>
      <p className="muted mt-1 text-sm">
        Ranked by budget fit, distance, rating, and how well the description
        matches what you want.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto]"
      >
        <div>
          <label className="label">Category</label>
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">What are you looking for?</label>
          <input
            className="input"
            maxLength={500}
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="e.g. candid outdoor photos"
          />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="btn w-full">
            {loading && <span className="spinner" />}
            Update
          </button>
        </div>
      </form>

      {error && (
        <p className="error mt-4" role="alert">
          {error}
        </p>
      )}

      {loading && !recs && (
        <div className="mt-5 space-y-4">
          <div className="skeleton h-40" />
          <div className="skeleton h-40" />
        </div>
      )}

      {recs && recs.length === 0 && (
        <p className="muted mt-5 text-sm">
          No vendors matched. Try another category or a shorter description.
        </p>
      )}

      {recs && recs.length > 0 && (
        <>
          <p className="muted mt-5 text-xs">
            {recs.length} results ranked in {timing.ai ?? "?"} ms by the AI service
            ({timing.total ?? "?"} ms end to end)
          </p>
          <div
            className={`mt-3 space-y-4 transition-opacity ${
              loading ? "opacity-60" : ""
            }`}
          >
            {recs.map((r) => {
              const status = statuses[r.service_id];
              return (
                <ServiceCard
                  key={r.service_id}
                  service={r}
                  rec={r}
                  action={
                    status ? (
                      <span className="chip chip-wedding">
                        Request {status}
                      </span>
                    ) : (
                      <button className="btn" onClick={() => setBooking(r)}>
                        Request booking
                      </button>
                    )
                  }
                />
              );
            })}
          </div>
        </>
      )}

      {booking && (
        <BookDialog
          service={booking}
          eventId={eventId}
          onClose={() => setBooking(null)}
          onBooked={() => {
            loadStatuses();
            onBooked?.();
          }}
        />
      )}
    </section>
  );
}