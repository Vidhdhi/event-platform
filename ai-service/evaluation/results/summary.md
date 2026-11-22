## Table 1. Ranking quality on 40 scenarios (mean over scenarios)

| System | P@3 | P@5 | nDCG@5 | Top-1 correct | nDCG@5 95% CI |
|---|---|---|---|---|---|
| Random | 0.619 | 0.621 | 0.310 | 0.133 | 0.273 to 0.351 |
| Cheapest first | 0.233 | 0.325 | 0.129 | 0.000 | 0.095 to 0.166 |
| Top rated (raw average) | 0.700 | 0.715 | 0.377 | 0.225 | 0.314 to 0.448 |
| Budget only | 0.567 | 0.620 | 0.301 | 0.050 | 0.254 to 0.349 |
| Location only | 0.717 | 0.740 | 0.423 | 0.200 | 0.358 to 0.492 |
| Rating only (smoothed) | 0.775 | 0.760 | 0.421 | 0.300 | 0.357 to 0.491 |
| Text only | 0.592 | 0.610 | 0.453 | 0.225 | 0.375 to 0.536 |
| Rule-based v1 | 0.950 | 0.925 | 0.580 | 0.400 | 0.507 to 0.659 |
| Hybrid v2 (shipped) | 0.900 | 0.885 | 0.809 | 0.875 | 0.750 to 0.865 |

## Table 2. Hybrid v2 compared with each other system (nDCG@5, paired bootstrap)

| Compared with | Mean difference | 95% CI | Clear difference? |
|---|---|---|---|
| Random | +0.500 | +0.443 to +0.553 | yes |
| Cheapest first | +0.680 | +0.617 to +0.744 | yes |
| Top rated (raw average) | +0.433 | +0.361 to +0.505 | yes |
| Budget only | +0.508 | +0.433 to +0.581 | yes |
| Location only | +0.386 | +0.311 to +0.457 | yes |
| Rating only (smoothed) | +0.389 | +0.325 to +0.449 | yes |
| Text only | +0.357 | +0.289 to +0.428 | yes |
| Rule-based v1 | +0.229 | +0.148 to +0.314 | yes |

## Table 3. Effect of the planner typing a preference (nDCG@5)

| Scenarios | Count | Rule-based v1 | Hybrid v2 |
|---|---|---|---|
| Preference typed | 28 | 0.446 | 0.796 |
| No preference | 12 | 0.895 | 0.840 |

## Table 4. Ablation: remove one component from Hybrid v2 (nDCG@5)

| Variant | nDCG@5 | Change from full |
|---|---|---|
| Full Hybrid v2 | 0.809 | |
| Without budget | 0.803 | -0.006 |
| Without location | 0.670 | -0.140 |
| Without rating | 0.673 | -0.136 |
| Without text | 0.580 | -0.230 |

## Table 5. Weight sensitivity: vary one weight, rescale the others (nDCG@5)

| Weight set to | 0.0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 |
|---|---|---|---|---|---|---|---|
| budget | 0.803 | 0.824 | 0.822 | 0.811 | 0.813 | 0.804 | 0.797 |
| location | 0.670 | 0.825 | 0.823 | 0.781 | 0.740 | 0.698 | 0.675 |
| rating | 0.673 | 0.753 | 0.801 | 0.816 | 0.832 | 0.820 | 0.768 |
| text | 0.580 | 0.775 | 0.803 | 0.796 | 0.757 | 0.726 | 0.672 |

## Table 6. Weights tuned on 20 scenarios, checked on the other 20 (nDCG@5)

| Weights (budget, location, rating, text) | Tuning half | Unseen half |
|---|---|---|
| Shipped (0.35, 0.25, 0.25, 0.15) | 0.758 | 0.861 |
| Best on tuning half (0.1, 0.2, 0.5, 0.2) | 0.801 | 0.895 |

## Table 7. Ranking time inside the AI service (milliseconds, 15 runs each)

| Candidate services | Median | 95th percentile |
|---|---|---|
| 50 | 1.8 | 2.5 |
| 100 | 2.8 | 2.9 |
| 250 | 6.5 | 16.8 |
| 500 | 11.3 | 12.2 |
| 1000 | 21.1 | 27.6 |
| 2000 | 41.1 | 53.1 |

Consistency check: the top 5 from the live ranking function matches the top 5 rebuilt from the component scores in 40 of 40 scenarios (component scores are rounded to 3 decimals, so a near tie can differ).
