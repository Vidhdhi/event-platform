import { ReactNode } from "react";
import { CATEGORY_ICONS } from "@/lib/constants";
import { money } from "@/lib/format";
import type { Recommendation, Service } from "@/lib/types";

const PARTS = [
  { key: "budget", label: "Budget" },
  { key: "location", label: "Location" },
  { key: "rating", label: "Rating" },
  { key: "text", label: "Description" },
] as const;

function MatchBadge({ score }: { score: number }) {
  const tone =
    score >= 80 ? "bg-teal-500" : score >= 60 ? "bg-violet-600" : "bg-amber-500";
  return (
    <div className={`${tone} shrink-0 rounded-xl px-2.5 py-1.5 text-center text-white`}>
      <p className="text-lg font-bold leading-none">{Math.round(score)}%</p>
      <p className="text-[10px]">match</p>
    </div>
  );
}

export default function ServiceCard({
  service,
  rec,
  action,
}: {
  service: Service;
  rec?: Recommendation;
  action?: ReactNode;
}) {
  return (
    <article className="card flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-xl"
        >
          {CATEGORY_ICONS[service.category] ?? "✨"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{service.title}</h3>
          <p className="muted text-sm">
            {service.business_name}, {service.city}
          </p>
        </div>
        {rec && <MatchBadge score={rec.match_score} />}
      </div>

      {service.description && (
        <p className="muted line-clamp-2 text-sm">{service.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold">{money(service.price)}</span>
        {service.is_negotiable && (
          <span className="chip chip-birthday">Negotiable</span>
        )}
        <span className="muted">
          {service.review_count > 0
            ? `★ ${service.average_rating.toFixed(1)} (${service.review_count})`
            : "No reviews yet"}
        </span>
      </div>

      {rec && (
        <>
          <div className="flex flex-wrap gap-2">
            <span
              className={`chip ${
                rec.within_budget ? "chip-corporate" : "bg-red-100 text-red-700"
              }`}
            >
              {rec.within_budget ? "Within budget" : "Over budget"}
            </span>
            {rec.distance_km !== null && (
              <span className="chip chip-other normal-case">
                {rec.distance_km === 0
                  ? "Same city"
                  : `${Math.round(rec.distance_km)} km away`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {PARTS.map(({ key, label }) => (
              <div key={key}>
                <div className="flex justify-between text-xs">
                  <span className="muted">{label}</span>
                  <span className="font-semibold">
                    {Math.round(rec.breakdown[key] * 100)}%
                  </span>
                </div>
                <div className="progress" style={{ height: 6 }}>
                  <div
                    className="progress-bar"
                    style={{ width: `${rec.breakdown[key] * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <details className="text-sm">
            <summary className="link cursor-pointer">Why this vendor</summary>
            <ul className="muted mt-2 list-disc space-y-1 pl-5">
              {rec.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </details>
        </>
      )}

      {action && <div className="mt-auto pt-1">{action}</div>}
    </article>
  );
}