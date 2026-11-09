"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import Modal from "./Modal";
import { StarInput } from "./Stars";

export default function ReviewDialog({
  serviceId,
  serviceTitle,
  businessName,
  existing,
  onClose,
  onSaved,
}: {
  serviceId: string;
  serviceTitle: string;
  businessName: string;
  existing?: { rating: number; comment: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api("/reviews", {
        method: "POST",
        json: { serviceId, rating, comment: comment.trim() || undefined },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your review");
      setSubmitting(false);
    }
  }

  return (
    <Modal titleId="review-title" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <h2 id="review-title" className="text-xl font-bold">
            {existing ? "Edit your review" : "Review this vendor"}
          </h2>
          <p className="muted mt-1 text-sm">
            {serviceTitle} by {businessName}
          </p>
        </div>

        <StarInput value={rating} onChange={setRating} />

        <div>
          <label className="label">Comment (optional)</label>
          <textarea
            className="input"
            rows={4}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What went well? What could be better?"
          />
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn">
            {submitting && <span className="spinner" />}
            {submitting ? "Saving..." : existing ? "Save changes" : "Post review"}
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}