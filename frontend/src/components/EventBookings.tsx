"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { BookingDetail } from "@/lib/types";
import StatusChip from "./StatusChip";

export default function EventBookings({
  eventId,
  refreshKey,
  onChanged,
}: {
  eventId: string;
  refreshKey: number; // change this number to reload the list
  onChanged: () => void;
}) {
  const [items, setItems] = useState<BookingDetail[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api<BookingDetail[]>(`/bookings?eventId=${eventId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function cancel(b: BookingDetail) {
    if (!confirm(`Cancel your request to ${b.business_name}?`)) return;
    setBusyId(b.booking_id);
    setError("");
    try {
      await api(`/bookings/${b.booking_id}/status`, {
        method: "PATCH",
        json: { status: "cancelled" },
      });
      await load();
      onChanged(); // refresh the budget
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the request");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-semibold">Booking requests</h2>

      {error && (
        <p className="error mb-3" role="alert">
          {error}
        </p>
      )}

      {!items && !error && <div className="skeleton h-16" />}

      {items && items.length === 0 && (
        <p className="muted text-sm">
          No requests yet. Pick a vendor from the recommendations above.
        </p>
      )}

      <ul className="divide-y">
        {items?.map((b) => (
          <li key={b.booking_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{b.service_title}</p>
              <p className="muted text-sm">
                {b.business_name}, {b.agreed_price !== null ? `agreed ${money(b.agreed_price)}` : money(b.price)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusChip status={b.status} />
              {(b.status === "pending" || b.status === "accepted") && (
                <button
                  className="text-sm font-semibold text-red-600 underline"
                  disabled={busyId === b.booking_id}
                  onClick={() => cancel(b)}
                >
                  {busyId === b.booking_id ? "Cancelling..." : "Cancel"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}