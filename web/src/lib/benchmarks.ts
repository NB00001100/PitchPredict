/*
 * Reference figures for the hit-rate meter. All three are the share of
 * matches where the forecaster's most likely outcome was the actual result,
 * measured out of sample on the same 1,190 matches.
 *
 * Source: backtest_report.md at the repository root ("Overall" rows: model,
 * market, climatology). Update these together if the backtest is re-run.
 */

/** Number of past matches the reference figures were measured on. */
export const BACKTEST_MATCHES = 1190

/** This model's long-run top-pick accuracy in the walk-forward backtest, in %. */
export const MODEL_BACKTEST_PCT = 51.68

/** Accuracy of the bookmakers' closing odds on the same matches, in %. */
export const BOOKMAKERS_PCT = 54.62

/** Accuracy of always picking from historical base rates ("climatology"), in %. */
export const BASE_RATES_PCT = 42.86

/*
 * Mean ranked probability score (lower is better) on the same 1,190 matches.
 * Source: backtest_report.md at the repository root ("Overall" rows: model,
 * market, climatology). Long-run references, not this season's figures.
 */

/** This model's mean RPS in the walk-forward backtest. */
export const MODEL_BACKTEST_RPS = 0.2003

/** Mean RPS of the bookmakers' closing odds. */
export const BOOKMAKERS_RPS = 0.1943

/** Mean RPS of always forecasting the historical base rates. */
export const BASE_RATES_RPS = 0.2322

/**
 * The range of season hit rates, in %, that is consistent with the model's
 * long-run accuracy after `n` graded picks: a 95% interval around
 * MODEL_BACKTEST_PCT using the normal approximation to the binomial. Small
 * samples swing a lot; this says how much. Null when nothing is graded.
 */
export function expectedRange(n: number, pct = MODEL_BACKTEST_PCT): [number, number] | null {
  if (n <= 0) return null
  const p = pct / 100
  const half = 1.96 * Math.sqrt((p * (1 - p)) / n) * 100
  return [Math.max(0, pct - half), Math.min(100, pct + half)]
}

export interface Benchmark {
  id: 'model' | 'bookmakers' | 'base-rates'
  /** Short label for a mark on the meter. */
  label: string
  /** Longer description for text alternatives and footnotes. */
  description: string
  pct: number
}

/** The meter's reference marks, lowest first. */
export const BENCHMARKS: readonly Benchmark[] = [
  { id: 'base-rates', label: 'Base rates', description: 'Always picking from historical base rates', pct: BASE_RATES_PCT },
  { id: 'model', label: 'Model, long-run', description: 'Model, long-run backtest', pct: MODEL_BACKTEST_PCT },
  { id: 'bookmakers', label: 'Bookmakers', description: 'Bookmakers’ closing odds', pct: BOOKMAKERS_PCT },
]

/**
 * Where a season hit rate sits against what the model's long-run accuracy
 * predicts for that many picks: `none` before anything is graded.
 */
export type SeasonVerdict = 'none' | 'below' | 'within' | 'above'

export function seasonVerdict(pct: number | null, graded: number): SeasonVerdict {
  const range = expectedRange(graded)
  if (pct === null || !range) return 'none'
  if (pct < range[0]) return 'below'
  if (pct > range[1]) return 'above'
  return 'within'
}

/** Formats a percentage to one decimal place, dropping a trailing ".0": "51.7%", "48%". */
export function formatPct(pct: number): string {
  return `${Number(pct.toFixed(1))}%`
}
