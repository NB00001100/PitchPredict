# Best model for predicting a Premier League matchweek — Research Outline

> **Framing.** This research asks which model a developer should build into an app that forecasts every match in a Premier League matchweek, and how to judge whether it is any good. Six lenses were used (statistician, ML engineer, betting-market skeptic, newcomer developer, weather-forecast verification specialist, consumer product manager); 30 deduplicated questions were answered mostly from primary literature, vendor pages, and direct computation on football-data.co.uk results 2015/16–2025/26.
>
> **Headline findings.**
> 1. **The ceiling is low and known.** De-vigged closing bookmaker odds, the best forecaster available, pick the PL winner only 49.5–60% of the time per season (RPS ≈ 0.18–0.21). Honest models land at 52–56% accuracy. Any claim much above 60% over a full season is a leakage or selection-bias signal.
> 2. **Model class barely matters; inputs and evaluation do.** Time-weighted Poisson/Dixon-Coles, Elo→logit, gradient boosting on ratings and neural nets all sit within ~0.001–0.005 RPS of each other; no ML, deep-learning or LLM entry has beaten a well-tuned goals model or the market on PL 1X2. The one credible published edge is a Bayesian state-space model with time-varying strengths and home advantage.
> 3. **Recommended build:** a time-weighted Dixon-Coles (or independent Poisson) goals model on 3–5 seasons of free football-data.co.uk data with a time-varying league-level home advantage, optionally blended with de-vigged closing odds; evaluated walk-forward on RPS + log loss against climatology and market baselines; surfaced as three probabilities plus a derived pick, because the argmax pick will essentially never be a draw.

---

## 1. What "predicting a match" means, and the realistic ceiling

### 1.1 The forecast object is a probability vector (or a score grid), not a pick
- Literature, libraries and public products all produce P(home), P(draw), P(away); goals models produce a full scoreline matrix from which 1X2, totals and correct-score are read consistently (q01 — penaltyblog docs, Opta Analyst, FiveThirtyEight SPI README).
- The argmax "winner" hides that the favourite is only ~52–56% likely on average; the modal exact score is only ~8–12% likely (q01; second figure is model-knowledge).

### 1.2 Base rates and trivial baselines, PL 2021/22–2025/26 (computed from football-data.co.uk)
- Home/draw/away by season: 42.9/23.2/33.9, 48.4/22.9/28.7, 46.1/21.6/32.4, 40.8/24.5/34.7, 42.6/27.4/30.0. "Always home" ≈ 41–48%; "always draw" ≈ 22–27% (q03).
- "Pick the closing favourite": 59.2%, 55.5%, 60.0%, 55.5%, 49.5% (five-season mean ≈ 56%); market RPS 0.181–0.205 vs 0.227–0.235 for a base-rate-only model (q03, q20 — footballproofai independently reports 55.98% over 1,899 matches).
- A "higher-ranked team" baseline was not found published; expect it slightly below the favourite baseline (q03 — inference).

### 1.3 Football is near the random end of team sports
- Ben-Naim et al. upset probability q ≈ 0.45 for soccer vs ≈ 0.35 for NBA/NFL; Aoki et al. (KDD 2017) conclude luck is substantial even in top leagues and "partially explains why sophisticated ... models hardly beat simple models" (q04).
- Goals are low and roughly Poisson (2.75–3.28 per match, variance 2.5–3.2), so a one-goal swing is within one SD of the goals process (q04 — computed).
- The PL is actually among Europe's *more* predictable leagues by bookmaker log loss (StatsBomb); the ceiling is a property of the sport, not the league (q04).
- Because draws are 22–27% likely but almost never the modal outcome, argmax picks never predict them; combined with mean favourite probability 0.52–0.56, a well-calibrated model's expected accuracy is mid-50s (q04, q28).

## 2. Model families: what the evidence says about each

### 2.1 Poisson / Dixon-Coles goals models are the reference standard
- Poisson: goals ~ attack × opponent defence × home advantage; Dixon-Coles adds a low-score dependence term ρ and exponential time decay (q02).
- Ley et al. 2019 on EPL 2008/09–2017/18: bivariate Poisson RPS 0.1953 vs independent Poisson 0.1954 vs Bradley-Terry/Thurstone-Mosteller ≈ 0.1985; penaltyblog's 2025 backtest gives the same ordering (DC 0.1914, Poisson 0.1915, bivariate 0.1916, pi-ratings 0.1991, Elo 0.2042) (q05).
- Hubáček et al. 2019 review: time-weighted double Poisson (α = 0.0019/day) beat Elo, pi-ratings and PageRank (RPS 0.2082 vs 0.2088/0.2092/0.2128) (q05).

### 2.2 The Dixon-Coles ρ correction is immaterial for 1X2, relevant for correct-score markets
- Original ρ = −0.13; per-season EPL MLEs 2015/16–2025/26 range −0.16 to +0.06 with log-likelihood gains of only 0–2.6 units per season; rolling out-of-sample 1X2 RPS differs from independent Poisson by ≤ 0.0002 in every season (q07 — own computation on football-data.co.uk).
- Keep ρ only if the app also shows correct score / BTTS / under-2.5 (q07). See Conflicts: *Does low-score dependence exist?*

### 2.3 Elo and rating systems are competitive when mapped to 1X2 properly
- Elo needs an extra step (empirical draw curve or multinomial logit on rating difference) to yield 1X2; ClubElo uses K = 20, margin-of-victory multiplier and a per-country home-field term (~30–85 points) (q02, q08).
- A 2022–2026 walk-forward benchmark (1,520 PL matches) ranked Elo→multinomial logit (Brier 0.1951, RPS 0.2015) *above* sequential Dixon-Coles (0.2051 / 0.2169), with the closing market at 0.1901 / 0.1947 (q19, q15). See Conflicts: *Dixon-Coles vs Elo ordering*.

### 2.4 Gradient boosting, deep learning and LLMs: no demonstrated edge on 1X2
- 2017 Soccer Prediction Challenge: XGBoost on pi-ratings won at RPS 0.2063 / 52.4%, but all published entries sat in 0.2054–0.2087 and the bookmaker baseline was 0.2020 / 51.9% (q05, q14).
- 2023 challenge: CatBoost + pi-ratings 0.2085, deep model 0.2098, bookmaker consensus 0.2063; Fischer & Heuer find NN, random forest and Poisson "perform similarly" across five leagues (q14, q23).
- LLMs: an Aug 2026 study reranking Dixon-Coles scorelines with a frontier LLM on EPL 2025/26 got 50.0% vs the baseline's 53.3%; World Cup 2026 arenas show LLMs statistically indistinguishable from de-vigged consensus and 0.94 correlated with each other, with memorisation risk on any historical backtest (q23).
- Maintenance: a DC/Elo pipeline has a handful of parameters and refits in seconds (penaltyblog: 50k matches in 3.2 s); a GBT stack needs a feature store, re-tuning and drift monitoring for a published gain of ~0.001–0.005 RPS (q14, q15 — cost comparison is model-knowledge).

### 2.5 Bayesian / dynamic models: the only class with a credible published edge
- 2025 JRSS-C Bayesian state-space model (time-varying attack/defence and home advantage): cumulative RPS 17.55 over 14 EPL test seasons vs 22.22 for weighted-likelihood Dixon-Coles and 20.71 for Koopman-Lit score-driven (q05).
- Koopman & Lit show it is *dynamics*, not the estimation paradigm, that moves RPS (England static bivariate Poisson 0.2062 vs dynamic 0.1987); a 2026 Bayesian EPL study decomposes predictive variance as 0.6% parameter vs 99.4% aleatoric, so posterior uncertainty mostly buys honest early-season shrinkage (q26).
- Cost is fine for weekly batch: PyMC Baio-Blangiardo ≈ 38 s; a three-model hierarchical ensemble ≈ 186 s; footBayes exposes Stan back-ends (q26).

## 3. Inputs that actually move the needle

### 3.1 Time decay: ~1-year half-life, plus a between-season reset
- Dixon-Coles ξ = 0.0065 per half-week ≈ 0.00186/day (half-life ≈ 373 days); opisthokonta 0.0018/day England; Ley et al. 390-day half-period; anything 0.0018–0.003/day is defensible and ~1–2 seasons of data matter (q08).
- The JRSS-C model estimates within-season forgetting 0.988/match and between-season 0.770, i.e. an explicit summer reset; 538-style systems regress ~1/3 to the mean between seasons (q08, q16).

### 3.2 Home advantage is real, time-varying, and must not be hard-coded
- Home-win % by season 2015/16–2025/26: 41.3, 49.2, 45.5, 47.6, 45.3, **37.9 (2020/21)**, 42.9, 48.4, 46.1, **40.8 (2024/25)**, 42.6; log-scale Poisson home multiplier swings 0.06–0.29 outside COVID (q09 — computed, cross-checked with premierleague.com and Opta).
- Estimate as a single league-level time-varying parameter (state-space, or refit on trailing 2–3 seasons with the same decay); team-specific effects are weakly identified with 19 home games per season (q09). See Conflicts: *How big is the post-COVID home effect?*

### 3.3 xG: better descriptor, marginal forecaster
- xG correlates better with future goal ratio (r = 0.574 vs 0.47 goals) (q06 — Mead et al. 2023).
- The only direct xG-DC vs goals-DC comparison found: ΔRPS +0.00026, 95% CI [−0.0035, +0.0039]; "the closing line has already priced expected goals". Wilkens 2026 (Bundesliga) finds the market still better calibrated than an xG-Skellam model (q06). **Partial** — no PL-level peer-reviewed comparison exists.
- Practical: FBref stopped carrying Opta xG in January 2026; Understat is scrape-only (q12).

### 3.4 Lineups, injuries, market value: ~1–2% RPS at best
- Arntzen & Hvattum: Elo + starting-XI plus-minus is "significantly better" than either alone (effect size not in abstract) (q10).
- Lagged Transfermarkt squad value forecasts UEFA matches as well as Elo (RPS×100 19.53 vs 19.73), pooled 19.43; useful as a pre-season / promoted-team prior (q08, q10).
- Manager changes: Heuer et al. find "basically no effect"; do not add ad-hoc adjustments (q08).
- Expected gain from availability features ≈ 0.001–0.003 RPS, concentrated in multi-absence matches and the first ~10 rounds after a window (q10 — **partial**, inferred).

## 4. The betting market as benchmark and as input

### 4.1 De-vigged closing odds are the strongest single forecast; nobody beats them out of sample
- Closing favourite 55.98% over 1,899 EPL matches; Pinnacle closing prices return 99.73% when every outcome is bet (unbiased); market RPS band 0.19–0.21 across sources (q20).
- Hubáček 2019 "exploiting the market" is an **NBA** study whose profit came from decorrelating from the bookmaker, and is frequently miscited as football evidence; Koopman & Lit find no results-only model beats the bookmaker across 6 leagues / 17 seasons; older "profitable" pi-ratings results bet against soft average odds with 10–12% overrounds (q20, q17).

### 4.2 What a model adds if the market is better
- Coverage when odds are absent or stale (early week, cups), a house view for explanations, and decorrelation for betting-style products (q17).
- Odds as input: Wunderlich & Memmert's ELO-Odds beats result-Elo; Egidi et al.'s odds+history Bayesian model still scores slightly below de-vigged Shin odds on average correct probability (EPL 0.435 vs 0.452) (q25). See Conflicts: *Odds-informed models: profitable yet less accurate?*

### 4.3 De-vigging method and licensing
- Štrumbelj 2014: Shin beats basic normalisation; Berk 2024 and a 2026 EMH paper: power or multiplicative is as good in today's low-margin markets (q17). See Conflicts: *Shin vs power*.
- Oddsportal terms forbid commercial use and scraping; The Odds API allows display in commercial apps and model training but bans redistribution (free 500 credits/month, 20K for $30); Betfair API is free for personal use only (q17, q12).

### 4.4 Calibration: models are calibrated enough; resolution is the deficit
- Favourite-longshot bias exists but is small (~2% loss at short odds vs ~15% at >5.00; draws show a *negative* longshot bias) (q24).
- Foulley: Poisson-Elo reliability component only 3.6–4.7% of Brier; bookmakers win on resolution (home-win resolution 34.5% vs 29.5%); draws are near-unforecastable for both (skill 1.4–3.0%) (q24).
- Recalibration (isotonic, Platt) is used but cannot fix resolution; 538's own calibration page showed slight overconfidence on heavy favourites (q24).

### 4.5 Ensembling: modest gains, mostly from adding market information
- Bookmaker consensus models beat Elo/FIFA ratings for tournaments (Leitner et al. 2010); a 2026 Bayesian outcome-specific ensemble on 751 EPL matches improved Brier only 0.195 → 0.193; no football paper shows NWP-style gains from averaging structurally different models (q25).
- Koopman & Lit: effort should go to "more and better explanatory variables rather than better models" (q25).

## 5. Honest evaluation

### 5.1 Metrics: report RPS *and* log loss, never lead with accuracy
- RPS (Constantinou & Fenton 2012) is the de-facto football metric and the official challenge metric; Wheatcroft 2021 argues the ignorance/log score selects the better forecaster more reliably and that RPS's distance-sensitivity "adds nothing" (q11). See Conflicts: *RPS vs log score*.
- Baselines: climatology (PL 2021–26 RPS ≈ 0.227–0.235) and de-vigged closing odds (RPS 0.181–0.205, log loss 0.90–1.01); report skill = 1 − RPS_model / RPS_baseline. Landing between the two is useful; within 0.002 of the market is excellent (q11).

### 5.2 Walk-forward protocol
- Sort by kickoff; enforce max(train time) < min(test time); expanding-window by matchweek or season; point-in-time features (backward-only joins, rolling form excludes the match itself, season-to-date starts at zero); fit calibration on out-of-sample training predictions and freeze; report per-season scores; require ≥500 settled test matches, ≥3 windows (q21).
- Exclude or separately score the first 5–10 rounds each season, as opisthokonta and Hubáček did, because promoted teams have no data (q16).

### 5.3 Sample size: one season cannot distinguish similar models
- Per-match RPS SD ≈ 0.135; paired tests required. Detecting a 0.005 RPS gap between loosely related models needs ~6,000 matches (~16 PL seasons); a 0.002 gap between highly correlated models needs ~150–250. One 380-match season resolves only ~0.02 RPS (q21 — own power calculation, **partial**: no published N).

### 5.4 Leakage patterns behind "70–80% accuracy" claims
- Half-time or full-time stats as features; random rather than temporal splits; post-kickoff market data; comparing a Thursday model against closing odds that embed team news; duplicated season files silently double-counted; calibration fitted on the test fold (q22, q21).
- A 2024 systematic review tabulates soccer DNNs at "99%" and GBT at "89.6%" accuracy without comment; against a ceiling of 52–56% these are unexamined claims (q22 — **partial**: primary studies not traced).

## 6. Building and running it

### 6.1 Data sources (fetched Sep 2026)
- **Free, stable:** football-data.co.uk CSVs 1993/94–2026/27 with results, shots, cards, opening and closing odds (no xG, no lineups); football-data.org free tier (fixtures/tables, 10 calls/min; lineups need €29/mo Deep Data); ClubElo daily CSV API (q12, q18).
- **Free but fragile/ToS-limited:** Understat (scrape-only xG back to 2014/15); FBref (xG removed Jan 2026, Sports Reference forbids building tools from scraped data); StatsBomb open data (non-commercial, 2015/16 PL only) (q12).
- **Paid:** API-Football $19–39/mo (lineups, injuries, xG, odds); Sportmonks €29/mo Starter (5 leagues), xG add-on €24, expected lineups €199; The Odds API free 500 credits/mo, $30 for 20K; Opta/StatsBomb commercial are quote-only ($500–1,000+/mo estimates) (q12).

### 6.2 Libraries
- **penaltyblog** (Python, v1.12.2, 2026-09-13) is the only actively maintained full-stack option: Poisson, Dixon-Coles, bivariate, negative binomial, Bayesian/hierarchical goal models, Elo, pi-ratings, de-vig tools, backtesting and scrapers; cannot take per-match covariates (q18).
- **soccerdata** (v1.9.1) for data access; **footBayes** (R, CRAN 2.0.0) for Stan-backed Bayesian models; goalmodel/regista (R, GitHub-only). Avoid footballdata (2017), worldfootballR (archived 2025), socceraction (event data, not prediction) (q18).

### 6.3 The weekend build
- Option A: penaltyblog Dixon-Coles on 3–5 seasons of football-data.co.uk with ξ ≈ 0.0018/day; Option B: ClubElo CSV + multinomial logit on rating difference (<100 lines). Both benchmark near the market (q19).
- Outage-resilient minimum: fixture list (home, away, kickoff) + historical goals and dates, available from three independent free sources; cache weekly; keep last week's ratings frozen as fallback; treat xG, lineups and odds as optional enrichments (q19).

### 6.4 Cadence, lead time, drift
- Lead time costs little: opening-line Brier 0.5747 vs closing 0.5734 over 5,286 matches; a goals model cannot predict line movement (r = −0.02). Publish Tue/Wed after ingest, refresh Fri after press conferences, optional T-60 lineup run; timestamp every version to score skill by lead time (q13).
- Refit ratings every matchday (seconds); re-tune ξ / calibration once per season. Monitor the *paired* model-minus-market RPS per match with CUSUM; a sustained 0.01 RPS decline takes ~100+ matches to detect, so also watch data-quality checks, which cause silent degradation more often than concept drift (q15).

### 6.5 Promoted teams, cold start, postponements
- Options: carry Championship-earned Elo (ClubElo does), assign relegated-team average (avoids rating inflation), or seed from Transfermarkt value; widen uncertainty for the first 6–10 rounds (q16 — **partial**: no source quantifies stabilisation time).
- 41.4% of PL fixtures 2021/22–2025/26 moved from their published date; key everything on fixture ID and actual kickoff datetime, re-pull fixtures before every run, and let date-based decay handle games in hand (q16).

## 7. Product surface

### 7.1 How incumbents present forecasts
- Probability-first (Opta supercomputer: three percentages from 10,000 sims, minimal methodology disclosure); scoreline-first pundit games (BBC Sutton, Sky Super 6); hybrid (Forebet: 1X2 % plus Poisson correct score). The most trusted product (FiveThirtyEight SPI) was the most transparent: probabilities, projected score, xG, top-10 scorelines, public methodology and calibration pages (q27 — **partial**: no football-specific engagement study).
- Election-forecast experiments show users over-read probabilities ("90%" = certainty) and disengage; percentages plus a most-likely scoreline satisfy both audiences (q27).

### 7.2 Deriving the displayed pick; the draw problem
- Argmax maximises expected accuracy but a model "correctly predicted only 2 draws out of 1,784"; show the draw probability alongside the pick so users see when it is high (q28).
- Displayed scoreline: mode of the score matrix (often 1-1 / 1-0) vs rounded expected goals; Forebet shows both the 1X2 pick and a separate most-probable score (q28).
- User-facing scoring: Super 6 (5 exact / 2 result), Superbru (3 exact / 1.5 close / 1 result); for a probabilistic score, Brier is the most explainable (0 perfect, 0.667 worst 3-way) (q28).

### 7.3 Defining a matchweek
- The PL schedules 38 numbered rounds (33 weekend + 5 midweek); premierleague.com labels each fixture with a matchweek that survives postponement; FPL gameweeks diverge after rescheduling; Super 6 curates six fixtures and voids postponed ones (q30 — **partial**).
- 2026/27: 21 Aug 2026 – 30 May 2027, merged Sep/Oct break 21 Sep–6 Oct, Nov 9–17, Mar 22–30; midweek MW13, 18, 25, 29 confirmed. Key each fixture to (season, matchweek, fixture id); score rescheduled games in their original matchweek; no official public API, but football-data.org exposes `matchday` (q30).

### 7.4 Legal
- UK: a free-to-enter prediction app, with or without prizes, is a prize competition needing no UKGC licence (Gambling Act 2005 s.11); paid entry converts it to pool betting unless an equally prominent free route exists; CAP Code section 16 applies to affiliate content and rule 16.3.12 bans "strong appeal" to under-18s (e.g. top-flight footballers) (q29).
- US: free-to-play falls under state sweepstakes law (registration/bonding above thresholds in FL, NY, RI); paid pick'em is treated as DFS and banned in several states. Google Play prohibits unapproved apps that "direct users to" gambling services, the main risk for affiliate links (q29). See Conflicts: *Are free prediction games legal everywhere in the US?*

## 8. Synthesis: recommended architecture for the app
- **Model:** time-weighted Dixon-Coles (independent Poisson is equivalent for 1X2) on 3–5 seasons, ξ ≈ 0.0018/day, league-level time-varying home advantage, promoted teams seeded from relegated-team average or Championship data (q05, q07, q08, q09, q16, q19).
- **Optional upgrade path:** (a) blend with de-vigged closing odds via The Odds API when licensed, expected to close most of the gap to the market (q17, q25); (b) Bayesian state-space / hierarchical model for early-season shrinkage and time-varying home advantage (q05, q26); (c) lineup or squad-value covariates for ~1–2% (q10).
- **Skip:** deep learning, LLM forecasters, xG-only ratings as a replacement for goals (q06, q23).
- **Evaluation:** walk-forward by matchweek over ≥5 seasons; RPS + log loss + Brier + reliability plots vs climatology and closing-odds baselines; paired per-match differences with bootstrap CIs (q11, q21, q22).
- **Ops:** matchday refit, Tue/Wed publish + Fri refresh, fixture-ID keyed storage, three-source data redundancy, CUSUM on paired score vs market (q13, q15, q16, q19).
- **Surface:** three probabilities + derived pick with its probability + most-likely score; report Brier and hit rate; matchweek keyed to official round; free-to-enter with no affiliate links unless the legal review is done (q27, q28, q29, q30).

## Conflicts & tensions

- **Dixon-Coles vs Elo ordering** — penaltyblog's Eredivisie backtest and Hubáček/Ley put time-weighted Poisson/DC ahead of Elo by 0.005–0.013 RPS (q05, q14) vs. footballproofai's 2022–2026 PL walk-forward putting Elo→multinomial logit ahead of sequential DC by 0.010 Brier (q15, q19). Why it matters: it decides the weekend build. Resolution: different leagues, windows and DC tunings (decay, promoted-team handling); the mattyorkilous review's point that feature engineering swings RPS ~0.08 vs ~0.01 for model class suggests either is fine if tuned. Settle by running both on the same PL walk-forward with paired tests.
- **RPS vs log (ignorance) score** — Constantinou & Fenton 2012 (ordered outcomes need a distance-sensitive score; RPS is the challenge standard) (q11) vs. Wheatcroft 2021 (only local scores use the available information; ignorance selects the better forecaster more often on 6,460 PL matches) (q11, q28). Why it matters: which metric the app optimises and reports. Resolution: report both; the literature has not converged.
- **Does low-score dependence exist?** — Own per-season ρ fits are noisy (−0.16 to +0.06) and change 1X2 RPS ≤ 0.0002; Ley et al. find bivariate covariance ≈ 0 (q07) vs. a 2026 Bayesian bivariate conditional Poisson study finding φ = −0.107 with a ~13-point ELPD gain (q07). Why it matters: whether to keep ρ. Resolution: the dependence is real for scoreline reproduction but irrelevant for 1X2; keep it only for correct-score outputs.
- **How big is the post-COVID home effect?** — Bryson et al. find the closed-door effect "not statistically significant" after matching; Benz & Lopez find heterogeneous league effects (q09) vs. raw PL data showing a 37.9% home-win floor in 2020/21 and a second dip to 40.8% in 2024/25, and a Bradley-Terry paper's η = 0.85 for 2023 that raw data contradict (q09). Why it matters: whether home advantage can be a constant. Resolution: the data favour a time-varying league-level parameter; the causal question about crowds is separate from the forecasting question.
- **Odds-informed models: profitable yet less accurate?** — Egidi et al. 2018 and Wilkens 2026 report positive simulated returns (q25, q24) vs. their own metrics showing the market better calibrated / more accurate (EPL 0.435 vs 0.452; Brier 0.63 vs 0.59) and Koopman & Lit finding no results-only model beats the bookmaker (q17, q25). Why it matters: whether "value" exists for a betting-adjacent product. Resolution: profit in these studies comes from decorrelation and price dispersion, not superior forecasts; treat reported ROI as unreliable without a closing-line test.
- **Shin vs power/multiplicative de-vigging** — Štrumbelj 2014: Shin beats normalisation on football RPS (q17, q24) vs. Berk 2024 and a 2026 EMH paper: power/multiplicative as good or better in low-margin markets (q17). Why it matters: a one-line implementation choice. Resolution: margins have fallen since Štrumbelj's data; use power method, and compare on your own odds feed.
- **Does lead time / team news matter?** — Opening vs closing Brier differs by ~0.2% and a goals model cannot predict line movement (q13) vs. Arntzen & Hvattum's significant lineup gain and affiliate claims of 5–15% odds swings (q10, q13). Why it matters: whether a T-60 lineup refresh is worth building. Resolution: the average effect is small, the tail effect (multiple key absences, rotation) is real; timestamp forecasts and measure it.
- **Feature engineering matters more than model class — or nothing matters much?** — mattyorkilous/pena.lt/y: a single feature change moved RPS 0.08 vs 0.01 for model class (q14, q19) vs. Fischer & Heuer: "the choice of features and model has only a minor influence" (q05, q10). Why it matters: where to spend effort. Resolution: both agree model class is minor; the 0.08 swing likely reflects a badly specified baseline feature, so expect small gains from good ratings and large losses from bad ones.
- **What is the draw rate?** — The question premise "~23%" and computed 2021–26 values 21.6–27.4% (q04) vs. Statista's range 18.7% (2018/19) to ~30% (early 2024/25) (q28). Why it matters: draw handling in the pick logic. Resolution: seasonal variation is real; the early-2024/25 figure is a mid-season snapshot.
- **"Bookmakers are ~54% accurate"** — generic multi-league figure (q03, 2017 challenge 51.9%) vs. PL favourite accuracy swinging 49.5–60.0% by season (q03, q20). Why it matters: a single-season hit rate is a poor KPI. Resolution: report per-season with baselines.
- **Hubáček 2019 as football evidence** — widely cited as beating the football market (q20) vs. it being an NBA study with decorrelation-based profit (q20). Why it matters: it underpins many "ML beats bookies" claims.
- **LLM competitiveness** — an unreadable OSF preprint snippet claims GPT-4 achieves "competitive accuracy" (q23) vs. arXiv 2608.05030 showing the LLM below the Dixon-Coles baseline on EPL 2025/26 and World Cup arenas at parity with consensus (q23).
- **Data pricing and availability** — third-party summaries of The Odds API ($29 Pro, NBA/MLB-only free), a €34/mo Sportmonks PL plan, and FBref as free xG (q12) vs. vendor pages fetched 2026-09-22 (free 500 credits all sports; no PL-only plan; xG removed Jan 2026). Resolution: vendor pages used.
- **Are free prediction games legal everywhere in the US?** — Wikipedia: "legal in all fifty states" (q29) vs. sweepstakes-law sources requiring registration/bonding in FL/NY/RI and strict-skill states (q29). Resolution: do not rely on the blanket claim.
- **2026/27 opening date** — Tottenham key-dates page (Sat 22 Aug) vs. premierleague.com/Wikipedia (Fri 21 Aug) (q30). Minor; premierleague.com is authoritative.

## Gaps / open questions

- **q06 (partial)** — No Premier-League-level peer-reviewed RPS/log-loss comparison of xG-based vs goals-based ratings; only a hobby replication with a CI crossing zero. Tried: Wunderlich/Memmert, Understat-based studies, blog comparisons.
- **q10 (partial)** — Lineup/injury feature value only at abstract level (Arntzen & Hvattum, Peeters behind 403s); no PL study quantifying injuries/suspensions in RPS terms.
- **q16 (partial)** — No source quantifies how many matches until a promoted team's rating stabilises; ClubElo promotion handling undocumented; the 6–10 round figure is inferred from practitioner exclusions.
- **q21 (partial)** — No published "N matches needed" for RPS comparisons; sample sizes are an own paired-t power calculation from football-data.co.uk RPS SDs.
- **q22 (partial)** — Leakage examples mostly from search snippets (Medium/Kaggle 403); the "99%" and "89.6%" claims in the 2024 review were not traced to primary studies; no source quantifies inflation from xG-with-future-info or table-position features.
- **q26 (partial)** — No head-to-head Bayesian hierarchical vs maximum-likelihood Dixon-Coles out-of-sample skill study found.
- **q27 (partial)** — No football-specific UX/engagement/trust study for match probabilities; evidence borrowed from betting-odds perception and election forecasts.
- **q30 (partial)** — Fifth midweek matchweek for 2025/26 and 2026/27 unconfirmed; Pulselive gameweek field is community-documented only; "postponed fixtures keep their matchweek label" is model-knowledge.
- **Structural gaps:** (1) FiveThirtyEight methodology and calibration pages are dead and the Wayback Machine was unreachable, so SPI details rest on the data README and secondary posts. (2) The 2023 Soccer Prediction Challenge leaderboard is image-only; its RPS values are as reported by Yeung et al. (3) Understat has no discoverable terms of use. (4) Maintenance-cost comparison of GBT vs DC pipelines is model-knowledge. (5) No study of forecast-skill decay per day of lead time exists for the PL. (6) Baboota & Kaur and Koopman & Lit numbers were read from snippets/PDF without a stable URL. (7) All LLM benchmarks found are World Cup 2026; none covers a full domestic season.
