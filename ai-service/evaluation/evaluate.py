"""Evaluates the recommender on the synthetic benchmark.

Run from the ai-service folder:  python -m evaluation.evaluate
Writes evaluation/results/summary.md and evaluation/results/results.json
"""
import itertools
import json
import math
import random
import statistics
import time
from pathlib import Path

from recommender import WEIGHTS, recommend
from schemas import EventInput, ServiceInput

HERE = Path(__file__).parent
BENCHMARK = HERE / "benchmark.json"
RESULTS = HERE / "results"
KEYS = ("budget", "location", "rating", "text")

SYSTEMS = {
    "Budget only": (1, 0, 0, 0),
    "Location only": (0, 1, 0, 0),
    "Rating only (smoothed)": (0, 0, 1, 0),
    "Text only": (0, 0, 0, 1),
    "Rule-based v1": (0.40, 0.30, 0.30, 0.0),
}
SHIPPED = "Hybrid v2 (shipped)"


# ---------- Metrics ----------
def precision_at_k(order, labels, k):
    return sum(1 for sid in order[:k] if labels[sid] >= 1) / k


def ndcg_at_k(order, labels, k):
    def dcg(ids):
        return sum((2 ** labels[sid] - 1) / math.log2(i + 2) for i, sid in enumerate(ids[:k]))

    ideal = sorted(labels, key=lambda sid: labels[sid], reverse=True)
    best = dcg(ideal)
    return dcg(order) / best if best > 0 else 0.0


def top1_is_best(order, labels):
    return 1.0 if order and labels[order[0]] == 2 else 0.0


def score_order(order, labels):
    return {
        "P@3": precision_at_k(order, labels, 3),
        "P@5": precision_at_k(order, labels, 5),
        "nDCG@5": ndcg_at_k(order, labels, 5),
        "Top-1": top1_is_best(order, labels),
    }


def mean_over(per_scenario, metric):
    return statistics.fmean(m[metric] for m in per_scenario)


def bootstrap_ci(values, n=2000, seed=1):
    rng = random.Random(seed)
    m = len(values)
    means = sorted(statistics.fmean(rng.choices(values, k=m)) for _ in range(n))
    return means[int(0.025 * n)], means[int(0.975 * n) - 1]


# ---------- Data ----------
def load():
    data = json.loads(BENCHMARK.read_text())
    services = {
        s["service_id"]: ServiceInput(
            **{k: v for k, v in s.items() if not k.startswith("_")}
        )
        for s in data["services"]
    }
    return services, data["scenarios"]


def event_for(sc):
    return EventInput(
        event_type=sc["event_type"],
        city=sc["city"],
        total_budget=sc["total_budget"],
        category=sc["category"],
        preferences=sc["preferences"],
    )


def rank_by_weights(components, weights):
    """components: {service_id: breakdown}. Returns ids, best first."""
    def total(sid):
        bd = components[sid]
        return sum(w * getattr(bd, k) for w, k in zip(weights, KEYS))

    return sorted(components, key=lambda sid: (-total(sid), sid))


# ---------- Main experiments ----------
def main():
    RESULTS.mkdir(exist_ok=True)
    services, scenarios = load()
    rng = random.Random(7)

    per = {name: [] for name in [*SYSTEMS, SHIPPED, "Random", "Cheapest first", "Top rated (raw average)"]}
    components_by_scenario = []
    base_weights = tuple(WEIGHTS[k] for k in KEYS)
    top5_agree = 0

    for sc in scenarios:
        labels = {sid: g for sid, g in sc["labels"].items()}
        cands = [services[sid] for sid in labels]
        event = event_for(sc)

        # The real recommender, exactly as the API runs it
        recs = recommend(event, cands, top_n=len(cands))
        shipped_order = [r.service_id for r in recs]
        components = {r.service_id: r.breakdown for r in recs}
        components_by_scenario.append((components, labels))
        if shipped_order[:5] == rank_by_weights(components, base_weights)[:5]:
            top5_agree += 1

        per[SHIPPED].append(score_order(shipped_order, labels))
        for name, w in SYSTEMS.items():
            per[name].append(score_order(rank_by_weights(components, w), labels))

        # Baselines that need no scoring model
        ids = list(labels)
        random_runs = []
        for _ in range(200):
            rng.shuffle(ids)
            random_runs.append(score_order(list(ids), labels))
        per["Random"].append({m: statistics.fmean(r[m] for r in random_runs) for m in random_runs[0]})

        per["Cheapest first"].append(
            score_order(sorted(labels, key=lambda sid: (services[sid].price, sid)), labels)
        )
        per["Top rated (raw average)"].append(
            score_order(
                sorted(labels, key=lambda sid: (-services[sid].average_rating, -services[sid].review_count, sid)),
                labels,
            )
        )

    metrics = ["P@3", "P@5", "nDCG@5", "Top-1"]
    order_of_rows = ["Random", "Cheapest first", "Top rated (raw average)", *SYSTEMS, SHIPPED]

    # ---- Table 1: all systems
    lines = ["## Table 1. Ranking quality on 40 scenarios (mean over scenarios)", ""]
    lines.append("| System | P@3 | P@5 | nDCG@5 | Top-1 correct | nDCG@5 95% CI |")
    lines.append("|---|---|---|---|---|---|")
    summary = {}
    for name in order_of_rows:
        vals = [m["nDCG@5"] for m in per[name]]
        lo, hi = bootstrap_ci(vals)
        row = {m: mean_over(per[name], m) for m in metrics}
        summary[name] = row | {"ci": [lo, hi]}
        lines.append(
            f"| {name} | {row['P@3']:.3f} | {row['P@5']:.3f} | {row['nDCG@5']:.3f} | "
            f"{row['Top-1']:.3f} | {lo:.3f} to {hi:.3f} |"
        )

    # ---- Table 2: paired differences versus the shipped hybrid
    lines += ["", "## Table 2. Hybrid v2 compared with each other system (nDCG@5, paired bootstrap)", ""]
    lines.append("| Compared with | Mean difference | 95% CI | Clear difference? |")
    lines.append("|---|---|---|---|")
    paired = {}
    for name in order_of_rows:
        if name == SHIPPED:
            continue
        diffs = [a["nDCG@5"] - b["nDCG@5"] for a, b in zip(per[SHIPPED], per[name])]
        lo, hi = bootstrap_ci(diffs)
        clear = "yes" if lo > 0 or hi < 0 else "no"
        paired[name] = {"mean": statistics.fmean(diffs), "ci": [lo, hi]}
        lines.append(f"| {name} | {statistics.fmean(diffs):+.3f} | {lo:+.3f} to {hi:+.3f} | {clear} |")

    # ---- Table 3: with and without a typed preference
    lines += ["", "## Table 3. Effect of the planner typing a preference (nDCG@5)", ""]
    lines.append("| Scenarios | Count | Rule-based v1 | Hybrid v2 |")
    lines.append("|---|---|---|---|")
    split = {}
    for label, flag in (("Preference typed", True), ("No preference", False)):
        idx = [i for i, sc in enumerate(scenarios) if bool(sc["preferences"]) == flag]
        v1 = statistics.fmean(per["Rule-based v1"][i]["nDCG@5"] for i in idx)
        v2 = statistics.fmean(per[SHIPPED][i]["nDCG@5"] for i in idx)
        split[label] = {"count": len(idx), "v1": v1, "v2": v2}
        lines.append(f"| {label} | {len(idx)} | {v1:.3f} | {v2:.3f} |")

    # ---- Table 4: ablation (remove one component, rescale the rest)
    base = [WEIGHTS[k] for k in KEYS]
    lines += ["", "## Table 4. Ablation: remove one component from Hybrid v2 (nDCG@5)", ""]
    lines.append("| Variant | nDCG@5 | Change from full |")
    lines.append("|---|---|---|")
    full = statistics.fmean(
        ndcg_at_k(rank_by_weights(c, base), lab, 5) for c, lab in components_by_scenario
    )
    lines.append(f"| Full Hybrid v2 | {full:.3f} | |")
    ablation = {}
    for i, key in enumerate(KEYS):
        w = list(base)
        w[i] = 0.0
        total = sum(w)
        w = [x / total for x in w]
        score = statistics.fmean(
            ndcg_at_k(rank_by_weights(c, w), lab, 5) for c, lab in components_by_scenario
        )
        ablation[key] = score
        lines.append(f"| Without {key} | {score:.3f} | {score - full:+.3f} |")

    # ---- Table 5: one-at-a-time weight sensitivity
    lines += ["", "## Table 5. Weight sensitivity: vary one weight, rescale the others (nDCG@5)", ""]
    levels = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
    lines.append("| Weight set to | " + " | ".join(f"{x:.1f}" for x in levels) + " |")
    lines.append("|---|" + "---|" * len(levels))
    sensitivity = {}
    for i, key in enumerate(KEYS):
        row = []
        others = [base[j] for j in range(4) if j != i]
        others_total = sum(others)
        for level in levels:
            w = []
            for j in range(4):
                w.append(level if j == i else base[j] / others_total * (1 - level))
            row.append(statistics.fmean(
                ndcg_at_k(rank_by_weights(c, w), lab, 5) for c, lab in components_by_scenario
            ))
        sensitivity[key] = row
        lines.append(f"| {key} | " + " | ".join(f"{x:.3f}" for x in row) + " |")

    # ---- Table 6: tune on half the scenarios, test on the other half
    train = components_by_scenario[::2]
    test = components_by_scenario[1::2]
    steps = [i / 10 for i in range(11)]
    grid = [w for w in itertools.product(steps, repeat=4) if abs(sum(w) - 1) < 1e-9]

    def mean_ndcg(weights, subset):
        return statistics.fmean(ndcg_at_k(rank_by_weights(c, weights), lab, 5) for c, lab in subset)

    best = max(grid, key=lambda w: mean_ndcg(w, train))
    lines += ["", "## Table 6. Weights tuned on 20 scenarios, checked on the other 20 (nDCG@5)", ""]
    lines.append("| Weights (budget, location, rating, text) | Tuning half | Unseen half |")
    lines.append("|---|---|---|")
    lines.append(f"| Shipped {tuple(base)} | {mean_ndcg(base, train):.3f} | {mean_ndcg(base, test):.3f} |")
    lines.append(f"| Best on tuning half {best} | {mean_ndcg(best, train):.3f} | {mean_ndcg(best, test):.3f} |")
    tuned = {
        "best_weights": list(best),
        "shipped_train": mean_ndcg(base, train),
        "shipped_test": mean_ndcg(base, test),
        "best_train": mean_ndcg(best, train),
        "best_test": mean_ndcg(best, test),
        "grid_size": len(grid),
    }

    # ---- Table 7: response time against catalogue size
    pool = list(services.values())
    sc0 = scenarios[0]
    event = event_for(sc0)
    lines += ["", "## Table 7. Ranking time inside the AI service (milliseconds, 15 runs each)", ""]
    lines.append("| Candidate services | Median | 95th percentile |")
    lines.append("|---|---|---|")
    timing = {}
    for n in (50, 100, 250, 500, 1000, 2000):
        cands = [
            pool[i % len(pool)].model_copy(update={"service_id": f"T{i}", "category": sc0["category"]})
            for i in range(n)
        ]
        runs = []
        for _ in range(15):
            t0 = time.perf_counter()
            recommend(event, cands, top_n=10)
            runs.append((time.perf_counter() - t0) * 1000)
        runs.sort()
        median = statistics.median(runs)
        p95 = runs[int(0.95 * len(runs)) - 1]
        timing[n] = {"median_ms": median, "p95_ms": p95}
        lines.append(f"| {n} | {median:.1f} | {p95:.1f} |")

    lines += [
        "",
        f"Consistency check: the top 5 from the live ranking function matches the top 5 rebuilt "
        f"from the component scores in {top5_agree} of {len(scenarios)} scenarios "
        f"(component scores are rounded to 3 decimals, so a near tie can differ).",
    ]

    text = "\n".join(lines) + "\n"
    (RESULTS / "summary.md").write_text(text)
    (RESULTS / "results.json").write_text(json.dumps({
        "summary": summary, "paired_vs_shipped": paired, "preference_split": split,
        "ablation": ablation, "sensitivity": sensitivity, "levels": levels,
        "tuned": tuned, "timing": timing,
    }, indent=1))
    print(text)
    print(f"Saved to {RESULTS}")


if __name__ == "__main__":
    main()
