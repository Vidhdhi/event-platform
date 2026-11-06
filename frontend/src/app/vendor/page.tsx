"use client";

import { useCallback, useEffect, useState } from "react";
import Protected from "@/components/Protected";
import StatusChip from "@/components/StatusChip";
import ServiceCard from "@/components/ServiceCard";
import ServiceForm from "@/components/ServiceForm";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { daysUntil, dueLabel, formatDate, money } from "@/lib/format";
import { typeChip } from "@/lib/ui";
import type { BookingDetail, Service } from "@/lib/types";

type Tab = "requests" | "services";
type Filter = "pending" | "accepted" | "completed" | "closed" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Declined or cancelled" },
  { value: "all", label: "All" },
];

function matches(b: BookingDetail, f: Filter) {
  if (f === "all") return true;
  if (f === "closed") return b.status === "rejected" || b.status === "cancelled";
  return b.status === f;
}

function VendorContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("requests");
  const [filter, setFilter] = useState<Filter>("pending");
  const [bookings, setBookings] = useState<BookingDetail[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [form, setForm] = useState<Service | "new" | null>(null);
  const [loadError, setLoadError] = useState("");

  const loadBookings = useCallback(async () => {
    try {
      setBookings(await api<BookingDetail[]>("/bookings"));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load requests");
    }
  }, []);

  const loadServices = useCallback(async () => {
    try {
      setServices(await api<Service[]>("/services/mine"));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load services");
    }
  }, []);

  useEffect(() => {
    loadBookings();
    loadServices();
  }, [loadBookings, loadServices]);

  // Hide the notice after 6 seconds
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  async function changeStatus(
    b: BookingDetail,
    status: "accepted" | "rejected" | "completed"
  ) {
    let json: Record<string, unknown> = { status };

    if (status === "accepted") {
      const agreed = Number(prices[b.booking_id] ?? b.price);
      if (Number.isNaN(agreed) || agreed < 0) {
        setNotice({ kind: "error", text: "Enter a valid agreed price." });
        return;
      }
      json = { status, agreedPrice: agreed };
    }

    setBusyId(b.booking_id);
    try {
      const res = await api<{ eventOverBudget?: boolean }>(
        `/bookings/${b.booking_id}/status`,
        { method: "PATCH", json }
      );
      const text =
        status === "accepted"
          ? res.eventOverBudget
            ? "Request accepted. This puts the planner's event over its budget."
            : "Request accepted."
          : status === "rejected"
            ? "Request declined."
            : "Marked as completed.";
      setNotice({ kind: "ok", text });
      await loadBookings();
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Could not update the request",
      });
    } finally {
      setBusyId("");
    }
  }

  async function deleteService(s: Service) {
    if (!confirm(`Delete "${s.title}"?`)) return;
    try {
      await api(`/services/${s.service_id}`, { method: "DELETE" });
      setNotice({ kind: "ok", text: "Service deleted." });
      await loadServices();
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "Could not delete the service",
      });
    }
  }

  const list = bookings ?? [];
  const pending = list.filter((b) => b.status === "pending").length;
  const accepted = list.filter((b) => b.status === "accepted").length;
  const completed = list.filter((b) => b.status === "completed").length;
  const confirmedValue = list
    .filter((b) => b.status === "accepted" || b.status === "completed")
    .reduce((sum, b) => sum + (b.agreed_price ?? b.price), 0);

  const visible = list.filter((b) => matches(b, filter));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hi {user?.name.split(" ")[0]}</h1>
          <p className="muted mt-1">
            {bookings
              ? pending > 0
                ? `${pending} ${pending === 1 ? "request is" : "requests are"} waiting for your answer.`
                : "No requests are waiting for you."
              : "Loading your requests..."}
          </p>
        </div>
        <button className="btn" onClick={() => setForm("new")}>
          Add service
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="stat">
          <p className="stat-label">Pending requests</p>
          <p className="stat-value">{pending}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Accepted</p>
          <p className="stat-value">{accepted}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Completed</p>
          <p className="stat-value">{completed}</p>
        </div>
        <div className="stat stat-good">
          <p className="stat-label">Confirmed value</p>
          <p className="stat-value">{money(confirmedValue)}</p>
        </div>
      </div>

      {notice && (
        <p
          className={`mb-4 ${notice.kind === "ok" ? "rounded-[10px] bg-teal-50 px-3 py-2 text-sm text-teal-800" : "error"}`}
          role={notice.kind === "ok" ? "status" : "alert"}
        >
          {notice.text}
        </p>
      )}
      {loadError && (
        <p className="error mb-4" role="alert">
          {loadError}
        </p>
      )}

      {/* Tabs */}
      <div className="seg mb-6 max-w-sm">
        <button
          type="button"
          className="seg-btn"
          aria-pressed={tab === "requests"}
          onClick={() => setTab("requests")}
        >
          Requests {pending > 0 && `(${pending})`}
        </button>
        <button
          type="button"
          className="seg-btn"
          aria-pressed={tab === "services"}
          onClick={() => setTab("services")}
        >
          My services {services ? `(${services.length})` : ""}
        </button>
      </div>

      {/* ---------- Requests ---------- */}
      {tab === "requests" && (
        <section>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter requests">
            {FILTERS.map((f) => {
              const count = list.filter((b) => matches(b, f.value)).length;
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-[rgba(22,19,43,0.14)] bg-white/70 hover:bg-white"
                  }`}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>

          {!bookings && !loadError && (
            <div className="space-y-4">
              <div className="skeleton h-44" />
              <div className="skeleton h-44" />
            </div>
          )}

          {bookings && visible.length === 0 && (
            <div className="card text-center">
              <h2 className="text-lg font-semibold">
                {list.length === 0 ? "No requests yet" : "Nothing in this list"}
              </h2>
              <p className="muted mt-1 text-sm">
                {list.length === 0
                  ? "When a planner requests one of your services, it appears here."
                  : "Pick another filter to see the rest."}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {visible.map((b) => {
              const busy = busyId === b.booking_id;
              return (
                <article key={b.booking_id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{b.event_title}</h3>
                        <span className={typeChip(b.event_type)}>{b.event_type}</span>
                      </div>
                      <p className="muted text-sm">
                        {formatDate(b.event_date)} ({dueLabel(daysUntil(b.event_date))}),{" "}
                        {b.event_city}, {b.guest_count} guests
                      </p>
                      <p className="muted text-sm">Requested by {b.planner_name}</p>
                    </div>
                    <StatusChip status={b.status} />
                  </div>

                  <div className="mt-3 rounded-xl border bg-white/70 p-3 text-sm">
                    <p className="font-semibold">{b.service_title}</p>
                    <p className="muted">
                      Listed price {money(b.price)}
                      {b.agreed_price !== null && `, agreed ${money(b.agreed_price)}`}
                    </p>
                  </div>

                  {b.message && (
                    <blockquote className="muted mt-3 border-l-4 border-violet-200 pl-3 text-sm">
                      {b.message}
                    </blockquote>
                  )}

                  {b.status === "pending" && (
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="label" htmlFor={`price-${b.booking_id}`}>
                          Agreed price (LKR)
                        </label>
                        <input
                          id={`price-${b.booking_id}`}
                          type="number"
                          min={0}
                          className="input w-44"
                          value={prices[b.booking_id] ?? String(b.price)}
                          onChange={(e) =>
                            setPrices((p) => ({ ...p, [b.booking_id]: e.target.value }))
                          }
                        />
                      </div>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => changeStatus(b, "accepted")}
                      >
                        {busy && <span className="spinner" />}
                        Accept
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => changeStatus(b, "rejected")}
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {b.status === "accepted" && (
                    <div className="mt-4">
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => changeStatus(b, "completed")}
                      >
                        {busy && <span className="spinner" />}
                        Mark as completed
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- Services ---------- */}
      {tab === "services" && (
        <section>
          {!services && !loadError && (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="skeleton h-40" />
              <div className="skeleton h-40" />
            </div>
          )}

          {services && services.length === 0 && (
            <div className="card mx-auto max-w-lg text-center">
              <h2 className="text-xl font-semibold">List your first service</h2>
              <p className="muted mt-2">
                Add a price, a city, and a description. Planners are matched to
                your service on exactly these details.
              </p>
              <button className="btn mt-5" onClick={() => setForm("new")}>
                Add a service
              </button>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {services?.map((s) => (
              <ServiceCard
                key={s.service_id}
                service={s}
                action={
                  <div className="flex gap-3">
                    <button className="btn btn-ghost" onClick={() => setForm(s)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost text-red-600"
                      onClick={() => deleteService(s)}
                    >
                      Delete
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}

      {form && (
        <ServiceForm
          service={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
          onSaved={(text) => {
            setForm(null);
            setNotice({ kind: "ok", text });
            loadServices();
          }}
        />
      )}
    </main>
  );
}

export default function VendorPage() {
  return (
    <Protected role="vendor">
      <VendorContent />
    </Protected>
  );
}