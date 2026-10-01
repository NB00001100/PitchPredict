# PitchPredict — Research Handoff Brief

Context for another Claude instance. This summarises a STORM multi-perspective research run (2026-09-22) on the question: **what model should a Premier League matchweek prediction app use?** Full evidence trail with 30 sourced Q&A entries is in `storm-work/storm-report.md` in this repo; `storm-work/qa.json` holds the same data as JSON. Numbers marked "computed" came from direct analysis of football-data.co.uk CSVs (E0, 2015/16–2025/26) during the research, not from a published source.

## 1. The verdict

Build a **time-weighted Dixon-Coles goals model** (independent Poisson is equivalent for 1X2) as the production model. Evaluate it walk-forward on RPS and log loss against two baselines: climatology (historical H/D/A base rates) and de-vigged closing bookmaker odds. Surface three probabilities plus a derived pick. Treat gradient boosting, Bayesian dynamic models, odds blending and lineup features as measured upgrades on top of that baseline, not as the starting point. Skip deep learning and LLM forecasters.

## 2. The ceiling (why 70–80% accuracy claims are wrong)

- PL home/draw/away by season (computed): 2021/22 42.9/23.2/33.9; 2022/23 48.4/22.9/28.7; 2023/24 46.1/21.6/32.4; 2024/25 40.8/24.5/34.7; 2025/26 42.6/27.4/30.0.
- "Pick the closing favourite" accuracy by season (computed): 59.2, 55.5, 60.0, 55.5, 49.5%. Five-season mean ≈ 56%. footballproofai independently: 55.98% over 1,899 matches.
- Closing-market RPS by season (computed): 0.189, 0.198, 0.181, 0.196, 0.205. Log loss 0.90–1.01. A base-rate-only model: RPS 0.227–0.235.
- Draws are 22–27% of matches (Statista range across seasons 18.7–30%) but almost never the modal outcome, so an argmax pick essentially never predicts a draw. Combined with mean favourite probability 0.52–0.56, a well-calibrated model's expected hit rate is mid-50s.
- Football is near the random end of team sports: upset probability ≈ 0.45 (Ben-Naim et al.) vs ≈ 0.35 for NBA/NFL. Goals ≈ Poisson, 2.75–3.28 per match. The PL is among Europe's *more* predictable leagues (StatsBomb log-loss study); the ceiling is the sport, not the league.
- Nobody in the 2017 or 2023 Soccer Prediction Challenges beat the bookmaker baseline. No public model has been shown to beat sharp closing 1X2 lines out of sample. Hubáček et al. 2019 "Exploiting sports-betting market" is an **NBA** study whose profit came from decorrelation; it is widely miscited as football evidence.

## 3. Model family comparison (all figures are RPS unless stated; lower is better)

| Model | Evidence | Notes |
|---|---|---|
| Time-weighted Poisson / Dixon-Coles | Ley et al. 2019 EPL: bivariate 0.1953, independent 0.1954, Bradley-Terry ≈ 0.1985. penaltyblog 2025 backtest: DC 0.1914, Poisson 0.1915, bivariate 0.1916, pi-ratings 0.1991, Elo 0.2042. Hubáček review: weighted double Poisson beat Elo/pi-ratings/PageRank. | Reference standard. Refits in seconds. Produces full score grid. |
| Elo → multinomial logit | footballproofai 2022–26 PL walk-forward: Brier 0.1951 / RPS 0.2015 vs sequential DC 0.2051 / 0.2169, market 0.1901 / 0.1947. | Conflicts with the row above on ordering. Under 100 lines of code from ClubElo CSV. |
| XGBoost / CatBoost on rating features | 2017 challenge winner 0.2063 (52.4%); all entries 0.2054–0.2087; bookmakers 0.2020. 2023 challenge: CatBoost+pi-ratings 0.2085, bookmaker consensus 0.2063. Baboota & Kaur EPL: GBT 0.2156 vs bookmakers 0.2012. | Gains come from the rating features, not the trees. Needs feature store, temporal CV, calibration layer. |
| Neural nets | Fischer & Heuer 2024: NN, random forest and Poisson "perform similarly". 2023 challenge deep model 0.2098. | No edge. |
| LLMs | arXiv 2608.05030: LLM reranking DC scorelines on EPL 2025/26 scored 50.0% vs baseline 53.3%. World Cup 2026 arenas: frontier LLMs statistically indistinguishable from de-vigged consensus, 0.94 correlated with each other, memorisation risk on backtests. | Hype for pre-match 1X2. |
| Bayesian state-space (time-varying attack/defence + home advantage) | 2025 JRSS-C: cumulative RPS 17.55 over 14 EPL seasons vs 22.22 for weighted-likelihood DC. Koopman & Lit: dynamics, not estimation paradigm, moves RPS (England static 0.2062 vs dynamic 0.1987). | Only class with a credible published edge. Minutes-scale batch fit (PyMC ≈ 38 s, hierarchical ensemble ≈ 186 s). |

Key point: differences among well-tuned goals-based models are ~0.001–0.005 RPS. Model class is a second-order decision.

### Dixon-Coles vs XGBoost specifically
- Accuracy: within ~0.002–0.005 RPS; not distinguishable on a single league without many seasons.
- XGBoost helps when you have heterogeneous covariates (lineups, injuries, rest days, squad value, odds movement, xG) or non-1X2 targets (cards, corners). penaltyblog cannot take per-match covariates.
- Dixon-Coles wins on: full scoreline grid (1X2, correct score, BTTS, totals from one distribution), data efficiency (~40 parameters on 3–5 seasons vs trees overfitting 1,500–2,000 matches), operations (seconds to fit, one hyperparameter that matters), and out-of-the-box calibration (trees need Platt/isotonic fitted out-of-sample).
- Recommended order: DC baseline → walk-forward harness → try XGBoost as a stacking layer over DC probabilities, Elo difference, de-vigged odds and availability features. That configuration won the challenges; the harness will show whether it earns its keep.

## 4. Inputs that matter

- **Time decay:** Dixon-Coles ξ = 0.0065 per half-week ≈ 0.00186/day (half-life ≈ 373 days). opisthokonta: 0.0018/day for England. Ley et al.: 390-day half-period. Anything 0.0018–0.003/day is defensible; ~1–2 seasons of data matter. JRSS-C model: within-season forgetting 0.988/match, between-season 0.770 (explicit summer reset). 538-style systems regress ~1/3 to the mean between seasons.
- **Home advantage** (home-win % by season, computed): 2015/16 41.3; 16/17 49.2; 17/18 45.5; 18/19 47.6; 19/20 45.3; 20/21 37.9 (COVID); 21/22 42.9; 22/23 48.4; 23/24 46.1; 24/25 40.8; 25/26 42.6. Log-scale Poisson home multiplier swings 0.06–0.29 outside COVID. Estimate as a single league-level time-varying parameter. Team-specific effects are weakly identified with 19 home games per season. Do not hard-code.
- **Dixon-Coles ρ (low-score correction):** per-season EPL MLEs range −0.16 to +0.06 (computed); rolling out-of-sample 1X2 RPS differs from independent Poisson by ≤ 0.0002. Keep ρ only if you show correct-score / BTTS / under-2.5 outputs. A 2026 Bayesian bivariate study does find real dependence (φ = −0.107) for scoreline reproduction.
- **xG:** better descriptor of strength (r = 0.574 vs 0.47 for goals, Mead et al. 2023) but the only direct xG-DC vs goals-DC comparison found gave ΔRPS +0.00026 with CI [−0.0035, +0.0039]. "The closing line has already priced expected goals." FBref lost Opta xG in Jan 2026; Understat is scrape-only. Not worth a dependency.
- **Lineups / injuries / squad value:** Arntzen & Hvattum: Elo + starting-XI plus-minus "significantly better" than either alone (no effect size published). Lagged Transfermarkt squad value forecasts UEFA matches as well as Elo (RPS×100 19.53 vs 19.73), useful as pre-season / promoted-team prior. Expected gain ≈ 0.001–0.003 RPS. Manager changes: "basically no effect" (Heuer et al.); do not add ad-hoc adjustments.
- **Lead time:** opening vs closing Brier 0.5747 vs 0.5734 over 5,286 matches; a goals model cannot predict line movement (r = −0.02). Publish Tue/Wed after ingest, refresh Fri, optional T-60 lineup run. Timestamp every forecast version to measure skill by lead time.

## 5. The market as input

- De-vigged closing odds are the strongest single forecast. If licensed, blend them in; it closes most of the gap to the market. What a model adds beyond that: coverage when odds are absent/stale, a house view for explanations, decorrelation for betting-style products.
- De-vigging: Štrumbelj 2014 favoured Shin; Berk 2024 and a 2026 EMH paper find power/multiplicative as good or better in today's low-margin markets. Use the power method.
- Licensing: Oddsportal terms forbid commercial use and scraping. The Odds API allows display in commercial apps and model training, bans redistribution (free 500 credits/month, 20K for $30). Betfair API free for personal use only.
- Calibration: models are calibrated enough (reliability component 3.6–4.7% of Brier, Foulley); the deficit vs bookmakers is resolution, especially on draws (skill 1.4–3.0% for both). Recalibration cannot fix resolution.
- Ensembling: modest gains, mostly from adding market information. A 2026 Bayesian outcome-specific ensemble on 751 EPL matches improved Brier only 0.195 → 0.193. Koopman & Lit: effort should go to "more and better explanatory variables rather than better models".

## 6. Honest evaluation protocol

- **Metrics:** report RPS *and* log loss (the literature is split: Constantinou & Fenton 2012 for RPS; Wheatcroft 2021 for the ignorance/log score), plus Brier and reliability plots. Never lead with accuracy.
- **Baselines:** climatology (PL RPS ≈ 0.227–0.235) and de-vigged closing odds (RPS 0.181–0.205). Skill = 1 − RPS_model / RPS_baseline. Between the two is useful; within 0.002 of the market is excellent.
- **Walk-forward:** sort by kickoff; enforce max(train time) < min(test time); expanding window by matchweek or season; point-in-time features (backward-only joins; rolling form excludes the match itself; season-to-date starts at zero); fit any calibration layer on out-of-sample training predictions and freeze it; report per-season scores; ≥ 500 settled test matches, ≥ 3 windows. Exclude or separately score the first 5–10 rounds each season (promoted teams have no data).
- **Sample size:** per-match RPS SD ≈ 0.135, so use paired tests on identical matches. Detecting a 0.005 RPS gap between loosely related models needs ~6,000 matches (~16 PL seasons); 0.002 between highly correlated models needs ~150–250. One 380-match season resolves only ~0.02 RPS. Backtest over ≥ 5–10 seasons and report bootstrap CIs.
- **Leakage patterns to avoid:** half-time or full-time stats as features; random rather than temporal splits; post-kickoff market data; comparing a Thursday model against closing odds that embed team news; duplicated season files; calibration fitted on the test fold; end-of-season aggregates or current table position at test time.

## 7. Data and libraries (prices as fetched 2026-09-22)

- **Free, stable:** football-data.co.uk CSVs (1993/94–2026/27; results, shots, cards, opening and closing odds; no xG, no lineups). football-data.org free tier (fixtures/tables, 10 calls/min; lineups need €29/mo Deep Data; exposes a `matchday` field). ClubElo daily CSV (`api.clubelo.com/YYYY-MM-DD`).
- **Free but fragile / ToS-limited:** Understat (scrape-only xG). FBref (xG removed Jan 2026; Sports Reference forbids building tools from scraped data). StatsBomb open data (non-commercial, 2015/16 PL only).
- **Paid:** API-Football $19–39/mo (lineups, injuries, xG, odds). Sportmonks Starter €29/mo (5 leagues), xG add-on €24, expected lineups €199. The Odds API free 500 credits/mo, 20K for $30. Opta / StatsBomb commercial quote-only ($500–1,000+/mo estimates).
- **Libraries:** `penaltyblog` (Python, v1.12.2, 2026-09-13) is the only actively maintained full-stack option: Poisson, Dixon-Coles, bivariate, negative binomial, Bayesian/hierarchical, Elo, pi-ratings, de-vig tools, backtesting, scrapers for football-data.co.uk / Understat / ClubElo / FPL; DC on 50k matches in 3.2 s; cannot take per-match covariates. `soccerdata` v1.9.1 for data access. `footBayes` (R, CRAN 2.0.0) for Stan-backed Bayesian models. Avoid `footballdata` (2017), `worldfootballR` (archived 2025), `socceraction` (event data, not prediction).
- **Weekend build:** penaltyblog `DixonColesGoalModel` on 3–5 seasons with decay weights, or ClubElo + multinomial logit. Minimum outage-resilient inputs: fixture list (home, away, kickoff) + historical goals and dates, available from three independent free sources; cache weekly; keep last week's ratings frozen as fallback.

## 8. Operations

- Refit ratings after every matchday (seconds). Re-tune ξ and calibration once per season.
- Monitor the *paired* model-minus-market RPS per match with CUSUM. A sustained 0.01 RPS decline takes ~100+ matches to detect, so also run data-quality checks (missing fixtures, team-name mismatches, stale odds), which cause silent degradation more often than concept drift.
- Promoted teams: carry Championship-earned Elo (ClubElo does), or assign the relegated-team average (avoids rating inflation), or seed from Transfermarkt value. Widen uncertainty for the first 6–10 rounds.
- Postponements: 41.4% of PL fixtures 2021/22–2025/26 moved from their published date. Key everything on fixture ID and actual kickoff datetime, re-pull fixtures before every run, let date-based decay handle games in hand.
- Matchweek definition: the PL schedules 38 numbered rounds (33 weekend + 5 midweek). premierleague.com labels each fixture with a matchweek that survives postponement; FPL gameweeks diverge after rescheduling. Key each fixture to (season, official matchweek, fixture id); score rescheduled games in their original matchweek; surface them in the calendar week played. 2026/27: 21 Aug 2026 – 30 May 2027; breaks 21 Sep–6 Oct, 9–17 Nov, 22–30 Mar; midweek MW13, 18, 25, 29 confirmed.

## 9. Product surface

- Show three probabilities + derived pick with its probability + most-likely scoreline (the FiveThirtyEight / Forebet pattern). Show draw probability alongside the pick so users see when it is high; one model "correctly predicted only 2 draws out of 1,784".
- Displayed scoreline: mode of the score matrix (often 1-1 or 1-0), optionally alongside rounded expected goals.
- User-facing scoring: Super 6 (5 exact / 2 result), Superbru (3 exact / 1.5 close / 1 result). For a probabilistic score, Brier is the most explainable (0 perfect, 0.667 worst for 3-way).
- Transparency (public methodology and calibration pages) is what distinguished the most trusted product (538 SPI). Election-forecast experiments show users over-read "90%" as certainty.
- **Legal (UK):** a free-to-enter prediction app, with or without prizes, is a prize competition needing no Gambling Commission licence (Gambling Act 2005 s.11). Paid entry converts it to pool betting unless an equally prominent free route exists. CAP Code section 16 applies to affiliate content; rule 16.3.12 bans "strong appeal" to under-18s (e.g. top-flight footballers). **US:** free-to-play falls under state sweepstakes law (registration/bonding above thresholds in FL, NY, RI); paid pick'em is treated as DFS and banned in several states. Google Play prohibits unapproved apps that "direct users to" gambling services, the main risk for affiliate links.

## 10. Unresolved conflicts (do not smooth over)

1. Dixon-Coles vs Elo→logit ordering differs between benchmarks (league, window, tuning). Settle on your own PL walk-forward with paired tests.
2. RPS vs log score as the primary metric. Report both.
3. Low-score dependence is real for scorelines, irrelevant for 1X2.
4. Post-COVID home advantage: causal studies find small/insignificant crowd effects; raw data show large season-to-season swings. Use a time-varying parameter.
5. Odds-informed models report betting profit while being less accurate than the market. Profit comes from decorrelation; treat ROI claims without a closing-line test as unreliable.
6. Shin vs power de-vigging: use power; margins have fallen.
7. Lead time / team news: average effect small, tail effect (multiple absences, rotation) real. Measure it.
8. "Features matter more than model class" (0.08 vs 0.01 RPS swing) vs "neither matters much" (Fischer & Heuer). Both agree model class is minor.

## 11. Known gaps

- No PL-level peer-reviewed xG-vs-goals ratings comparison.
- No quantified injury/suspension feature value for the PL.
- No source on how many matches until a promoted team's rating stabilises (6–10 rounds is inferred).
- Sample-size figures are an own power calculation, not a published result.
- No head-to-head Bayesian hierarchical vs maximum-likelihood Dixon-Coles skill study.
- No football-specific UX/trust study for probability presentation.
- FiveThirtyEight methodology pages are dead; details rest on the data README and secondary posts.
- All LLM benchmarks found are World Cup 2026; none covers a full domestic season.

## 12. Key sources

- Dixon & Coles 1997 (original model). Ley, Van de Wiele & Van Eetvelde 2019, arXiv 1705.09575 (EPL model comparison). Hubáček, Šourek & Železný 2019, Machine Learning (2017 challenge winner) and MathSport 2019 review. Yeung et al., arXiv 2309.14807 (2023 challenge). Fischer & Heuer, arXiv 2408.08331 (models perform similarly). JRSS-C 2025, academic.oup.com/jrsssc/article/74/3/717 (Bayesian state-space). Koopman & Lit 2019, Int. J. Forecasting 35(2) (dynamics matter; no model beats bookmaker).
- Constantinou & Fenton 2012 (RPS) vs Wheatcroft 2021, arXiv 1908.08980 (ignorance score).
- Štrumbelj 2014 IJF (Shin de-vig); Berk 2024 (retire Shin); arXiv 2604.17194 (EMH / de-vig comparison).
- Foulley, arXiv 2106.14345 (calibration vs resolution). Egidi, Pauli & Torelli 2018, arXiv 1802.08848 (Bayesian + odds). Leitner, Zeileis & Hornik 2010 (bookmaker consensus).
- arXiv 2608.05030 (LLM vs Dixon-Coles on EPL 2025/26). arXiv 2607.24573, 2607.18084, 2608.03416 (World Cup 2026 LLM arenas).
- Mead, O'Hare & McMenemy 2023, PLOS ONE (xG as strength descriptor). Arntzen & Hvattum 2021, Statistical Modelling (lineup ratings). Csató & Csurilla 2026, arXiv 2609.21674 (squad value vs Elo).
- footballproofai.com/research (PL walk-forward benchmarks, favourite win rate, validation rules). pena.lt/y and opisthokonta.net (Dixon-Coles tutorials, decay tuning, model shootouts). penaltyblog.readthedocs.io.
- football-data.co.uk/notes.txt, football-data.org/pricing, the-odds-api.com, sportmonks.com (data/pricing). sports-reference.com/data_use.html (FBref restrictions).
- legislation.gov.uk/ukpga/2005/19 (Gambling Act s.9, s.11); gamblingcommission.gov.uk free draws and prize competitions guidance; CAP Code section 16.
- premierleague.com fixture FAQs and 2026/27 fixture release (news/4675097).
