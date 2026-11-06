"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { api } from "@/lib/api";
import { btnCls, btnGhostCls, cardCls, inputCls, labelCls } from "@/lib/ui";
import { CITIES } from "@/lib/constants";
function NewEventForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("wedding");
  const [eventDate, setEventDate] = useState("");
  const [city, setCity] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const created = await api<{ event_id: string }>("/events", {
        method: "POST",
        json: {
          title,
          eventType,
          eventDate: new Date(eventDate).toISOString(),
          city,
          guestCount: Number(guestCount || 0),
          totalBudget: Number(totalBudget),
        },
      });
      router.push(`/events/${created.event_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <div className={cardCls}>
        <h1 className="mb-4 text-2xl font-bold">New event</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Title</label>
            <input
              required
              minLength={2}
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Our wedding"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Event type</label>
              <select
                className={inputCls}
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="wedding">Wedding</option>
                <option value="birthday">Birthday</option>
                <option value="corporate">Corporate</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Date and time</label>
              <input
                type="datetime-local"
                required
                className={inputCls}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>City</label>
           <input
                list="cities"
                required
                minLength={2}
                className={inputCls}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Colombo"
              />
            </div>
                        <datalist id="cities">
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <div>
              <label className={labelCls}>Guests</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Total budget (LKR)</label>
            <input
              type="number"
              min={0}
              required
              className={inputCls}
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              placeholder="e.g. 1500000"
            />
          </div>

          {error && <p className="error">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className={btnCls}>
              {submitting ? "Saving..." : "Create event"}
            </button>
            <Link href="/dashboard" className={btnGhostCls}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function NewEventPage() {
  return (
    <Protected role="user">
      <NewEventForm />
    </Protected>
  );
}