# Dixon-Coles walk-forward backtest (xi = 0.0025, shrink = 2)

**Expectation, stated before the results.** The model should land between the two baselines: clearly better than climatology (always predicting the historical home/draw/away rates) and close to, but not better than, the closing betting market, which aggregates far more information (team news, injuries, lineups). Beating the closing line is not expected. What actually happened is reported below as measured.

## Headline

| Matches scored | n | RPS model | RPS climatology | RPS market | Skill vs climatology | Skill vs market |
|---|---:|---:|---:|---:|---:|---:|
| All test matches | 1190 | 0.2003 | 0.2322 | 0.1943 | 0.1374 | -0.0310 |
| Excluding each team's first 5 matches of a season | 989 | 0.2042 | 0.2322 | 0.1968 | 0.1205 | -0.0380 |

Lower RPS is better. Skill = 1 - RPS_model / RPS_baseline (positive = model better).

Overall, the model landed between the two baselines, as expected; it closes 84% of the gap from climatology to the market (RPS 0.2322 -> 0.2003, market 0.1943). Model minus market RPS: +0.0060 [+0.0027, +0.0093] (excludes zero). Model minus climatology RPS: -0.0319 [-0.0394, -0.0243] (excludes zero).

## How the test works

- Data: 1950 played Premier League matches, seasons 2021-2022, 2022-2023, 2023-2024, 2024-2025, 2025-2026, 2026-2027.
- The first two seasons are training only. Every later match is a test match (1190 matches).
- Test matches are grouped into Tuesday-Monday weeks (UTC). For each week the model is fit on every match that kicked off strictly before the week's first kickoff, with time decay measured from that kickoff, and then predicts every match in the week. No result from the test week or later is ever used (asserted in code for every week).
- Time-decay rate xi = 0.0025 per day (a match d days old gets weight exp(-xi*d)).
- Promoted-team shrinkage strength shrink = 2 (0 = none; see the promoted-team shrinkage section).
- Climatology baseline: home/draw/away frequencies of that week's training data.
- Market baseline: closing average odds, de-vigged multiplicatively (p_i = (1/odds_i) / sum_j(1/odds_j)).
- Metrics: RPS (ranked probability score, primary; respects the ordering home > draw > away), log loss (-ln of the probability given to what happened), multiclass Brier (sum of squared errors over the three outcomes), accuracy (most likely outcome was right; a sanity check only).

## Fit diagnostics

- Weekly blocks (= model fits): 111
- Fits that did not report convergence: 0
- Test matches where at least one promoted team had no rating at all and got the prior centre (mean of the three weakest recently-active established teams): 6 (unrated teams: Coventry, Hull, Ipswich, Luton, Sheffield United, Sunderland)
- Test matches where a team's rating came only from matches more than 380 days old (a promoted side that was last in the league seasons ago keeps that old rating): 6

## Results by season

| Season | n | Forecaster | RPS | Log loss | Brier | Accuracy |
|---|---:|---|---:|---:|---:|---:|
| Overall | 1190 | model | 0.2003 | 0.9821 | 0.5851 | 0.5168 |
| Overall | 1190 | climatology | 0.2322 | 1.0755 | 0.6512 | 0.4286 |
| Overall | 1190 | market | 0.1943 | 0.9637 | 0.5727 | 0.5462 |
| 2023/24 | 380 | model | 0.1901 | 0.9297 | 0.5475 | 0.5605 |
| 2023/24 | 380 | climatology | 0.2340 | 1.0547 | 0.6375 | 0.4605 |
| 2023/24 | 380 | market | 0.1808 | 0.9007 | 0.5267 | 0.6000 |
| 2024/25 | 380 | model | 0.2012 | 0.9799 | 0.5855 | 0.5289 |
| 2024/25 | 380 | climatology | 0.2356 | 1.0822 | 0.6565 | 0.4079 |
| 2024/25 | 380 | market | 0.1961 | 0.9667 | 0.5752 | 0.5553 |
| 2025/26 | 380 | model | 0.2099 | 1.0304 | 0.6191 | 0.4658 |
| 2025/26 | 380 | climatology | 0.2278 | 1.0841 | 0.6560 | 0.4263 |
| 2025/26 | 380 | market | 0.2045 | 1.0118 | 0.6077 | 0.4947 |
| 2026/27 (partial, 50 matches) | 50 | model | 0.1987 | 1.0306 | 0.6102 | 0.4800 |
| 2026/27 (partial, 50 matches) | 50 | climatology | 0.2274 | 1.1178 | 0.6790 | 0.3600 |
| 2026/27 (partial, 50 matches) | 50 | market | 0.2061 | 1.0549 | 0.6357 | 0.4600 |

| Season | n | Skill vs climatology | Skill vs market |
|---|---:|---:|---:|
| Overall | 1190 | 0.1374 | -0.0310 |
| 2023/24 | 380 | 0.1874 | -0.0515 |
| 2024/25 | 380 | 0.1463 | -0.0258 |
| 2025/26 | 380 | 0.0783 | -0.0267 |
| 2026/27 (partial, 50 matches) | 50 | 0.1261 | 0.0358 |

## Paired bootstrap 95% confidence intervals

Difference in mean RPS, resampling test matches with replacement (10,000 resamples, seed 20260101). Negative = model better. An interval that excludes zero means the difference is unlikely to be resampling noise.

| Season | n | RPS(model) - RPS(market) | RPS(model) - RPS(climatology) |
|---|---:|---|---|
| Overall | 1190 | +0.0060 [+0.0027, +0.0093] (excludes zero) | -0.0319 [-0.0394, -0.0243] (excludes zero) |
| 2023/24 | 380 | +0.0093 [+0.0035, +0.0152] (excludes zero) | -0.0438 [-0.0586, -0.0292] (excludes zero) |
| 2024/25 | 380 | +0.0051 [-0.0005, +0.0108] (includes zero) | -0.0345 [-0.0482, -0.0205] (excludes zero) |
| 2025/26 | 380 | +0.0055 [-0.0000, +0.0111] (includes zero) | -0.0178 [-0.0296, -0.0062] (excludes zero) |
| 2026/27 (partial, 50 matches) | 50 | -0.0074 [-0.0344, +0.0187] (includes zero) | -0.0287 [-0.0651, +0.0099] (includes zero) |

## Early-season matches

Matches where either team had played fewer than 5 league matches that season: 201. RPS model 0.1812, climatology 0.2324, market 0.1823. Largest model probability given to any outcome in these matches: 0.888 (market: 0.881).

Test matches where the model gave some outcome under 1% probability: 0 (0 of them early-season); the market did so in 0.

## Promoted-team shrinkage

Plain maximum likelihood has nothing pulling a newly promoted team's rating towards anything, so after a handful of matches it can run away (a team that has not scored yet heads for the lower rating bound and the model then gives its opponents 99%+). The fix: each week, the model is first fit as before; the mean attack and defense of the three weakest established teams (recently active, not promoted this season) becomes a prior centre; the model is refit with a Gaussian penalty of strength shrink = 2 pulling each team promoted this season towards that centre. shrink = k is roughly worth k goals of evidence at the centre, so it dominates in the first weeks and fades as the team's own matches accumulate. Promoted teams with no matches in the data at all get the centre itself, as before. Teams are promoted for the whole of the season they come up and unpenalised after that.

Same xi = 0.0025, same weeks, same test matches; only the shrinkage differs. Model metrics only (the baselines do not change).

| Matches | n | RPS | Log loss | Brier |
|---|---:|---:|---:|---:|
| All test matches: shrink = 0 | 1190 | 0.2006 | 0.9885 | 0.5855 |
| All test matches: shrink = 2 | 1190 | 0.2003 | 0.9821 | 0.5851 |
| Matches involving a promoted team: shrink = 0 | 338 | 0.1709 | 0.9072 | 0.5198 |
| Matches involving a promoted team: shrink = 2 | 338 | 0.1698 | 0.8848 | 0.5186 |

Paired bootstrap 95% CIs (negative = shrinkage better):

- All test matches (1190 matches), after minus before: RPS -0.0003 [-0.0013, +0.0005] (includes zero); log loss -0.0064 [-0.0194, +0.0022] (includes zero).
- Matches involving a promoted team (338 matches), after minus before: RPS -0.0010 [-0.0046, +0.0019] (includes zero); log loss -0.0224 [-0.0673, +0.0080] (includes zero).

Test matches where the model put under 1% on some outcome: 8 with shrink = 0, 0 with shrink = 2.
Worst single-match log loss: 7.3055 with shrink = 0 (Burnley v Sunderland, 2025-08-23), 2.7935 with shrink = 2 (Nott'm Forest v Coventry, 2026-09-19).

The under-1% matches at shrink = 0, with their probabilities after the fix:

| Date | Home | Away | Result | Before H/D/A | After H/D/A | Market H/D/A | Log loss before | Log loss after |
|---|---|---|---|---|---|---|---:|---:|
| 2023-08-18 | Nott'm Forest | Sheffield United | H | 0.703/0.291/0.006 | 0.486/0.264/0.250 | 0.498/0.280/0.222 | 0.3527 | 0.7217 |
| 2024-08-24 | Man City | Ipswich | H | 0.937/0.062/0.001 | 0.888/0.084/0.028 | 0.881/0.084/0.035 | 0.0646 | 0.1189 |
| 2025-08-23 | Burnley | Sunderland | H | 0.001/0.048/0.952 | 0.162/0.217/0.622 | 0.399/0.306/0.295 | 7.3055 | 1.8229 |
| 2026-08-29 | Coventry | Hull | A | 0.000/0.075/0.925 | 0.137/0.247/0.616 | 0.551/0.248/0.201 | 0.0777 | 0.4848 |
| 2026-09-05 | Man City | Coventry | H | 0.935/0.065/0.001 | 0.834/0.125/0.040 | 0.795/0.132/0.073 | 0.0675 | 0.1815 |
| 2026-09-05 | Hull | Aston Villa | D | 0.761/0.234/0.005 | 0.513/0.295/0.192 | 0.240/0.262/0.498 | 1.4521 | 1.2194 |
| 2026-09-13 | Coventry | Brighton | A | 0.005/0.259/0.736 | 0.177/0.301/0.523 | 0.255/0.250/0.495 | 0.3060 | 0.6488 |
| 2026-09-19 | Nott'm Forest | Coventry | A | 0.881/0.118/0.001 | 0.743/0.195/0.061 | 0.579/0.240/0.181 | 6.5382 | 2.7935 |

## Choice of xi and shrink

Each cell is a complete walk-forward run (same weeks, same test matches); only the Dixon-Coles model changes, so the baselines are identical across cells. Model metrics on all test matches; the chosen cell is in bold.

Overall RPS:

| xi \ shrink | 0 | 2 | 5 | 10 | 20 | 40 |
|---:|---:|---:|---:|---:|---:|---:|
| 0.0 | 0.2041 | 0.2037 | 0.2036 | 0.2037 | 0.2038 | 0.2039 |
| 0.0015 | 0.2012 | 0.2009 | 0.2009 | 0.2011 | 0.2014 | 0.2018 |
| 0.0018 | 0.2010 | 0.2006 | 0.2007 | 0.2009 | 0.2013 | 0.2017 |
| 0.002 | 0.2008 | 0.2005 | 0.2006 | 0.2008 | 0.2012 | 0.2016 |
| 0.0025 | 0.2006 | **0.2003** | 0.2004 | 0.2007 | 0.2011 | 0.2016 |
| 0.003 | 0.2006 | 0.2003 | 0.2005 | 0.2007 | 0.2011 | 0.2016 |
| 0.004 | 0.2010 | 0.2007 | 0.2008 | 0.2010 | 0.2013 | 0.2016 |

Overall log loss:

| xi \ shrink | 0 | 2 | 5 | 10 | 20 | 40 |
|---:|---:|---:|---:|---:|---:|---:|
| 0.0 | 0.9974 | 0.9914 | 0.9914 | 0.9916 | 0.9919 | 0.9923 |
| 0.0015 | 0.9897 | 0.9835 | 0.9836 | 0.9841 | 0.9850 | 0.9862 |
| 0.0018 | 0.9890 | 0.9828 | 0.9829 | 0.9835 | 0.9846 | 0.9859 |
| 0.002 | 0.9887 | 0.9825 | 0.9827 | 0.9833 | 0.9844 | 0.9857 |
| 0.0025 | 0.9885 | **0.9821** | 0.9824 | 0.9831 | 0.9842 | 0.9856 |
| 0.003 | 0.9888 | 0.9823 | 0.9825 | 0.9832 | 0.9843 | 0.9856 |
| 0.004 | 0.9905 | 0.9837 | 0.9838 | 0.9843 | 0.9851 | 0.9860 |

Selection rule: lowest overall mean out-of-sample RPS on all test matches. Chosen xi = 0.0025, shrink = 2 (RPS 0.2003, log loss 0.9821). Log loss is reported alongside because the shrinkage targets a handful of very overconfident forecasts, which RPS barely penalises and log loss penalises heavily. Spread of overall RPS across the whole grid: 0.0037 (from 0.2003 to 0.2041).

**Caveat.** xi and shrink were chosen on the same out-of-sample weeks that the headline numbers are reported on, so the headline is slightly optimistic: it is the best of 42 tries, not a fresh test.

- Paired bootstrap 95% CI for RPS(xi=0.0025, shrink=2) - RPS(xi=0.003, shrink=0) over 1190 test matches: -0.0003 [-0.0014, +0.0006] (includes zero). The interval includes zero.
- Paired bootstrap 95% CI for log loss(xi=0.0025, shrink=2) - log loss(xi=0.003, shrink=0) over 1190 test matches: -0.0067 [-0.0199, +0.0023] (includes zero). The interval includes zero.

At xi = 0.0025, overall RPS across shrink > 0 ranges from 0.2003 (shrink 2) to 0.2016 (shrink 40); best minus worst: -0.0012 [-0.0029, +0.0005] (includes zero). Even the largest difference between shrink values is not distinguishable from resampling noise at this sample size, so the particular shrink value chosen should not be read as meaningful; what the data do support is that some shrinkage removes the extreme forecasts (see the promoted-team shrinkage section).

The chosen shrink (2) is the smallest non-zero value in the grid, so the optimum may lie below it; the grid does not show where RPS turns back up.

---
Runtime of the walk-forward at this xi and shrink: 3.5 s. Per-match predictions: `backtest_cache/preds_xi0.0025_shrink2.csv`.
