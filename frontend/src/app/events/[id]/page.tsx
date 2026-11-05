"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import { api } from "@/lib/api";
import { formatDate, money } from "@/lib/format";
import { btnCls, btnGhostCls, cardCls, inputCls, labelCls } from "@/lib/ui";

interface EventItem {
  event_id: string;
  title: string;
  event_type: string;
  event_date: string;
  city: string;
  guest_count: number;
  total_budget: string;
}

interface BookingLine {
  booking_id: string;
  category: string;
  title: string;
  amount: string;
  status: string;
}

interface ManualItem {
  item_id: string;
  category: string;
  amount: string;
  note: string | null;
}

interface Budget {
  totalBudget: number;
  allocated: number;
  remainingBalance: number;
  pendingTotal: number;
  overBudget: boolean;
  confirmedBookings: BookingLine[];
  pendingBookings: BookingLine[];
  manualItems: ManualItem[];
}

function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState("");

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [e, b] = await Promise.all([
        api<EventItem>(`/events/${id}`),
        api<Budget>(`/events/${id}/budget`),
      ]);
      setEvent(e);
      setBudget(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addItem(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      await api(`/events/${id}/budget-items`, {
        method: "POST",
        json: { category, amount: Number(amount), note: note || undefined },
      });
      setCategory("");
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add expense");
    } finally {
      setAdding(false);
    }
  }

  async function removeItem(itemId: string) {
    try {
      await api(`/events/${id}/budget-items/${itemId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete expense");
    }
  }

  async function deleteEvent() {
    if (!confirm("Delete this event and all its bookings?")) return;
    try {
      await api(`/events/${id}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    }
  }

  if (error && !event) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard" className="text-indigo-600 underline">
          Back to dashboard
        </Link>
      </main>
    );
  }
  if (!event || !budget) {
    return <p className="p-8 text-gray-500">Loading event...</p>;
  }

  const pct =
    budget.totalBudget > 0
      ? Math.min(100, (budget.allocated / budget.totalBudget) * 100)
      : 0;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/dashboard" className="text-sm text-indigo-600 underline">
        ← Back to my events
      </Link>

      {/* Event summary */}
      <div className={cardCls}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <p className="mt-1 text-sm capitalize text-gray-600">
              {event.event_type} · {formatDate(event.event_date)} · {event.city} ·{" "}
              {event.guest_count} guests
            </p>
          </div>
          <button onClick={deleteEvent} className={btnGhostCls + " text-red-600"}>
            Delete
          </button>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Vendor recommendations will appear here on Day 10.
        </p>
      </div>

      {/* Budget summary */}
      <div className={cardCls}>
        <h2 className="mb-3 text-lg font-semibold">Budget</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="font-semibold">{money(budget.totalBudget)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Spent / confirmed</p>
            <p className="font-semibold">{money(budget.allocated)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Remaining</p>
            <p
              className={`font-semibold ${
                budget.overBudget ? "text-red-600" : "text-green-700"
              }`}
            >
              {money(budget.remainingBalance)}
            </p>
          </div>
        </div>

        <div className="mt-4 h-3 w-full overflow-hidden rounded bg-gray-200">
          <div
            className={`h-full ${budget.overBudget ? "bg-red-500" : "bg-indigo-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {budget.overBudget && (
          <p className="mt-2 text-sm text-red-600">You are over budget.</p>
        )}
        {budget.pendingTotal > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            Pending requests worth {money(budget.pendingTotal)} are not counted yet.
          </p>
        )}
      </div>

      {/* Confirmed bookings */}
      <div className={cardCls}>
        <h2 className="mb-3 text-lg font-semibold">Confirmed vendors</h2>
        {budget.confirmedBookings.length === 0 ? (
          <p className="text-sm text-gray-500">No confirmed bookings yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {budget.confirmedBookings.map((b) => (
              <li key={b.booking_id} className="flex justify-between py-2">
                <span>
                  {b.title} <span className="text-gray-500">({b.category})</span>
                </span>
                <span className="font-medium">{money(b.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Manual expenses */}
      <div className={cardCls}>
        <h2 className="mb-3 text-lg font-semibold">Other expenses</h2>

        {budget.manualItems.length === 0 ? (
          <p className="mb-4 text-sm text-gray-500">No other expenses added.</p>
        ) : (
          <ul className="mb-4 divide-y text-sm">
            {budget.manualItems.map((i) => (
              <li key={i.item_id} className="flex items-center justify-between py-2">
                <span>
                  {i.category}
                  {i.note && <span className="text-gray-500"> · {i.note}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium">{money(i.amount)}</span>
                  <button
                    onClick={() => removeItem(i.item_id)}
                    className="text-xs text-red-600 underline"
                  >
                    remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addItem} className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className={labelCls}>Category</label>
            <input
              required
              minLength={2}
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Transport"
            />
          </div>
          <div>
            <label className={labelCls}>Amount (LKR)</label>
            <input
              type="number"
              min={0}
              required
              className={inputCls}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Note</label>
            <input
              className={inputCls}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={adding} className={btnCls + " w-full"}>
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}

export default function EventDetailPage() {
  return (
    <Protected role="user">
      <EventDetail />
    </Protected>
  );
}