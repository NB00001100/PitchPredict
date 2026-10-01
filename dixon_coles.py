"""
Dixon-Coles football model, fit from scratch by weighted maximum likelihood.

Model (home team i vs away team j):
    log(lambda) = attack_i - defense_j + home_adv      # expected home goals
    log(mu)     = attack_j - defense_i                 # expected away goals
    P(x, y)     = tau(x, y) * Poisson(x; lambda) * Poisson(y; mu)

with the Dixon-Coles low-score correction
    tau(0,0) = 1 - lambda*mu*rho
    tau(0,1) = 1 + lambda*rho
    tau(1,0) = 1 + mu*rho
    tau(1,1) = 1 - rho
    tau      = 1 otherwise

Parameters are found by minimising the time-weighted negative log-likelihood,
weight = exp(-xi * days_before_ref_date), with SLSQP, an analytic gradient and
the identifiability constraint sum(attack) = 0.

Optional Gaussian (ridge) prior on chosen teams. fit(df, priors={team: (a0, d0)})
with DixonColes(shrink=k > 0) minimises

    NLL + 0.5 * k * sum over teams t in priors of [(attack_t - a0_t)^2 + (defense_t - d0_t)^2]

i.e. a normal prior with variance 1/k on each listed team's attack and defense,
centred on (a0, d0). Teams not in `priors` are unpenalised. Its purpose is to
stop a team with only a handful of matches (a newly promoted side) running off
towards the rating bounds. With shrink = 0 or priors = None the fit is exactly
the plain maximum-likelihood fit. `self.nll` is always the data NLL alone; the
penalty at the optimum is stored separately in `self.penalty`.

Only numpy and scipy are used for the model; pandas is only used to read the
input DataFrame.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import gammaln

# tau is floored at this value before taking logs; where the floor is active the
# gradient of that match's log(tau) term is treated as zero.
_TAU_FLOOR = 1e-10

# Box bounds for the optimiser.
_RATING_BOUND = (-4.0, 4.0)     # attack / defense (log-scale)
_HOME_ADV_BOUND = (-1.0, 2.0)
_RHO_BOUND = (-0.5, 0.5)


def _to_utc_naive(values):
    """Convert a datetime Series/Timestamp to tz-naive UTC (naive input is assumed UTC)."""
    if isinstance(values, pd.Series):
        s = pd.to_datetime(values)
        if s.dt.tz is not None:
            s = s.dt.tz_convert("UTC").dt.tz_localize(None)
        return s
    ts = pd.Timestamp(values)
    if ts.tzinfo is not None:
        ts = ts.tz_convert("UTC").tz_localize(None)
    return ts


class DixonColes:
    """Dixon-Coles model with exponential time-decay weighting.

    Parameters
    ----------
    xi : float
        Per-day time-decay rate. A match d days before the reference date gets
        weight exp(-xi * d). xi = 0 weights all matches equally.
    shrink : float
        Strength of the Gaussian prior applied to the teams passed as `priors`
        to fit() (0 = no prior). Units: log-likelihood per squared log-rate.
        The curvature of the Poisson log-likelihood in a team's attack is
        roughly its (time-weighted) expected goals, so shrink = k acts roughly
        like k goals' worth of prior evidence at the prior centre.
    """

    def __init__(self, xi=0.0018, shrink=0.0):
        self.xi = float(xi)
        self.shrink = float(shrink)
        self.attack = {}
        self.defense = {}
        self.home_adv = None
        self.rho = None
        self.converged = False
        self.n_iter = None
        self.nll = None
        self.penalty = 0.0
        self.priors = {}
        self.teams = []

    # ------------------------------------------------------------------ #
    # Fitting
    # ------------------------------------------------------------------ #
    def _prepare(self, df, ref_date):
        """Turn the DataFrame into integer index arrays, goals and weights."""
        required = ["date", "home_team", "away_team", "home_goals", "away_goals"]
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise ValueError(f"df is missing required columns: {missing}")
        if len(df) == 0:
            raise ValueError("df is empty")

        if df[["home_goals", "away_goals"]].isna().any().any():
            raise ValueError("df contains matches with missing goals (unplayed fixtures?)")

        dates = _to_utc_naive(df["date"])
        ref = dates.max() if ref_date is None else _to_utc_naive(ref_date)

        # Fractional days before the reference date.
        days = ((ref - dates) / pd.Timedelta(days=1)).to_numpy(dtype=float)
        if (days < 0).any():
            n_after = int((days < 0).sum())
            raise ValueError(
                f"{n_after} match(es) are dated after ref_date ({ref}); "
                "filter them out before fitting"
            )
        weights = np.exp(-self.xi * days)

        # Integer team indices (sorted team list for reproducibility).
        teams = np.unique(np.concatenate([df["home_team"].to_numpy(dtype=object),
                                          df["away_team"].to_numpy(dtype=object)]))
        teams = sorted(teams.tolist())
        lookup = {t: k for k, t in enumerate(teams)}
        home_idx = df["home_team"].map(lookup).to_numpy(dtype=np.intp)
        away_idx = df["away_team"].map(lookup).to_numpy(dtype=np.intp)

        x = df["home_goals"].to_numpy(dtype=float)
        y = df["away_goals"].to_numpy(dtype=float)
        return teams, home_idx, away_idx, x, y, weights

    def _build_objective(self, n_teams, home_idx, away_idx, x, y, w, prior=None):
        """Return (f, grad) closures for the weighted negative log-likelihood.

        Parameter vector layout: [attack(n), defense(n), home_adv, rho].
        `prior` is None or (idx, a0, d0, shrink): integer team indices with their
        prior centres; adds 0.5*shrink*sum((attack-a0)^2 + (defense-d0)^2) to f.
        The data NLL alone at the last evaluated point is kept in cache["nll"].
        """
        n = n_teams
        # Masks for the four tau-corrected scorelines (fixed for the data set).
        m00 = (x == 0) & (y == 0)
        m01 = (x == 0) & (y == 1)
        m10 = (x == 1) & (y == 0)
        m11 = (x == 1) & (y == 1)
        # Constant log(x!) + log(y!) terms, so nll is a true NLL.
        const = float(np.sum(w * (gammaln(x + 1) + gammaln(y + 1))))

        # Cache the last evaluation: SLSQP calls fun and jac at the same point.
        cache = {"theta": None}

        def evaluate(theta):
            if cache["theta"] is not None and np.array_equal(theta, cache["theta"]):
                return cache["f"], cache["g"]

            attack = theta[:n]
            defense = theta[n:2 * n]
            home_adv, rho = theta[2 * n], theta[2 * n + 1]

            log_lam = attack[home_idx] - defense[away_idx] + home_adv
            log_mu = attack[away_idx] - defense[home_idx]
            lam = np.exp(log_lam)
            mu = np.exp(log_mu)

            # tau and its partial derivatives:
            #   dl_lam = lambda * d(tau)/d(lambda), dl_mu likewise, d_rho = d(tau)/d(rho)
            tau = np.ones_like(lam)
            dl_lam = np.zeros_like(lam)
            dl_mu = np.zeros_like(lam)
            d_rho = np.zeros_like(lam)

            lm = lam[m00] * mu[m00]
            tau[m00] = 1.0 - lm * rho
            dl_lam[m00] = -lm * rho
            dl_mu[m00] = -lm * rho
            d_rho[m00] = -lm

            tau[m01] = 1.0 + lam[m01] * rho
            dl_lam[m01] = lam[m01] * rho
            d_rho[m01] = lam[m01]

            tau[m10] = 1.0 + mu[m10] * rho
            dl_mu[m10] = mu[m10] * rho
            d_rho[m10] = mu[m10]

            tau[m11] = 1.0 - rho
            d_rho[m11] = -1.0

            # Guard against non-positive tau before log; zero gradient where clipped.
            clipped = tau <= _TAU_FLOOR
            tau_safe = np.where(clipped, _TAU_FLOOR, tau)
            inv_tau = np.where(clipped, 0.0, 1.0 / tau_safe)

            loglik = w * (x * log_lam - lam + y * log_mu - mu + np.log(tau_safe))
            f = -(float(loglik.sum()) - const)

            # d loglik / d log(lambda) and d loglik / d log(mu), per match, weighted.
            g_lam = w * (x - lam + dl_lam * inv_tau)
            g_mu = w * (y - mu + dl_mu * inv_tau)
            g_rho = float(np.sum(w * d_rho * inv_tau))

            # Chain rule onto the parameters via bincount (no Python loops).
            g_attack = (np.bincount(home_idx, g_lam, minlength=n)
                        + np.bincount(away_idx, g_mu, minlength=n))
            g_defense = -(np.bincount(away_idx, g_lam, minlength=n)
                          + np.bincount(home_idx, g_mu, minlength=n))
            g = -np.concatenate([g_attack, g_defense, [g_lam.sum(), g_rho]])
            nll = f

            if prior is not None:
                # Ridge penalty and its gradient (only the listed teams are touched).
                # shrink is in log-likelihood units per squared log-rate. The NLL's
                # curvature in a team's attack is roughly its weighted expected goals,
                # so shrink = k is worth roughly k goals of prior evidence.
                p_idx, a0, d0, k = prior
                da = attack[p_idx] - a0
                dd = defense[p_idx] - d0
                f = f + 0.5 * k * float(np.sum(da * da) + np.sum(dd * dd))
                g[p_idx] += k * da
                g[n + p_idx] += k * dd

            cache.update(theta=theta.copy(), f=f, g=g, nll=nll)
            return f, g

        self._objective_cache = cache
        return (lambda t: evaluate(t)[0]), (lambda t: evaluate(t)[1])

    def fit(self, df, ref_date=None, priors=None):
        """Fit the model.

        Parameters
        ----------
        df : DataFrame with columns date, home_team, away_team, home_goals, away_goals
        ref_date : date to measure time decay from (default: latest date in df).
            Naive and tz-aware values are both accepted (naive is taken as UTC).
        priors : optional dict team -> (attack_centre, defense_centre). Those
            teams' ratings get the Gaussian penalty with strength self.shrink.
            Teams not in df are ignored. No effect when self.shrink == 0.

        Returns
        -------
        self
        """
        teams, home_idx, away_idx, x, y, w = self._prepare(df, ref_date)
        n = len(teams)
        prior = None
        self.priors = {}
        if priors and self.shrink > 0:
            lookup = {t: k for k, t in enumerate(teams)}
            self.priors = {t: (float(c[0]), float(c[1])) for t, c in priors.items() if t in lookup}
            if self.priors:
                names = sorted(self.priors)
                prior = (np.array([lookup[t] for t in names], dtype=np.intp),
                         np.array([self.priors[t][0] for t in names]),
                         np.array([self.priors[t][1] for t in names]),
                         self.shrink)
        fun, jac = self._build_objective(n, home_idx, away_idx, x, y, w, prior)

        # Starting values: neutral ratings, typical home advantage and rho.
        theta0 = np.concatenate([np.zeros(n), np.zeros(n), [0.25, -0.05]])
        bounds = [_RATING_BOUND] * (2 * n) + [_HOME_ADV_BOUND, _RHO_BOUND]

        # Identifiability: sum(attack) = 0 (linear, so its jacobian is constant).
        con_jac = np.concatenate([np.ones(n), np.zeros(n + 2)])
        constraints = [{
            "type": "eq",
            "fun": lambda t: np.sum(t[:n]),
            "jac": lambda t: con_jac,
        }]

        res = minimize(fun, theta0, jac=jac, method="SLSQP", bounds=bounds,
                       constraints=constraints,
                       options={"maxiter": 500, "ftol": 1e-9})

        theta = res.x
        self.teams = list(teams)
        self.attack = {t: float(theta[k]) for k, t in enumerate(teams)}
        self.defense = {t: float(theta[n + k]) for k, t in enumerate(teams)}
        self.home_adv = float(theta[2 * n])
        self.rho = float(theta[2 * n + 1])
        self.converged = bool(res.success)
        self.n_iter = int(res.nit)
        if prior is None:
            self.nll = float(res.fun)
            self.penalty = 0.0
        else:
            jac(theta)                                   # make sure the cache is at res.x
            self.nll = float(self._objective_cache["nll"])
            self.penalty = float(res.fun) - self.nll
        self._opt_result = res
        return self

    # ------------------------------------------------------------------ #
    # Prediction
    # ------------------------------------------------------------------ #
    def predict(self, home, away, max_goals=10):
        """Score-probability matrix and 1X2 probabilities for one fixture.

        Goals 0..max_goals (inclusive) are considered for each side; the matrix
        is renormalised after the tau correction so it sums to 1.
        Ratings are read from self.attack / self.defense at call time.
        """
        for team in (home, away):
            if team not in self.attack or team not in self.defense:
                raise KeyError(f"Unknown team {team!r}: no attack/defense rating")
        if self.home_adv is None or self.rho is None:
            raise RuntimeError("Model has not been fitted")

        lam = float(np.exp(self.attack[home] - self.defense[away] + self.home_adv))
        mu = float(np.exp(self.attack[away] - self.defense[home]))
        rho = self.rho

        # Independent Poisson pmfs for 0..max_goals goals.
        g = np.arange(max_goals + 1)
        log_fact = gammaln(g + 1)
        p_home = np.exp(g * np.log(lam) - lam - log_fact)
        p_away = np.exp(g * np.log(mu) - mu - log_fact)
        M = np.outer(p_home, p_away)

        # Dixon-Coles correction on the 2x2 low-score corner.
        M[0, 0] *= 1.0 - lam * mu * rho
        M[0, 1] *= 1.0 + lam * rho
        M[1, 0] *= 1.0 + mu * rho
        M[1, 1] *= 1.0 - rho
        M = np.clip(M, 0.0, None)
        M /= M.sum()

        return {
            "home_win": float(np.tril(M, -1).sum()),   # home goals > away goals
            "draw": float(np.trace(M)),
            "away_win": float(np.triu(M, 1).sum()),    # home goals < away goals
            "exp_home_goals": lam,
            "exp_away_goals": mu,
            "score_matrix": M,
        }


# ---------------------------------------------------------------------- #
# Self-check on synthetic data
# ---------------------------------------------------------------------- #
if __name__ == "__main__":
    from scipy.stats import spearmanr

    rng = np.random.default_rng(42)
    n_teams = 20
    names = [f"Team{k:02d}" for k in range(n_teams)]
    true_attack = np.linspace(0.5, -0.5, n_teams)            # Team00 strongest
    true_defense = np.linspace(0.3, -0.3, n_teams) + rng.normal(0, 0.05, n_teams)
    true_attack -= true_attack.mean()
    true_home, true_rho = 0.25, -0.08

    # Two round-robins worth of fixtures (~760), trimmed to 600, one per day.
    pairs = [(i, j) for i in range(n_teams) for j in range(n_teams) if i != j]
    fixtures = [pairs[k] for k in rng.permutation(len(pairs))] * 2
    fixtures = fixtures[:600]

    rows = []
    start = pd.Timestamp("2024-08-01", tz="UTC")
    goals = np.arange(11)
    for d, (i, j) in enumerate(fixtures):
        lam = np.exp(true_attack[i] - true_defense[j] + true_home)
        mu = np.exp(true_attack[j] - true_defense[i])
        # Sample from the true Dixon-Coles distribution (truncated at 10 goals).
        P = np.outer(np.exp(goals * np.log(lam) - lam - gammaln(goals + 1)),
                     np.exp(goals * np.log(mu) - mu - gammaln(goals + 1)))
        P[0, 0] *= 1 - lam * mu * true_rho
        P[0, 1] *= 1 + lam * true_rho
        P[1, 0] *= 1 + mu * true_rho
        P[1, 1] *= 1 - true_rho
        P /= P.sum()
        cell = rng.choice(P.size, p=P.ravel())
        rows.append({"date": start + pd.Timedelta(hours=12 * d),
                     "home_team": names[i], "away_team": names[j],
                     "home_goals": cell // P.shape[1], "away_goals": cell % P.shape[1]})
    df = pd.DataFrame(rows)

    model = DixonColes(xi=0.0018).fit(df)
    print(f"matches: {len(df)}  converged: {model.converged}  iterations: {model.n_iter}  "
          f"nll: {model.nll:.3f}")
    print(f"home_adv: {model.home_adv:.4f} (true {true_home})")
    print(f"rho:      {model.rho:.4f} (true {true_rho})")
    print(f"{'team':<8} {'true_att':>9} {'fit_att':>9} {'true_def':>9} {'fit_def':>9}")
    for k, t in enumerate(names):
        print(f"{t:<8} {true_attack[k]:9.3f} {model.attack[t]:9.3f} "
              f"{true_defense[k]:9.3f} {model.defense[t]:9.3f}")

    fit_attack = np.array([model.attack[t] for t in names])
    rank_corr = spearmanr(true_attack, fit_attack).statistic
    print(f"Spearman rank correlation (attack, true vs fit): {rank_corr:.3f}")

    pred = model.predict("Team00", "Team19")
    total = pred["home_win"] + pred["draw"] + pred["away_win"]
    print("predict('Team00', 'Team19'):")
    for key in ("home_win", "draw", "away_win", "exp_home_goals", "exp_away_goals"):
        print(f"  {key}: {pred[key]:.4f}")
    print(f"  score_matrix shape: {pred['score_matrix'].shape}, top-left 3x3:")
    print(np.array2string(pred["score_matrix"][:3, :3], precision=4))
    print(f"  sum of 1X2 probabilities: {total:.6f}")

    assert model.converged, "optimiser did not converge"
    assert rank_corr > 0.8, f"rank correlation too low: {rank_corr:.3f}"
    assert abs(total - 1.0) < 1e-9, f"1X2 probabilities sum to {total}"
    print("All synthetic checks passed.")
