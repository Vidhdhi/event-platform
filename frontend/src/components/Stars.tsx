"use client";

// Read-only stars
export function Stars({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const rounded = Math.round(value);
  return (
    <span
      className={`inline-flex text-amber-500 ${className}`}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true">
          {n <= rounded ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}

// Clickable stars for writing a review
export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={`text-4xl leading-none transition-transform hover:scale-110 ${
            n <= value ? "text-amber-500" : "text-gray-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}