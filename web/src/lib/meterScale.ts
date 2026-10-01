/**
 * The window of the hit-rate meter, in %. The meter shows positions (a
 * needle, reference ticks, a bracket), not a filled bar, so it may start
 * above zero. It always covers 30–70% (where every reference figure sits)
 * and widens in steps of 10 to take in the season figure and the whole
 * expected range, which is wide early in a season.
 */
export function meterDomain(pct: number | null, range: readonly [number, number] | null): [number, number] {
  const values = [30, 70]
  if (pct !== null) values.push(pct)
  if (range) values.push(range[0], range[1])
  const lo = Math.max(0, Math.floor(Math.min(...values) / 10) * 10)
  const hi = Math.min(100, Math.ceil(Math.max(...values) / 10) * 10)
  return [lo, hi]
}

/** Position of `pct` along a domain, as a percentage of the meter's width (clamped 0–100). */
export function meterPosition(pct: number, [lo, hi]: readonly [number, number]): number {
  if (hi <= lo) return 0
  return Math.min(100, Math.max(0, ((pct - lo) / (hi - lo)) * 100))
}

/** Tick values every `step` points across a domain, ends included. */
export function meterTicks([lo, hi]: readonly [number, number], step = 10): number[] {
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)
  return ticks
}

/**
 * A domain covering every value plus `pad`, snapped outwards to multiples of
 * `step`, and never narrower than `[min, max]`. For position scales such as
 * the RPS strip, where the subset on screen can sit anywhere.
 */
export function niceDomain(values: readonly number[], step: number, [min, max]: readonly [number, number], pad = 0): [number, number] {
  const lo = Math.min(min, ...values.map((v) => v - pad))
  const hi = Math.max(max, ...values.map((v) => v + pad))
  // The epsilon keeps floating-point noise (0.18 / 0.02 = 8.999…) from pushing an edge out a step.
  const down = Math.floor(lo / step + 1e-9) * step
  const up = Math.ceil(hi / step - 1e-9) * step
  return [Number(down.toFixed(6)), Number(up.toFixed(6))]
}
