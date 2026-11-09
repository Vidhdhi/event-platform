"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES, CITIES } from "@/lib/constants";
import type { Service } from "@/lib/types";

export default function ServiceForm({
  service,
  onClose,
  onSaved,
}: {
  service?: Service; // present = editing, missing = adding
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [category, setCategory] = useState<string>(
    service?.category ?? CATEGORIES[0]
  );
  const [title, setTitle] = useState(service?.title ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [negotiable, setNegotiable] = useState(service?.is_negotiable ?? false);
  const [city, setCity] = useState(service?.city ?? "");
  const [images, setImages] = useState((service?.image_urls ?? []).join("\n"));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const body = {
      category,
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      isNegotiable: negotiable,
      city: city.trim() || undefined,
      imageUrls: images
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    };

    try {
      if (service) {
        await api(`/services/${service.service_id}`, { method: "PUT", json: body });
        onSaved("Service updated.");
      } else {
        await api("/services", { method: "POST", json: body });
        onSaved("Service added. Planners can find it now.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the service");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#16132b]/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-form-title"
        className="card rise my-8 w-full max-w-lg"
        style={{ background: "#fff" }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 id="service-form-title" className="text-xl font-bold">
            {service ? "Edit service" : "Add a service"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Price (LKR)</label>
              <input
                type="number"
                min={0}
                required
                className="input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Title</label>
            <input
              required
              minLength={3}
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Wedding photography, full day"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              rows={4}
              maxLength={2000}
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is included? Planners are matched on these words, so be specific."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">City (optional)</label>
              <input
                list="service-cities"
                className="input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Defaults to your business city"
              />
              <datalist id="service-cities">
                {CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm font-semibold">
              <input
                type="checkbox"
                checked={negotiable}
                onChange={(e) => setNegotiable(e.target.checked)}
                className="h-4 w-4 accent-violet-600"
              />
              Price is negotiable
            </label>
          </div>

          <div>
            <label className="label">Image links (optional, one per line)</label>
            <textarea
              rows={2}
              className="input"
              value={images}
              onChange={(e) => setImages(e.target.value)}
              placeholder="https://..."
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
              {submitting ? "Saving..." : service ? "Save changes" : "Add service"}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}