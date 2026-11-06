"use client";

import { useEffect, useState } from "react";
import Protected from "@/components/Protected";
import ServiceCard from "@/components/ServiceCard";
import BookDialog from "@/components/BookDialog";
import { api } from "@/lib/api";
import {
  CATEGORIES,
  CATEGORY_ICONS,
  CITIES,
  RATING_OPTIONS,
  SORT_OPTIONS,
} from "@/lib/constants";
import type { EventSummary, Service } from "@/lib/types";

interface Filters {
  q: string;
  category: string;
  city: string;
  minPrice: string;
  maxPrice: string;
  minRating: string;
  sort: string;
}

const EMPTY: Filters = {
  q: "",
  category: "",
  city: "",
  minPrice: "",
  maxPrice: "",
  minRating: "",
  sort: "newest",
};

interface SearchResult {
  data: Service[];
  page: number;
  total: number;
  totalPages: number;
}

function BrowseContent() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [booking, setBooking] = useState<Service | null>(null);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  // Wait 350 ms after the last change before searching (fewer requests while typing)
  useEffect(() => {
    const t = setTimeout(() => {
      setApplied(filters);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [filters]);

  // Planner's events, for the booking dialog
  useEffect(() => {
    api<EventSummary[]>("/events")
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  // Search
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (applied.q.trim()) params.set("q", applied.q.trim());
    if (applied.category) params.set("category", applied.category);
    if (applied.city) params.set("city", applied.city);
    if (applied.minPrice) params.set("minPrice", applied.minPrice);
    if (applied.maxPrice) params.set("maxPrice", applied.maxPrice);
    if (applied.minRating) params.set("minRating", applied.minRating);
    params.set("sort", applied.sort);
    params.set("page", String(page));
    params.set("limit", "9");

    api<SearchResult>(`/services?${params}`)
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Search failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applied, page]);

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Find vendors</h1>
        <p className="muted mt-1">
          Search every vendor on the platform, or open an event to see the ones
          ranked for it.
        </p>
      </div>

      {/* Category chips */}
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Category">
        {[{ value: "", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))].map(
          (c) => {
            const active = filters.category === c.value;
            return (
              <button
                key={c.label}
                type="button"
                aria-pressed={active}
                onClick={() => update("category", c.value)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "border-violet-600 bg-violet-600 text-white"
                    : "border-[rgba(22,19,43,0.14)] bg-white/70 hover:bg-white"
                }`}
              >
                {c.value && <span aria-hidden="true">{CATEGORY_ICONS[c.value]} </span>}
                {c.label}
              </button>
            );
          }
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Filters */}
        <aside className="card h-fit space-y-4 lg:sticky lg:top-24">
          <div>
            <label className="label">Search</label>
            <input
              className="input"
              value={filters.q}
              onChange={(e) => update("q", e.target.value)}
              placeholder="Name or keyword"
            />
          </div>
          <div>
            <label className="label">City</label>
            <select
              className="input"
              value={filters.city}
              onChange={(e) => update("city", e.target.value)}
            >
              <option value="">Any city</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Price (LKR)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                className="input"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => update("minPrice", e.target.value)}
              />
              <input
                type="number"
                min={0}
                className="input"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => update("maxPrice", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Rating</label>
            <select
              className="input"
              value={filters.minRating}
              onChange={(e) => update("minRating", e.target.value)}
            >
              {RATING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Sort by</label>
            <select
              className="input"
              value={filters.sort}
              onChange={(e) => update("sort", e.target.value)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => setFilters(EMPTY)}
            >
              Clear filters
            </button>
          )}
        </aside>

        {/* Results */}
        <section>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {!result && loading && (
            <div className="grid gap-5 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-44" />
              ))}
            </div>
          )}

          {result && (
            <>
              <p className="muted mb-3 text-sm" aria-live="polite">
                {result.total} {result.total === 1 ? "vendor service" : "vendor services"}
              </p>

              {result.data.length === 0 ? (
                <div className="card text-center">
                  <h2 className="text-lg font-semibold">No services match</h2>
                  <p className="muted mt-1 text-sm">
                    Try a wider price range or remove a filter.
                  </p>
                  <button
                    className="btn mt-4"
                    onClick={() => setFilters(EMPTY)}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div
                  className={`grid gap-5 transition-opacity md:grid-cols-2 ${
                    loading ? "opacity-60" : ""
                  }`}
                >
                  {result.data.map((s) => (
                    <ServiceCard
                      key={s.service_id}
                      service={s}
                      action={
                        <button className="btn" onClick={() => setBooking(s)}>
                          Request booking
                        </button>
                      }
                    />
                  ))}
                </div>
              )}

              {result.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-4">
                  <button
                    className="btn btn-ghost"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span className="muted text-sm">
                    Page {result.page} of {result.totalPages}
                  </span>
                  <button
                    className="btn btn-ghost"
                    disabled={page >= result.totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {booking && (
        <BookDialog
          service={booking}
          events={events}
          onClose={() => setBooking(null)}
        />
      )}
    </main>
  );
}

export default function BrowsePage() {
  return (
    <Protected role="user">
      <BrowseContent />
    </Protected>
  );
}