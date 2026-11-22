"""Draws grayscale charts for the report (the guidelines require grayscale printing).

Run from the ai-service folder, after evaluate.py:  python -m evaluation.make_charts
"""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

RESULTS = Path(__file__).parent / "results"
data = json.loads((RESULTS / "results.json").read_text())

plt.rcParams.update({"font.family": "serif", "font.size": 10})

# ---- Figure A: nDCG@5 by system, with 95% confidence intervals
summary = data["summary"]
names = list(summary)
means = [summary[n]["nDCG@5"] for n in names]
low = [summary[n]["nDCG@5"] - summary[n]["ci"][0] for n in names]
high = [summary[n]["ci"][1] - summary[n]["nDCG@5"] for n in names]
shades = ["0.85"] * (len(names) - 1) + ["0.25"]  # the shipped system is darker
hatches = ["" if i == len(names) - 1 else "//" if i < 3 else "" for i in range(len(names))]

fig, ax = plt.subplots(figsize=(7, 4.2))
y = range(len(names))
ax.barh(y, means, xerr=[low, high], color=shades, edgecolor="black",
        hatch=None, capsize=3, linewidth=0.8)
for i, h in enumerate(hatches):
    if h:
        ax.patches[i].set_hatch(h)
ax.set_yticks(list(y))
ax.set_yticklabels(names)
ax.invert_yaxis()
ax.set_xlim(0, 1)
ax.set_xlabel("nDCG@5 (mean over 40 scenarios, bars show 95% confidence interval)")
ax.grid(axis="x", linestyle=":", color="0.6")
fig.tight_layout()
fig.savefig(RESULTS / "figure_ndcg_by_system.png", dpi=300)
plt.close(fig)

# ---- Figure B: weight sensitivity
levels = data["levels"]
styles = {"budget": ("-", "o"), "location": ("--", "s"), "rating": ("-.", "^"), "text": (":", "D")}
fig, ax = plt.subplots(figsize=(6.5, 4))
for key, values in data["sensitivity"].items():
    ls, marker = styles[key]
    ax.plot(levels, values, linestyle=ls, marker=marker, color="black", label=key, linewidth=1.2)
ax.set_xlabel("Weight given to one component (others rescaled)")
ax.set_ylabel("nDCG@5")
ax.set_ylim(0.5, 0.9)
ax.grid(linestyle=":", color="0.6")
ax.legend(frameon=False)
fig.tight_layout()
fig.savefig(RESULTS / "figure_weight_sensitivity.png", dpi=300)
plt.close(fig)

# ---- Figure C: response time against catalogue size
timing = data["timing"]
sizes = [int(n) for n in timing]
med = [timing[str(n)]["median_ms"] for n in sizes]
p95 = [timing[str(n)]["p95_ms"] for n in sizes]
fig, ax = plt.subplots(figsize=(6.5, 4))
ax.plot(sizes, med, linestyle="-", marker="o", color="black", label="median")
ax.plot(sizes, p95, linestyle="--", marker="s", color="black", label="95th percentile")
ax.axhline(2000, linestyle=":", color="0.4")
ax.text(sizes[0], 1900, "NFR3 limit: 2000 ms", va="top", fontsize=9)
ax.set_xlabel("Candidate services ranked")
ax.set_ylabel("Time inside the AI service (ms)")
ax.set_ylim(0, 2100)
ax.grid(linestyle=":", color="0.6")
ax.legend(frameon=False, loc="center right")
fig.tight_layout()
fig.savefig(RESULTS / "figure_response_time.png", dpi=300)
plt.close(fig)

print("Saved 3 figures to", RESULTS)
