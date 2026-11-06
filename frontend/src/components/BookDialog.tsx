"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatDate, money } from "@/lib/format";
import type { EventSummary, Service } from "@/lib/types";

interface Props {
  service: Service;
  eventId?: string; // fixed event (used on the event page)
  events?: EventSummary[]; // choices (used on the search page)
  onClose: () => void;
  onBooked?: () => void;
}

export default function BookDialog({
  service,
  eventId,
  events = [],
  onClose,
  onBooked,
}: Props) {
  const [selected, setSelected] = useState(eventId ?? events[0]?.event_id ?? "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Close with the Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      await api("/bookings", {
        method: "POST",
        json: {
          eventId: selected,
          serviceId: service.service_id,
          message: message.trim() || undefined,
        },
      });
      setDone(true);
      onBooked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request");
    } finally {
      setSubmitting(false);
    }
  }

  const needsEvent = !eventId && events.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#16132b]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-title"
        className="card rise w-full max-w-md"
        style={{ background: "#fff" }}
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center">
            <h2 id="book-title" className="text-xl font-bold">
              Request sent
            </h2>
            <p className="muted mt-2 text-sm">
              {service.business_name} will see your request and can accept or
              reject it. Pending requests appear on your event page.
            </p>
            <button onClick={onClose} className="btn mt-5">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <h2 id="book-title" className="text-xl font-bold">
                Request booking
              </h2>
              <p className="muted mt-1 text-sm">
                {service.title} by {service.business_name}, {money(service.price)}
              </p>
            </div>

            {needsEvent ? (
              <p className="error">
                You have no events yet.{" "}
                <Link href="/events/new" className="link">
                  Create an event
                </Link>{" "}
                first, then request this vendor.
              </p>
            ) : (
              !eventId && (
                <div>
                  <label className="label">For which event?</label>
                  <select
                    className="input"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {events.map((ev) => (
                      <option key={ev.event_id} value={ev.event_id}>
                        {ev.title} ({formatDate(ev.event_date)})
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}

            <div>
              <label className="label">Message to the vendor (optional)</label>
              <textarea
                className="input"
                rows={3}
                maxLength={1000}
                autoFocus
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell them about your event and what you need"
              />
            </div>

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || needsEvent}
                className="btn"
              >
                {submitting && <span className="spinner" />}
                {submitting ? "Sending..." : "Send request"}
              </button>
              <button type="button" onClick={onClose} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}