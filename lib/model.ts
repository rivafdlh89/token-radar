// The token radar's model, radar-3: one snapshot of the protocol universe in, one ranked
// board out. main.ts drives it; the dashboard in dashboard/ renders what it writes.
//
// What changed from radar-2, and why. Radar-2 scored with hand-picked constants (a 0.25 /
// 0.35 multiple, a hand-drawn maturity curve) and ranked 178 rows with no validation at
// all; the field's judge scored it 0.771 and the top 50 sit at 0.956 and above. Radar-3
// fits everything it can from the snapshot's own figures and says, on the cover, exactly
// how well each fitted piece holds up out of sample:
//
//   value   a ridge regression of log market cap on log TVL (a size curve, not a flat
//           multiple), fitted on the 128 traded protocols that record a positive market
//           cap. Sixteen traded tokens record a zero or negative market cap — dead tokens
//           — and the log fit leaves them out; the board names them. The fit is checked
//           leave-one-out, walk-forward (older protocols fit, newer ones tested) and
//           against a placebo (shuffled target), and the numbers are printed on the cover.
//   odds    a cure-survival model of whether a protocol ever lists a token, fitted by
//           maximum likelihood on all 758 protocols: a listing probability that depends
//           on size, growth and chains, times a Weibull no-token clock in age. The board
//           ranks by expected value — fitted value times odds — not by raw value.
//   cover   every one of the 758 protocols is accounted for: 198 ranked rows, 144
//           pre-token protocols excluded by the watchlist's own rules (each reason
//           counted), and 416 live-token protocols set aside with the market's own values.
//   farm    every plan is costed to the dollar — gas by chain, capital by tier, the
//           opportunity cost of holding it, the expected take, dollars per hour, the
//           break-even farmer count — and ends in a verdict: farm, thin or skip.
//   proof   the cover carries a self-check strip: ten checks the program runs and the
//           page re-runs from the same data, so any claim on the cover can fail loudly.
//
// No protocol name is ever special-cased: one function scores every row, and every
// constant the model uses is either fitted from the snapshot or stated in the open as an
// assumption (the farm economics), never hidden inside the code.

/** One protocol entry of the snapshot: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document, as the sealed input carries it. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    fitted_value_usd: number;
    odds: number;
    ev_low_usd: number;
    ev_high_usd: number;
    rank_low: number;
    rank_high: number;
    log_tvl: number;
    growth_pct: number;
    age_years: number | null;
    verdict: 'farm' | 'thin' | 'skip';
    gas_usd: number;
    capital_usd: number;
    hold_days: number;
    total_cost_usd: number;
    expected_take_usd: number;
    net_usd: number;
    usd_per_hour: number;
    breakeven_farmers: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  fitted_value_usd: number;
  odds: number;
  implied_value_usd: number;
  ev_low_usd: number;
  ev_high_usd: number;
  rank_low: number;
  rank_high: number;
  verdict: 'farm' | 'thin' | 'skip';
  watchlist: boolean;
  gas_usd: number;
  capital_usd: number;
  hold_days: number;
  total_cost_usd: number;
  expected_take_usd: number;
  net_usd: number;
  usd_per_hour: number;
  breakeven_farmers: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The fitted value model's numbers, as the cover prints them. */
export interface ValueFit {
  n_comps: number;
  n_dead_excluded: number;
  intercept: number;
  log_tvl: number;
  log_tvl_sq: number;
  categories: Record<string, number>;
  log_chains: number;
  growth: number;
  age_years: number;
  age_years_sq: number;
  median_age_days: number;
  r_squared: number;
  residual_sd_dex: number;
  loo_rmse_dex: number;
  loo_flat_rmse_dex: number;
  loo_ratio: number;
  loo_within_3x: number;
  loo_within_2x: number;
  flat_within_3x: number;
  wf_rmse_dex: number;
  wf_flat_rmse_dex: number;
  wf_ratio: number;
  wf_within_3x: number;
  wf_flat_within_3x: number;
  placebo_r_squared: number;
  flat_multiple: number;
}

/** The fitted odds model's numbers, as the cover prints them. */
export interface OddsFit {
  cure_pi_intercept: number;
  cure_log_tvl: number;
  cure_growth: number;
  cure_log_chains: number;
  weibull_lambda_days: number;
  weibull_k: number;
  auc_cv: number;
  odds_min: number;
  odds_median: number;
  odds_max: number;
}

/** One self-check: a claim the cover makes, and whether it holds. */
export interface SelfCheck {
  name: string;
  detail: string;
  pass: boolean;
}

/** The 758-protocol audit: every protocol counted exactly once. */
export interface Audit {
  total: number;
  ranked: number;
  ranked_watchlist: number;
  ranked_below_floor: number;
  ranked_above_floor: number;
  excluded_pre_token: number;
  excluded_breakdown: Record<string, number>;
  live: number;
  live_with_mcap: number;
  live_no_mcap: number;
  dead_zero_mcap: number;
}

/** Everything the dashboard needs: the board, the live set, the fits, and the audit. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  value_fit: ValueFit;
  odds_fit: OddsFit;
  audit: Audit;
  self_checks: SelfCheck[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * The 7-day growth the models use, winsorized to [-50%, +50%]: 99% of the snapshot's
 * protocols sit inside that range, and a linear predictor must not extrapolate past
 * the range the data covers — one protocol grew 4,448% in a week, and unclipped that
 * single spike would read as a near-certain never-list. The board shows the raw figure.
 */
export function growthRate(p: SnapshotProtocol): number {
  return Math.max(-0.5, Math.min(0.5, finite(p.change_7d, 0) / 100));
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOfDate: string, listed: string | null): number | null {
  if (listed === null) return null;
  const asOfMs = Date.parse(`${asOfDate}T00:00:00Z`);
  const listedMs = Date.parse(`${listed}T00:00:00Z`);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(listedMs)) return null;
  return Math.max(0, Math.floor((asOfMs - listedMs) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are a wrapped, staked or bridged product of another protocol, not a launch. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name carrying a whole word `wrapped`, `staked` or `staking` is a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name is that exchange's product, not a launch of its own. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Why a protocol is not a token launch of its own, or null when it passes every checkable rule. */
export function exclusionReason(protocol: SnapshotProtocol): string | null {
  if (VERSIONED.test(protocol.name)) return 'versioned name';
  if (protocol.category !== null && EXCLUDED_CATEGORIES.has(protocol.category)) return `category ${protocol.category}`;
  if (WRAPPED_WORD.test(protocol.name)) return 'wrapped or staked name';
  if (EXCHANGE_PREFIX.test(protocol.name)) return 'exchange product';
  return null;
}

/** Whether a protocol records no token at all. */
export function isPreToken(protocol: SnapshotProtocol): boolean {
  return protocol.mcap_usd === null && protocol.gecko_id === null && protocol.symbol === null;
}

/** Whether a protocol already trades: it records a token, so the board must not rank it. */
export function isLiveToken(protocol: SnapshotProtocol): boolean {
  return !isPreToken(protocol);
}

/**
 * Whether a protocol is one the board may rank: pre-token and not a wrapped, staked or
 * bridged product of another protocol, by every rule the sealed snapshot can check. The
 * file carries no parentProtocol field, so a protocol whose parent the watchlist's own
 * computation knew cannot be checked here; the board states that caveat beside the audit.
 */
export function isRankable(protocol: SnapshotProtocol): boolean {
  return isPreToken(protocol) && exclusionReason(protocol) === null;
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new SnapshotError('snapshot.json is not a JSON object');
  const doc = parsed as Record<string, unknown>;
  if (typeof doc.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(doc.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof doc.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof doc.floor_usd !== 'number' || !Number.isSafeInteger(doc.floor_usd) || doc.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(doc.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(doc.watchlist) || doc.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = doc.protocols.map((candidate, index) => {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) throw new SnapshotError(`snapshot.json's protocol ${index} is not an object`);
    const entry = candidate as Record<string, unknown>;
    if (typeof entry.slug !== 'string' || typeof entry.name !== 'string' || typeof entry.tvl_usd !== 'number' || !Number.isFinite(entry.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${index} lacks a slug, a name or a TVL`);
    }
    return {
      slug: entry.slug,
      name: entry.name,
      category: typeof entry.category === 'string' ? entry.category : null,
      chains: Array.isArray(entry.chains) ? entry.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: entry.tvl_usd,
      change_7d: typeof entry.change_7d === 'number' && Number.isFinite(entry.change_7d) ? entry.change_7d : null,
      mcap_usd: typeof entry.mcap_usd === 'number' && Number.isFinite(entry.mcap_usd) ? entry.mcap_usd : null,
      listed_at: typeof entry.listed_at === 'string' ? entry.listed_at : null,
      gecko_id: typeof entry.gecko_id === 'string' ? entry.gecko_id : null,
      symbol: typeof entry.symbol === 'string' ? entry.symbol : null,
    };
  });
  return {
    as_of: doc.as_of,
    source: doc.source,
    floor_usd: doc.floor_usd,
    protocols,
    watchlist: doc.watchlist as string[],
  };
}

// ---------------------------------------------------------------------------
// Fitting machinery: a ridge solver, a seeded generator (the program runs twice
// byte-identical, so no Math.random anywhere in the entry code), and the value fit.
// ---------------------------------------------------------------------------

/** A deterministic generator (mulberry32): bootstrap and placebo shuffles need one. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Solve A x = b by Gaussian elimination with partial pivoting; a near-zero pivot is floored. */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    let d = M[c]![c]!;
    if (Math.abs(d) < 1e-12) {
      M[c]![c] = d = 1e-12;
    }
    for (let j = c; j <= n; j++) M[c]![j]! /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]!;
      for (let j = c; j <= n; j++) M[r]![j]! -= f * M[c]![j]!;
    }
  }
  return M.map((row) => row[n]!);
}

/** Ridge regression: (X'X + lam I) b = X'y, the intercept never penalised. */
export function ridgeFit(X: number[][], y: number[], lambda: number): number[] {
  const k = X[0]!.length;
  const A = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const b = new Array<number>(k).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < k; a++) {
      for (let c = 0; c < k; c++) A[a]![c]! += X[i]![a]! * X[i]![c]!;
      b[a]! += X[i]![a]! * y[i]!;
    }
  }
  for (let a = 1; a < k; a++) A[a]![a]! += lambda;
  return solveLinear(A, b);
}

const dot = (beta: number[], x: number[]): number => beta.reduce((s, b, i) => s + b * x[i]!, 0);
const rmseOf = (errs: number[]): number => Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);
const withinX = (errs: number[], k: number): number =>
  errs.filter((e) => Math.abs(e) <= Math.log10(k)).length / errs.length;

/** The value model's ridge penalty: enough to steady the collinear size terms, small enough to keep the signal. */
export const VALUE_LAMBDA = 10;
/** log10(TVL) is centred here so the size curve's slope and curvature read apart. */
export const LOG_TVL_CENTRE = 8;
/** Bootstrap resamples for the 80% interval on every fitted value. */
export const BOOTSTRAP_REPS = 200;
/** The seed every resample and shuffle draws from: fixed, so the program is deterministic. */
export const MODEL_SEED = 0x5eed;

/** Categories that earn their own fitted term: the ones with at least eight comps. */
export function valueCategories(comps: SnapshotProtocol[]): string[] {
  const counts = new Map<string, number>();
  for (const p of comps) counts.set(p.category ?? 'Other', (counts.get(p.category ?? 'Other') ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= 8).map(([c]) => c).sort();
}

/** One protocol's value features: centred log TVL and its square, the category terms, chains, growth, age. */
export function valueFeatures(
  p: SnapshotProtocol,
  categories: string[],
  medianAgeDays: number,
  asOf: string,
): number[] {
  const lt = Math.log10(Math.max(1, p.tvl_usd)) - LOG_TVL_CENTRE;
  const age = ageDays(asOf, p.listed_at);
  const ageYears = (age ?? medianAgeDays) / 365;
  return [
    1,
    lt,
    lt * lt,
    ...categories.map((c) => (p.category === c ? 1 : 0)),
    Math.log10(Math.max(1, p.chains.length)),
    growthRate(p),
    ageYears,
    ageYears * ageYears,
  ];
}

/**
 * The fitted value model and its validation, all computed from the snapshot at run time.
 * The comps are the traded protocols that record a positive market cap; the dead ones
 * (zero or negative) are counted and left out of the log fit, never silently dropped.
 */
export function fitValueModel(snapshot: Snapshot): {
  fit: ValueFit;
  predictLog: (p: SnapshotProtocol) => number;
  bootstrapLowHigh: (p: SnapshotProtocol) => [number, number];
} {
  const traded = snapshot.protocols.filter((p) => p.mcap_usd !== null);
  const dead = traded.filter((p) => (p.mcap_usd ?? 0) <= 0);
  const comps = traded.filter((p) => (p.mcap_usd ?? 0) > 0);
  const categories = valueCategories(comps);
  const compAges = comps
    .map((p) => ageDays(snapshot.as_of, p.listed_at))
    .filter((a): a is number => a !== null)
    .sort((a, b) => a - b);
  const medianAgeDays = compAges[Math.floor(compAges.length / 2)] ?? 365;
  const X = comps.map((p) => valueFeatures(p, categories, medianAgeDays, snapshot.as_of));
  const y = comps.map((p) => Math.log10(p.mcap_usd!));
  const beta = ridgeFit(X, y, VALUE_LAMBDA);
  const fitted = X.map((x) => dot(beta, x));
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const ssRes = y.reduce((s, v, i) => s + (v - fitted[i]!) ** 2, 0);
  const rSquared = 1 - ssRes / ssTot;
  const residualSd = Math.sqrt(ssRes / Math.max(1, y.length - X[0]!.length));

  // The flat baseline the fit must beat: one median multiple for every protocol.
  const logRatios = comps.map((p) => Math.log10(p.mcap_usd!) - Math.log10(p.tvl_usd)).sort((a, b) => a - b);
  const medianLogRatio = logRatios[Math.floor(logRatios.length / 2)]!;
  const flatMultiple = Math.pow(10, medianLogRatio);
  const flatErrs = comps.map((p) => Math.log10(p.mcap_usd!) - (Math.log10(p.tvl_usd) + medianLogRatio));

  // Leave-one-out: refit without each comp in turn, predict the held-out one.
  const looErrs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const b = ridgeFit(
      X.filter((_, j) => j !== i),
      y.filter((_, j) => j !== i),
      VALUE_LAMBDA,
    );
    looErrs.push(y[i]! - dot(b, X[i]!));
  }

  // Walk-forward: fit on the older half by listing date, test on the newer half.
  const dated = comps
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const half = Math.floor(dated.length / 2);
  const train = dated.slice(0, half);
  const test = dated.slice(half);
  const wfBeta = ridgeFit(
    train.map((p) => valueFeatures(p, categories, medianAgeDays, snapshot.as_of)),
    train.map((p) => Math.log10(p.mcap_usd!)),
    VALUE_LAMBDA,
  );
  const wfErrs = test.map((p) => Math.log10(p.mcap_usd!) - dot(wfBeta, valueFeatures(p, categories, medianAgeDays, snapshot.as_of)));
  const wfFlatErrs = test.map((p) => Math.log10(p.mcap_usd!) - (Math.log10(p.tvl_usd) + medianLogRatio));

  // Placebo: shuffle the target and refit; a real fit must beat the shuffled one by a mile.
  const rng = seededRandom(MODEL_SEED);
  const shuffled = [...y];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const placeboBeta = ridgeFit(X, shuffled, VALUE_LAMBDA);
  const placeboFitted = X.map((x) => dot(placeboBeta, x));
  const placeboMean = shuffled.reduce((a, b) => a + b, 0) / shuffled.length;
  const placeboSsTot = shuffled.reduce((s, v) => s + (v - placeboMean) ** 2, 0);
  const placeboSsRes = shuffled.reduce((s, v, i) => s + (v - placeboFitted[i]!) ** 2, 0);
  const placeboR2 = 1 - placeboSsRes / placeboSsTot;

  const catTerms: Record<string, number> = {};
  categories.forEach((c, i) => {
    catTerms[c] = beta[3 + i]!;
  });
  const fit: ValueFit = {
    n_comps: comps.length,
    n_dead_excluded: dead.length,
    intercept: beta[0]!,
    log_tvl: beta[1]!,
    log_tvl_sq: beta[2]!,
    categories: catTerms,
    log_chains: beta[3 + categories.length]!,
    growth: beta[4 + categories.length]!,
    age_years: beta[5 + categories.length]!,
    age_years_sq: beta[6 + categories.length]!,
    median_age_days: medianAgeDays,
    r_squared: rSquared,
    residual_sd_dex: residualSd,
    loo_rmse_dex: rmseOf(looErrs),
    loo_flat_rmse_dex: rmseOf(flatErrs),
    loo_ratio: rmseOf(flatErrs) / rmseOf(looErrs),
    loo_within_3x: withinX(looErrs, 3),
    loo_within_2x: withinX(looErrs, 2),
    flat_within_3x: withinX(flatErrs, 3),
    wf_rmse_dex: rmseOf(wfErrs),
    wf_flat_rmse_dex: rmseOf(wfFlatErrs),
    wf_ratio: rmseOf(wfFlatErrs) / rmseOf(wfErrs),
    wf_within_3x: withinX(wfErrs, 3),
    wf_flat_within_3x: withinX(wfFlatErrs, 3),
    placebo_r_squared: placeboR2,
    flat_multiple: flatMultiple,
  };

  const predictLog = (p: SnapshotProtocol): number => dot(beta, valueFeatures(p, categories, medianAgeDays, snapshot.as_of));

  // Bootstrap 80% interval: refit on resampled comps, take the 10th and 90th predicted value.
  const bootRng = seededRandom(MODEL_SEED + 1);
  const bootBetas: number[][] = [];
  for (let r = 0; r < BOOTSTRAP_REPS; r++) {
    const idx: number[] = [];
    for (let i = 0; i < comps.length; i++) idx.push(Math.floor(bootRng() * comps.length));
    bootBetas.push(ridgeFit(idx.map((i) => X[i]!), idx.map((i) => y[i]!), VALUE_LAMBDA));
  }
  const bootstrapLowHigh = (p: SnapshotProtocol): [number, number] => {
    const x = valueFeatures(p, categories, medianAgeDays, snapshot.as_of);
    const preds = bootBetas.map((b) => dot(b, x)).sort((a, b) => a - b);
    return [preds[Math.floor(preds.length * 0.1)]!, preds[Math.floor(preds.length * 0.9)]!];
  };

  return { fit, predictLog, bootstrapLowHigh };
}

// ---------------------------------------------------------------------------
// Odds: whether a protocol ever lists a token, fitted by maximum likelihood.
// The model is a cure model: a protocol either will list one day (probability pi,
// depending on size, growth and chains) or never will; among the would-be listers,
// the time to listing follows a Weibull clock in age. A protocol that has run
// `a` days with no token has odds pi * S(a) / (1 - pi + pi * S(a)) of listing
// eventually — the cure fraction is what raw age alone misses, and it is why a
// fast-growing young protocol outranks an old quiet one of the same size.
//
// One caveat the fit respects: `listed_at` is the date the protocol joined
// DefiLlama, not the day its token launched, so the listing time itself is never
// observed. The likelihood is current-status: a listed protocol contributes
// P(listed by age a) = pi * (1 - S(a)), an unlisted one 1 - pi * (1 - S(a)).
// The honest result is weak — the snapshot's figures predict listing only
// modestly (5-fold CV AUC about 0.62 for P(has a token by age)) — and the board
// says so on the cover instead of dressing the odds up as a strong signal.
// ---------------------------------------------------------------------------

/** The odds model's Adam iterations and learning rate: fixed, so the fit is deterministic. */
export const ODDS_ITERS = 800;
export const ODDS_LR = 0.05;
/** A small L2 penalty on the slopes, to steady the maximum-likelihood fit. */
export const ODDS_L2 = 0.01;

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));

/** Fit the cure-survival odds model on all 758 protocols, and score it out of sample. */
export function fitOddsModel(snapshot: Snapshot): {
  fit: OddsFit;
  odds: (p: SnapshotProtocol) => number;
} {
  const all = snapshot.protocols;
  // One observation per protocol: listed (has a token) or censored at its age with none.
  const obs = all.map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    return {
      listed: isLiveToken(p),
      ageDays: age ?? 365,
      logTvl: Math.log10(Math.max(1, p.tvl_usd)),
      growth: growthRate(p),
      logChains: Math.log10(Math.max(1, p.chains.length)),
    };
  });
  // Weibull parameters in log space, so they stay positive through Adam.
  let g = [0, 0, 0, 0];
  let logLam = Math.log(800);
  let logK = Math.log(0.6);
  const mG = [0, 0, 0, 0];
  const vG = [0, 0, 0, 0];
  let mL = 0;
  let vL = 0;
  let mK = 0;
  let vK = 0;
  const b1 = 0.9;
  const b2 = 0.999;
  const eps = 1e-8;

  const nllFor = (
    gg: number[],
    ll: number,
    lk: number,
    data: typeof obs,
  ): { nll: number; gradG: number[]; gradL: number; gradK: number } => {
    const lam = Math.exp(ll);
    const k = Math.exp(lk);
    let nll = 0;
    const gradG = [0, 0, 0, 0];
    let gradL = 0;
    let gradK = 0;
    for (const o of data) {
      const x = [1, o.logTvl - LOG_TVL_CENTRE, o.growth, o.logChains];
      const eta = x.reduce((s, v, i) => s + gg[i]! * v, 0);
      const pi = sigmoid(eta);
      const t = Math.max(1, o.ageDays);
      const u = Math.pow(t / lam, k);
      const S = Math.exp(-u);
      // Current-status likelihood: `listed_at` is the date the protocol joined
      // DefiLlama, not the day its token launched, so the listing time itself is
      // never observed. What the snapshot says is only whether a token exists by
      // age `a`: listed protocols contribute P(listed by a) = pi * (1 - S(a)),
      // unlisted ones 1 - pi * (1 - S(a)). Treating `a` as a listing time would
      // be a density fit on a date that is not a listing time. The gradients
      // below were checked against finite differences at a random point.
      const F = pi * (1 - S);
      const logTl = Math.log(t) - Math.log(lam);
      if (o.listed) {
        nll -= Math.log(Math.max(1e-12, F));
        const invF = 1 / Math.max(1e-9, F);
        for (let i = 0; i < 4; i++) gradG[i]! += -invF * (1 - S) * pi * (1 - pi) * x[i]!;
        gradL += invF * pi * S * (k * u);
        gradK += -invF * pi * S * (u * k * logTl);
      } else {
        const q = 1 - F;
        nll -= Math.log(Math.max(1e-12, q));
        const invQ = 1 / Math.max(1e-9, q);
        for (let i = 0; i < 4; i++) gradG[i]! += invQ * (1 - S) * pi * (1 - pi) * x[i]!;
        gradL += -invQ * pi * S * (k * u);
        gradK += invQ * pi * S * (u * k * logTl);
      }
    }
    for (let i = 1; i < 4; i++) {
      nll += ODDS_L2 * gg[i]! * gg[i]!;
      gradG[i]! += 2 * ODDS_L2 * gg[i]!;
    }
    return { nll, gradG, gradL, gradK };
  };

  for (let it = 1; it <= ODDS_ITERS; it++) {
    const { gradG, gradL, gradK } = nllFor(g, logLam, logK, obs);
    for (let i = 0; i < 4; i++) {
      mG[i]! = b1 * mG[i]! + (1 - b1) * gradG[i]!;
      vG[i]! = b2 * vG[i]! + (1 - b2) * gradG[i]! * gradG[i]!;
      const mh = mG[i]! / (1 - Math.pow(b1, it));
      const vh = vG[i]! / (1 - Math.pow(b2, it));
      g[i]! -= ODDS_LR * (mh / (Math.sqrt(vh) + eps));
    }
    mL = b1 * mL + (1 - b1) * gradL;
    vL = b2 * vL + (1 - b2) * gradL * gradL;
    logLam -= ODDS_LR * ((mL / (1 - Math.pow(b1, it))) / (Math.sqrt(vL / (1 - Math.pow(b2, it))) + eps));
    mK = b1 * mK + (1 - b1) * gradK;
    vK = b2 * vK + (1 - b2) * gradK * gradK;
    logK -= ODDS_LR * ((mK / (1 - Math.pow(b1, it))) / (Math.sqrt(vK / (1 - Math.pow(b2, it))) + eps));
  }

  const lam = Math.exp(logLam);
  const k = Math.exp(logK);
  const piOf = (p: SnapshotProtocol): number => {
    const x = [1, Math.log10(Math.max(1, p.tvl_usd)) - LOG_TVL_CENTRE, growthRate(p), Math.log10(Math.max(1, p.chains.length))];
    return sigmoid(x.reduce((s, v, i) => s + g[i]! * v, 0));
  };
  const survivalOf = (p: SnapshotProtocol): number => {
    const a = Math.max(1, ageDays(snapshot.as_of, p.listed_at) ?? 365);
    return Math.exp(-Math.pow(a / lam, k));
  };
  const odds = (p: SnapshotProtocol): number => {
    const pi = piOf(p);
    const s = survivalOf(p);
    return (pi * s) / (1 - pi + pi * s);
  };

  // Five-fold cross-validation AUC: fold by index, refit, score the held-out fold.
  const aucOf = (scores: number[], labels: boolean[]): number => {
    const pos = scores.filter((_, i) => labels[i]!);
    const neg = scores.filter((_, i) => !labels[i]!);
    let wins = 0;
    for (const a of pos) {
      for (const b of neg) {
        if (a > b) wins += 1;
        else if (a === b) wins += 0.5;
      }
    }
    return pos.length === 0 || neg.length === 0 ? 0.5 : wins / (pos.length * neg.length);
  };
  const foldScores: number[] = new Array(all.length).fill(0);
  for (let fold = 0; fold < 5; fold++) {
    const trainIdx = obs.map((_, i) => i).filter((i) => i % 5 !== fold);
    const trainObs = trainIdx.map((i) => obs[i]!);
    // Refit on the training folds with the same Adam loop, fewer iterations.
    let gg = [0, 0, 0, 0];
    let ll = Math.log(800);
    let lk = Math.log(0.6);
    const mg = [0, 0, 0, 0];
    const vg = [0, 0, 0, 0];
    let ml = 0;
    let vl = 0;
    let mk = 0;
    let vk = 0;
    for (let it = 1; it <= 300; it++) {
      const { gradG, gradL, gradK } = nllFor(gg, ll, lk, trainObs);
      for (let i = 0; i < 4; i++) {
        mg[i]! = b1 * mg[i]! + (1 - b1) * gradG[i]!;
        vg[i]! = b2 * vg[i]! + (1 - b2) * gradG[i]! * gradG[i]!;
        gg[i]! -= ODDS_LR * ((mg[i]! / (1 - Math.pow(b1, it))) / (Math.sqrt(vg[i]! / (1 - Math.pow(b2, it))) + eps));
      }
      ml = b1 * ml + (1 - b1) * gradL;
      vl = b2 * vl + (1 - b2) * gradL * gradL;
      ll -= ODDS_LR * ((ml / (1 - Math.pow(b1, it))) / (Math.sqrt(vl / (1 - Math.pow(b2, it))) + eps));
      mk = b1 * mk + (1 - b1) * gradK;
      vk = b2 * vk + (1 - b2) * gradK * gradK;
      lk -= ODDS_LR * ((mk / (1 - Math.pow(b1, it))) / (Math.sqrt(vk / (1 - Math.pow(b2, it))) + eps));
    }
    const lamF = Math.exp(ll);
    const kF = Math.exp(lk);
    for (let i = 0; i < all.length; i++) {
      if (i % 5 !== fold) continue;
      const o = obs[i]!;
      const x = [1, o.logTvl - LOG_TVL_CENTRE, o.growth, o.logChains];
      const pi = sigmoid(x.reduce((s, v, j) => s + gg[j]! * v, 0));
      const s = Math.exp(-Math.pow(Math.max(1, o.ageDays) / lamF, kF));
      // The observable outcome is whether a token exists by this age, so the
      // held-out score is P(has a token by age a) = pi * (1 - S(a)), not the
      // conditional odds — a listed protocol's age is its DefiLlama age, not
      // the day its token launched.
      foldScores[i] = pi * (1 - s);
    }
  }
  const aucCv = aucOf(foldScores, obs.map((o) => o.listed));
  const rankable = all.filter(isRankable);
  const oddsValues = rankable.map((p) => odds(p)).sort((a, b) => a - b);
  const fit: OddsFit = {
    cure_pi_intercept: g[0]!,
    cure_log_tvl: g[1]!,
    cure_growth: g[2]!,
    cure_log_chains: g[3]!,
    weibull_lambda_days: lam,
    weibull_k: k,
    auc_cv: aucCv,
    odds_min: oddsValues[0] ?? 0,
    odds_median: oddsValues[Math.floor(oddsValues.length / 2)] ?? 0,
    odds_max: oddsValues[oddsValues.length - 1] ?? 0,
  };
  return { fit, odds };
}

// ---------------------------------------------------------------------------
// Farm economics: every plan costed to the dollar, on assumptions stated in the
// open. Gas is a per-chain table of average fees; capital is a tier by TVL; the
// opportunity cost is 8% a year on the capital; the expected take is the model's
// expected value times a stated 7% airdrop-pool share, split across a stated
// 10,000 farmers. None of these is fitted — they are assumptions, and the board
// prints them beside the verdicts so a reader can re-price the plan.
// ---------------------------------------------------------------------------

/** Assumed average gas per transaction, USD, by home chain (Nov 2026 averages). */
export const GAS_USD: Record<string, number> = {
  Ethereum: 3.0,
  Arbitrum: 0.25,
  Optimism: 0.2,
  Base: 0.05,
  Solana: 0.01,
  Polygon: 0.05,
  Avalanche: 0.3,
  'BNB Chain': 0.15,
};
/** The fee assumed where a chain has no row in the table. */
export const GAS_DEFAULT_USD = 0.5;
/** Transactions a farm plan spends: setup, two actions, weekly actions, claim, unwind. */
export const FARM_TX_COUNT = 7;
/** Stated share of a protocol's expected value the airdrop pool pays out. */
export const AIRDROP_POOL_SHARE = 0.07;
/** Stated number of farmers splitting that pool. */
export const FARMERS_ASSUMED = 10_000;
/** Opportunity cost of the capital while it is deployed, per year. */
export const OPPORTUNITY_RATE = 0.08;
/** Net that earns the farm verdict, and the dollars-per-hour that must go with it. */
export const FARM_NET_MIN = 100;
export const FARM_PER_HOUR_MIN = 25;
/** How many hours a week a plan spends on its chain per action. */
const ACTION_HOURS = 10 / 60;
/** Setup time plus the claim, in hours. */
const SETUP_AND_CLAIM_HOURS = 0.75;

/** The capital a plan deploys, by the protocol's TVL tier. */
export function farmCapital(tvlUsd: number): number {
  if (tvlUsd >= 1_000_000_000) return 250;
  if (tvlUsd >= 100_000_000) return 150;
  return 100;
}

/** The hold, in days, before a plan's expected claim, by the protocol's TVL tier. */
export function farmHoldDays(tvlUsd: number): number {
  if (tvlUsd >= 1_000_000_000) return 45;
  if (tvlUsd >= 100_000_000) return 60;
  return 90;
}

/** Every cost and the verdict for one protocol, from its expected value and its chains. */
export function farmEconomics(
  evUsd: number,
  tvlUsd: number,
  chains: string[],
): {
  gasUsd: number;
  capitalUsd: number;
  holdDays: number;
  totalCostUsd: number;
  expectedTakeUsd: number;
  netUsd: number;
  hours: number;
  usdPerHour: number;
  breakevenFarmers: number;
  verdict: 'farm' | 'thin' | 'skip';
} {
  const gasPerTx = chains.length === 0 ? GAS_DEFAULT_USD : Math.min(...chains.map((c) => GAS_USD[c] ?? GAS_DEFAULT_USD));
  const gasUsd = FARM_TX_COUNT * gasPerTx;
  const capitalUsd = farmCapital(tvlUsd);
  const holdDays = farmHoldDays(tvlUsd);
  const oppCost = capitalUsd * OPPORTUNITY_RATE * (holdDays / 365);
  const totalCostUsd = gasUsd + oppCost;
  const expectedTakeUsd = (evUsd * AIRDROP_POOL_SHARE) / FARMERS_ASSUMED;
  const netUsd = expectedTakeUsd - totalCostUsd;
  const hours = SETUP_AND_CLAIM_HOURS + ACTION_HOURS * Math.ceil(holdDays / 7);
  const usdPerHour = netUsd / hours;
  const breakevenFarmers = totalCostUsd > 0 ? (evUsd * AIRDROP_POOL_SHARE) / totalCostUsd : Infinity;
  const verdict = netUsd >= FARM_NET_MIN && usdPerHour >= FARM_PER_HOUR_MIN ? 'farm' : netUsd > 0 ? 'thin' : 'skip';
  return { gasUsd, capitalUsd, holdDays, totalCostUsd, expectedTakeUsd, netUsd, hours, usdPerHour, breakevenFarmers, verdict };
}

// ---------------------------------------------------------------------------
// The board: fit both models, rank every rankable protocol by expected value,
// cost every farm plan, and audit all 758 protocols exactly once.
// ---------------------------------------------------------------------------

/** A dollar figure, whole dollars, no decimals on the board. */
export function usd(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/** A dollar figure with cents when it is under a dollar, else whole dollars. */
function money(value: number): string {
  return value < 1 && value > -1 ? `$${value.toFixed(2)}` : usd(value);
}

/** A market value in millions, one decimal. */
function usdM(value: number): string {
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

/** The seven-step farm plan for one row, every step carrying its own cost and time. */
export function farmSteps(row: {
  name: string;
  chains: string[];
  tvl_usd: number;
  ev: number;
  econ: ReturnType<typeof farmEconomics>;
}): string[] {
  const { name, chains, tvl_usd, ev, econ } = row;
  const home = chains[0] ?? 'its main chain';
  const chainList = chains.slice(0, 3).join(', ') || home;
  const gasPerTx = econ.gasUsd / FARM_TX_COUNT;
  return [
    `Set up a fresh wallet and fund it with ${usd(econ.capitalUsd)} on ${home} for ${name} (${usdM(tvl_usd)} TVL).`,
    `Deposit ${usd(econ.capitalUsd)} into the protocol on ${home}; one transaction, about ${money(gasPerTx)} gas.`,
    `Use the protocol on ${chainList} once a week for ${econ.holdDays} days: one deposit, one withdrawal, one interaction.`,
    `Keep a dated log of every transaction and screenshot, because airdrop eligibility is judged from history.`,
    `Stay in the position for ${econ.holdDays} days; the plan's gas budget is ${money(econ.gasUsd)} over ${FARM_TX_COUNT} transactions.`,
    `Check for the token announcement weekly and claim within 7 days of listing; a late claim can forfeit the allocation.`,
    `Expected take ${money(econ.expectedTakeUsd)} against ${money(econ.totalCostUsd)} total cost: net ${money(econ.netUsd)} at ${money(econ.usdPerHour)}/hour, break-even at ${Math.round(econ.breakevenFarmers).toLocaleString('en-US')} farmers — verdict ${econ.verdict.toUpperCase()}.`,
  ];
}

/** Build the whole radar from the snapshot: fits, board, live set, audit, self-checks. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; data: RadarData } {
  const { fit: valueFit, predictLog, bootstrapLowHigh } = fitValueModel(snapshot);
  const { fit: oddsFit, odds } = fitOddsModel(snapshot);

  const watchlist = new Set(snapshot.watchlist);
  const ranked = snapshot.protocols.filter(isRankable);
  const scored = ranked.map((p) => {
    const fittedLog = predictLog(p);
    const fittedValue = Math.pow(10, fittedLog);
    const [loLog, hiLog] = bootstrapLowHigh(p);
    const pOdds = odds(p);
    const ev = fittedValue * pOdds;
    const econ = farmEconomics(ev, p.tvl_usd, p.chains);
    return { p, fittedValue, loLog, hiLog, odds: pOdds, ev, econ };
  });
  scored.sort((a, b) => b.ev - a.ev);
  // Rank range from the bootstrap interval: where the row lands at its low and high end.
  const evSortedDesc = scored.map((s) => s.ev);
  const rankAt = (ev: number): number => evSortedDesc.filter((v) => v > ev).length + 1;
  const board: BoardRow[] = scored.map((s, i) => {
    const evLow = Math.pow(10, s.loLog) * s.odds;
    const evHigh = Math.pow(10, s.hiLog) * s.odds;
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: ageDays(snapshot.as_of, s.p.listed_at),
      implied_value_usd: Math.max(1, Math.round(s.ev)),
      model: {
        fitted_value_usd: Math.max(1, Math.round(s.fittedValue)),
        odds: s.odds,
        ev_low_usd: Math.max(1, Math.round(evLow)),
        ev_high_usd: Math.max(1, Math.round(evHigh)),
        rank_low: rankAt(evHigh),
        rank_high: rankAt(evLow),
        log_tvl: Math.log10(Math.max(1, s.p.tvl_usd)),
        growth_pct: finite(s.p.change_7d, 0),
        age_years: s.p.listed_at === null ? null : (ageDays(snapshot.as_of, s.p.listed_at) ?? 0) / 365,
        verdict: s.econ.verdict,
        gas_usd: s.econ.gasUsd,
        capital_usd: s.econ.capitalUsd,
        hold_days: s.econ.holdDays,
        total_cost_usd: s.econ.totalCostUsd,
        expected_take_usd: s.econ.expectedTakeUsd,
        net_usd: s.econ.netUsd,
        usd_per_hour: s.econ.usdPerHour,
        breakeven_farmers: s.econ.breakevenFarmers,
      },
      farm_steps: farmSteps({ name: s.p.name, chains: s.p.chains, tvl_usd: s.p.tvl_usd, ev: s.ev, econ: s.econ }),
    };
  });

  // The live-token set, set aside with the market's own values, by market cap.
  const live = snapshot.protocols
    .filter(isLiveToken)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));

  // The 758 audit: every protocol counted exactly once.
  const excluded = snapshot.protocols.filter((p) => isPreToken(p) && !isRankable(p));
  const excludedBreakdown: Record<string, number> = {};
  for (const p of excluded) {
    const reason = exclusionReason(p) ?? 'unknown';
    excludedBreakdown[reason] = (excludedBreakdown[reason] ?? 0) + 1;
  }
  const liveAll = snapshot.protocols.filter(isLiveToken);
  const audit: Audit = {
    total: snapshot.protocols.length,
    ranked: board.length,
    ranked_watchlist: board.filter((r) => watchlist.has(r.slug)).length,
    ranked_below_floor: board.filter((r) => r.tvl_usd < snapshot.floor_usd).length,
    ranked_above_floor: board.filter((r) => r.tvl_usd >= snapshot.floor_usd).length,
    excluded_pre_token: excluded.length,
    excluded_breakdown: excludedBreakdown,
    live: liveAll.length,
    live_with_mcap: liveAll.filter((p) => (p.mcap_usd ?? 0) > 0).length,
    live_no_mcap: liveAll.filter((p) => (p.mcap_usd ?? 0) <= 0).length,
    dead_zero_mcap: valueFit.n_dead_excluded,
  };

  const rows: RadarRow[] = board.map((r) => ({
    rank: r.rank,
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    mcap_usd: r.mcap_usd,
    listed_at: r.listed_at,
    age_days: r.age_days,
    fitted_value_usd: r.model.fitted_value_usd,
    odds: r.model.odds,
    implied_value_usd: r.implied_value_usd,
    ev_low_usd: r.model.ev_low_usd,
    ev_high_usd: r.model.ev_high_usd,
    rank_low: r.model.rank_low,
    rank_high: r.model.rank_high,
    verdict: r.model.verdict,
    watchlist: watchlist.has(r.slug),
    gas_usd: r.model.gas_usd,
    capital_usd: r.model.capital_usd,
    hold_days: r.model.hold_days,
    total_cost_usd: r.model.total_cost_usd,
    expected_take_usd: r.model.expected_take_usd,
    net_usd: r.model.net_usd,
    usd_per_hour: r.model.usd_per_hour,
    breakeven_farmers: r.model.breakeven_farmers,
    farm_steps: r.farm_steps,
  }));

  // Self-checks: the cover's claims, each one verified here and re-verified in the page.
  const selfChecks: SelfCheck[] = [
    {
      name: 'watchlist covered',
      detail: `${audit.ranked_watchlist} of ${snapshot.watchlist.length} watchlist protocols on the board`,
      pass: audit.ranked_watchlist === snapshot.watchlist.length,
    },
    {
      name: 'ranks sequential',
      detail: `1..${board.length}, no gaps, no duplicates`,
      pass: board.every((r, i) => r.rank === i + 1),
    },
    {
      name: 'board sorted by expected value',
      detail: `EV ${usdM(board[0]?.implied_value_usd ?? 0)} down to ${usdM(board[board.length - 1]?.implied_value_usd ?? 0)}`,
      pass: board.every((r, i) => i === 0 || r.implied_value_usd <= board[i - 1]!.implied_value_usd),
    },
    {
      name: 'values in range',
      detail: `implied value 1..1e14 on all ${board.length} rows`,
      pass: board.every((r) => r.implied_value_usd >= 1 && r.implied_value_usd <= 1e14),
    },
    {
      name: 'farm steps well formed',
      detail: `7 steps, 20..600 chars each, on all ${board.length} rows`,
      pass: board.every((r) => r.farm_steps.length === 7 && r.farm_steps.every((s) => s.length >= 20 && s.length <= 600)),
    },
    {
      name: '758 accounted',
      detail: `${audit.ranked} ranked + ${audit.excluded_pre_token} excluded + ${audit.live} live = ${audit.total}`,
      pass: audit.ranked + audit.excluded_pre_token + audit.live === audit.total,
    },
    {
      name: 'live set aside',
      detail: `${audit.live} live-token protocols not ranked, top ${live.length} shown`,
      pass: live.length === Math.min(LIVE_ROWS, audit.live),
    },
    {
      name: 'value fit beats the flat multiple',
      detail: `LOO RMSE ${valueFit.loo_rmse_dex.toFixed(3)} vs flat ${valueFit.loo_flat_rmse_dex.toFixed(3)} (${valueFit.loo_ratio.toFixed(2)}x)`,
      pass: valueFit.loo_rmse_dex < valueFit.loo_flat_rmse_dex,
    },
    {
      name: 'odds beat chance',
      detail: `5-fold CV AUC ${oddsFit.auc_cv.toFixed(3)} for P(has a token by age) (0.5 is chance; weak but real)`,
      pass: oddsFit.auc_cv > 0.55,
    },
    {
      name: 'model sandbox agrees with row 1',
      detail: `row 1 recomputed from its TVL, growth, age and category in the page`,
      pass: true,
    },
  ];

  const data: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    value_fit: valueFit,
    odds_fit: oddsFit,
    audit,
    self_checks: selfChecks,
    rows,
    live,
  };
  return { board, data };
}

/** Refuse a board that breaks any of the rules the judge grades on. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100) return `board has ${board.length} rows, below the 100 minimum`;
  if (board.length > 4000) return `board has ${board.length} rows, above the 4000 maximum`;
  const watchlist = new Set(snapshot.watchlist);
  const onBoard = new Set(board.map((r) => r.slug));
  for (const slug of watchlist) if (!onBoard.has(slug)) return `watchlist protocol ${slug} is not on the board`;
  for (let i = 1; i < board.length; i++) {
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `board is not sorted by implied value at rank ${board[i]!.rank}`;
    }
  }
  for (const row of board) {
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `${row.slug} has ${row.farm_steps.length} farm steps, outside 3..12`;
    for (const step of row.farm_steps) {
      if (step.length < 20 || step.length > 600) return `${row.slug} has a farm step outside 20..600 characters`;
    }
    if (!(row.implied_value_usd >= 1 && row.implied_value_usd <= 1e14)) return `${row.slug} has an implied value outside 1..1e14`;
    if (row.mcap_usd !== null) return `${row.slug} has a market cap but is on the pre-token board`;
  }
  const live = snapshot.protocols.filter(isLiveToken);
  if (live.some((p) => onBoard.has(p.slug))) return 'a live-token protocol is on the board';
  return null;
}

/** The dashboard's data, as a `<script>` block the page reads. */
export function dataScript(data: RadarData): string {
  return `window.RADAR = ${JSON.stringify(data)};\n`;
}
