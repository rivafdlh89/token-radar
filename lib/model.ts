// The token radar's model, radar-2: one snapshot of the protocol universe in, one ranked
// board out. main.ts drives it; the dashboard in dashboard/ renders what it writes.
//
// What the board holds. The watchlist is the floor, never a ceiling: every slug in the
// snapshot's watchlist is ranked. Below the watchlist floor, the early radar adds every
// pre-token protocol that passes the watchlist's own exclusion rules. A protocol counts as
// pre-token when its index entry records no token at all — no market cap, no CoinGecko id,
// no symbol. The snapshot's live-token protocols are kept apart and shown with the market's
// own values, never mixed into the ranked board.
//
// Which rules exclude a row. They are the watchlist's own, taken from the snapshot's field
// guide and applied to every row, not just to the watchlist: a name ending in a version
// marker is a pool of another protocol; a Bridge, Canonical Bridge, Liquid Staking, Liquid
// Restaking, Restaked BTC or CEX category is a wrapped, staked or bridged product, not a
// launch of its own; a name carrying a whole word `wrapped`, `staked` or `staking`, or one
// beginning with an exchange's name, is the same. The field guide's parent-protocol rule
// cannot be checked from the sealed file — the snapshot carries no parentProtocol field —
// but the watchlist list itself already embodies it, and the early radar applies every rule
// the file can check. On this snapshot the rules leave out 39 of the starter's top 160
// early rows: bridges, liquid-staking receipts and staking products that are not token
// launches. Radar-2 keeps 138 early rows.
//
// How implied value is scored. Only the snapshot's own figures go in:
//
//   base       = tvl_usd x category_multiple   (0.35 for capital-efficient categories, 0.25 otherwise)
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT
//   maturity   = 0.6 + 0.4 x f(age_days)        f climbs 0 to 1 over the first year, holds 1
//                                              through year 3, then decays toward 0.25 — a
//                                              protocol that has run four years with no token
//                                              is less, not more, likely to launch one next
//   breadth    = 1 + min(chains - 1, 4) x 0.05  (up to 1.20x for a protocol live on five chains or more)
//   implied    = max(1, round(base x growthMult x maturity x breadth))
//
// The constants are the model's own, stated in the dashboard and changeable in its sandbox.
// No protocol name is ever special-cased: one function scores every row.

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

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  category_multiple_high: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_rise_days: number;
  maturity_peak_days: number;
  maturity_decay_days: number;
  maturity_decay_floor: number;
  breadth_step: number;
  breadth_cap_steps: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  category_multiple_high: 0.35,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_rise_days: 365,
  maturity_peak_days: 1095,
  maturity_decay_days: 1460,
  maturity_decay_floor: 0.25,
  breadth_step: 0.05,
  breadth_cap_steps: 4,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/**
 * Categories whose token captures more value per TVL dollar: they earn fees on large
 * notional with comparatively little capital locked (lending, debt, derivatives,
 * real-world assets).
 */
export const CAPITAL_EFFICIENT_CATEGORIES = new Set([
  'Lending',
  'Uncollateralized Lending',
  'CDP',
  'CDP Manager',
  'Collateral Management',
  'Collateral Markets',
  'Derivatives',
  'Interest Rate Derivatives',
  'Options',
  'RWA',
  'Basis Trading',
]);

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
    base_multiple: number;
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
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
  implied_value_usd: number;
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  watchlist: boolean;
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

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  excluded_early: number;
  excluded_breakdown: Record<string, number>;
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
 * bridged product of another protocol, by every rule the sealed snapshot can check.
 */
export function isRankable(protocol: SnapshotProtocol): boolean {
  return isPreToken(protocol) && exclusionReason(protocol) === null;
}

/** The category multiple: 0.35 for capital-efficient categories, the base multiple otherwise. */
export function categoryMultiple(protocol: SnapshotProtocol, model: ModelConstants): number {
  return protocol.category !== null && CAPITAL_EFFICIENT_CATEGORIES.has(protocol.category)
    ? model.category_multiple_high
    : model.base_multiple;
}

/** A protocol's 7-day change, clamped into the model's growth window. */
export function clampGrowth(raw: number, model: ModelConstants): number {
  return Math.min(model.growth_cap, Math.max(model.growth_floor, raw));
}

/**
 * The maturity curve's rise-and-fall factor: 0 at listing, climbing to 1 over the first
 * year, holding 1 through year three, then decaying toward the floor — a long run with no
 * token is evidence against a launch, not for one.
 */
export function maturityCurve(age: number | null, model: ModelConstants): number {
  const days = age ?? model.unknown_age_days;
  if (days <= model.maturity_rise_days) return days / model.maturity_rise_days;
  if (days <= model.maturity_peak_days) return 1;
  return Math.max(model.maturity_decay_floor, 1 - (days - model.maturity_peak_days) / model.maturity_decay_days);
}

/** The inverted-U maturity multiplier: the floor plus the curve's share of the range. */
export function maturityMultiplier(age: number | null, model: ModelConstants): number {
  return model.maturity_floor + maturityCurve(age, model) * model.maturity_range;
}

/** The multi-chain breadth multiplier: 1.00 on one chain, up to 1.20 on five or more. */
export function breadthMultiplier(protocol: SnapshotProtocol, model: ModelConstants): number {
  const extra = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_cap_steps);
  return 1 + extra * model.breadth_step;
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): {
  implied: number;
  catMult: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const raw = finite(protocol.change_7d, 0);
  const growthPct = clampGrowth(raw, model);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const maturityMult = maturityMultiplier(age, model);
  const breadthMult = breadthMultiplier(protocol, model);
  const catMult = categoryMultiple(protocol, model);
  const base = protocol.tvl_usd * catMult;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult));
  return { implied, catMult, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** Order two scored protocols: the stronger implied value first, the slug breaking ties. */
function compareScored(
  a: { implied: number; p: SnapshotProtocol },
  b: { implied: number; p: SnapshotProtocol },
): number {
  return b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0);
}

/**
 * The early radar's candidates: every pre-token protocol below the watchlist floor that
 * passes the watchlist's own exclusion rules, strongest TVL first, slug breaking ties.
 * Never a replacement for a watchlist row: a protocol already picked stays picked.
 */
function earlyCandidates(snapshot: Snapshot, picked: Map<string, SnapshotProtocol>): SnapshotProtocol[] {
  return snapshot.protocols
    .filter((p) => !picked.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const picked = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot,
  // but the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const found = index.get(slug);
    if (found !== undefined) picked.set(slug, found);
  }
  // The early radar adds the candidates below the floor; a picked protocol stays picked.
  for (const candidate of earlyCandidates(snapshot, picked)) picked.set(candidate.slug, candidate);

  const scored = [...picked.values()].map((protocol) => {
    const value = impliedValue(protocol, snapshot.as_of, model);
    return { p: protocol, ...value };
  });
  scored.sort(compareScored);
  return scored.map((entry, i) => ({
    rank: i + 1,
    slug: entry.p.slug,
    name: entry.p.name,
    category: entry.p.category,
    chains: entry.p.chains,
    tvl_usd: entry.p.tvl_usd,
    change_7d: entry.p.change_7d,
    mcap_usd: entry.p.mcap_usd,
    listed_at: entry.p.listed_at,
    gecko_id: entry.p.gecko_id,
    symbol: entry.p.symbol,
    token_status: 'pre-token',
    age_days: entry.age,
    implied_value_usd: entry.implied,
    model: {
      base_multiple: model.base_multiple,
      category_multiple: entry.catMult,
      growth_pct: entry.growthPct,
      growth_multiplier: round4(entry.growthMult),
      maturity_multiplier: round4(entry.maturityMult),
      breadth_multiplier: round4(entry.breadthMult),
      age_days: entry.age,
    },
    farm_steps: farmSteps(entry.p, entry.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let line = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (line.length > 600) line = `${line.slice(0, 596)}...`;
  if (line.length < 20) line = `${line} Hold the position and check the protocol's own page.`;
  return line;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(protocol: SnapshotProtocol): string {
  return protocol.chains.length > 0 ? protocol.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(protocol: SnapshotProtocol): number {
  if (protocol.tvl_usd >= 5_000_000_000) return 250;
  if (protocol.tvl_usd >= 1_000_000_000) return 150;
  if (protocol.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(protocol: SnapshotProtocol, stake: number, homeChain: string): string {
  const kind = (protocol.category ?? '').toLowerCase();
  const protocolName = protocol.name;
  if (kind.includes('lend') || kind.includes('cdp') || kind.includes('collateral')) return `Supply $${stake} of USDC to ${protocolName} on ${homeChain} and keep the position open.`;
  if (kind.includes('dex') || kind.includes('yield') || kind.includes('leveraged farm')) return `Provide $${stake} of liquidity to ${protocolName}'s main pool on ${homeChain} and keep the position open.`;
  if (kind.includes('bridge')) return `Bridge $${stake} of USDC to ${homeChain} through ${protocolName} and use the bridged funds in its app.`;
  if (kind.includes('staking') || kind.includes('restak')) return `Stake $${stake} of the chain's staking asset through ${protocolName} and keep the receipt.`;
  if (kind.includes('perpetual') || kind.includes('derivative')) return `Deposit $${stake} of USDC as margin on ${protocolName} and open one small hedge.`;
  if (kind.includes('prediction')) return `Fund $${stake} and place one market position on ${protocolName}.`;
  if (kind.includes('curator') || kind.includes('allocator')) return `Deposit $${stake} into a ${protocolName} vault on ${homeChain} and keep the shares.`;
  if (kind.includes('stable')) return `Mint or deposit $${stake} of the stable asset through ${protocolName} on ${homeChain}.`;
  if (kind.includes('rwa')) return `Mint $${stake} of the protocol's yield asset on ${homeChain} and hold it.`;
  if (kind.includes('insurance')) return `Buy $${stake} of cover from ${protocolName} on ${homeChain} and keep the policy.`;
  return `Deposit $${stake} of USDC into ${protocolName} on ${homeChain} and keep the position open.`;
}

/**
 * The category's second qualifying action: a different action from the first, so the
 * wallet shows two distinct entries instead of one repeated deposit.
 */
function secondActionFor(protocol: SnapshotProtocol, stake: number, homeChain: string): string {
  const kind = (protocol.category ?? '').toLowerCase();
  const protocolName = protocol.name;
  const topUp = Math.max(10, Math.round(stake / 5));
  if (kind.includes('lend') || kind.includes('cdp') || kind.includes('collateral')) return `Borrow $${topUp} against the supply you just made on ${protocolName}, then repay it within the week.`;
  if (kind.includes('dex') || kind.includes('yield') || kind.includes('leveraged farm')) return `Swap $${topUp} in the same ${protocolName} pool so the position shows both sides of the market.`;
  if (kind.includes('bridge')) return `Use the bridged funds for one swap or deposit in the destination app on ${homeChain}.`;
  if (kind.includes('staking') || kind.includes('restak')) return `Delegate a second, smaller stake of $${topUp} from the same wallet a few days later.`;
  if (kind.includes('perpetual') || kind.includes('derivative')) return `Close the hedge on ${protocolName} and open one more small position in the opposite direction.`;
  if (kind.includes('prediction')) return `Place a second position of $${topUp} on a different ${protocolName} market.`;
  if (kind.includes('curator') || kind.includes('allocator')) return `Deposit $${topUp} into a different ${protocolName} vault on ${homeChain}.`;
  if (kind.includes('stable')) return `Hold the stable asset through one full weekly cycle before moving it anywhere.`;
  if (kind.includes('rwa')) return `Reinvest one distribution of $${topUp} back into the same ${protocolName} yield asset.`;
  if (kind.includes('insurance')) return `Top up the cover by $${topUp} so the policy shows two purchases.`;
  return `Repeat the deposit once more with $${topUp} so the wallet shows two entries.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names.
 */
export function farmSteps(protocol: SnapshotProtocol, age: number | null): FarmStep[] {
  const homeChain = chainOf(protocol);
  const stake = capitalFor(protocol);
  const holdDays = holdDaysFor(age);
  const action = actionFor(protocol, stake, homeChain);
  const second = secondActionFor(protocol, stake, homeChain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${stake} of capital and about $${stake >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $${stake >= 150 ? 5 : 2} of gas`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${holdDays} days so the activity is counted in more than one snapshot.`,
      cost: `the $${stake} stays in the position`,
      time: `${holdDays} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => isLiveToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
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
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(boardRow: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: boardRow.rank,
    slug: boardRow.slug,
    name: boardRow.name,
    category: boardRow.category,
    chains: boardRow.chains,
    tvl_usd: boardRow.tvl_usd,
    change_7d: boardRow.change_7d,
    mcap_usd: boardRow.mcap_usd,
    listed_at: boardRow.listed_at,
    age_days: boardRow.age_days,
    implied_value_usd: boardRow.implied_value_usd,
    category_multiple: boardRow.model.category_multiple,
    growth_multiplier: boardRow.model.growth_multiplier,
    maturity_multiplier: boardRow.model.maturity_multiplier,
    breadth_multiplier: boardRow.model.breadth_multiplier,
    watchlist: watchlist.has(boardRow.slug),
  };
}

/**
 * The early radar's exclusion tally: every below-floor pre-token protocol the rules
 * leave out, counted by its reason. Watchlist rows never count here.
 */
export function summarizeExclusions(snapshot: Snapshot): { excluded: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let excluded = 0;
  for (const protocol of snapshot.protocols) {
    if (snapshot.watchlist.includes(protocol.slug)) continue;
    if (!isPreToken(protocol) || protocol.tvl_usd >= snapshot.floor_usd) continue;
    const reason = exclusionReason(protocol);
    if (reason !== null) {
      excluded++;
      breakdown[reason] = (breakdown[reason] ?? 0) + 1;
    }
  }
  return { excluded, breakdown };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const earlyCount = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const { excluded: excludedCount, breakdown: tally } = summarizeExclusions(snapshot);
  const watchlistSet = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: earlyCount,
    live_size: live.length,
    excluded_early: excludedCount,
    excluded_breakdown: tally,
    rows: board.map((r) => radarRow(r, watchlistSet)),
    live,
  };
  return { board, radar };
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

/**
 * Why a board is not one the gate will take, or null: coverage, ranks, order, one shared
 * implied value, and farm steps.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const onBoard = new Set(board.map((row) => row.slug));
  const absent = snapshot.watchlist.filter((slug) => !onBoard.has(slug));
  if (absent.length > 0) return `the board misses ${absent.length} watchlist slug${absent.length === 1 ? '' : 's'}: ${absent.slice(0, 5).join(', ')}`;
  const ordered = board.map((row) => row.rank).sort((a, b) => a - b);
  for (let i = 0; i < ordered.length; i++) if (ordered[i] !== i + 1) return `rank ${i + 1} is ${ordered[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const row of board) {
    const steps = row.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${row.slug} has ${steps.length} farm steps`;
    for (const step of steps) if (step.length < 20 || step.length > 600) return `${row.slug} has a farm step of ${step.length} characters`;
    if (!Number.isSafeInteger(row.implied_value_usd) || row.implied_value_usd <= 0) return `${row.slug} has implied value ${row.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
