"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Review } from "@/lib/types";
import Modal from "./Modal";
import { Stars } from "./Stars";

function ReviewsDialog({
  serviceId,
  title,
  average,
  count,
  onClose,
}: {
  serviceId: string;
  title: string;
  average: number;
  count: number;
  onClose: () => void;
}) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Review[]>(`/reviews/service/${serviceId}`)
      .then(setReviews)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load reviews")
      );
  }, [serviceId]);

  return (
    <Modal titleId="reviews-title" onClose={onClose} className="max-w-lg">
      <h2 id="reviews-title" className="text-xl font-bold">
        {title}
      </h2>
      <p className="mt-1 flex items-center gap-2 text-sm">
        <Stars value={average} />
        <span className="font-semibold">{average.toFixed(1)}</span>
        <span className="muted">
          from {count} {count === 1 ? "review" : "reviews"}
        </span>
      </p>

      {error && (
        <p className="error mt-4" role="alert">
          {error}
        </p>
      )}
      {!reviews && !error && <div className="skeleton mt-4 h-24" />}

      <ul className="mt-4 max-h-[50vh] divide-y overflow-y-auto">
        {reviews?.map((r) => (
          <li key={r.review_id} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{r.reviewer_name}</span>
              <span className="muted text-xs">{formatDate(r.created_at)}</span>
            </div>
            <Stars value={r.rating} className="text-sm" />
            {r.comment && <p className="muted mt-1 text-sm">{r.comment}</p>}
          </li>
        ))}
      </ul>

      <button onClick={onClose} className="btn btn-ghost mt-4">
        Close
      </button>
    </Modal>
  );
}

export default function ReviewsButton({
  serviceId,
  title,
  average,
  count,
}: {
  serviceId: string;
  title: string;
  average: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);

  if (count === 0) return <span className="muted">No reviews yet</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-semibold hover:text-violet-700"
        aria-label={`Rated ${average.toFixed(1)} from ${count} reviews. Read the reviews`}
      >
        <Stars value={average} />
        <span>{average.toFixed(1)}</span>
        <span className="muted underline">({count})</span>
      </button>
      {open && (
        <ReviewsDialog
          serviceId={serviceId}
          title={title}
          average={average}
          count={count}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}