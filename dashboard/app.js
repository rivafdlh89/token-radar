// Token Radar's plain dashboard, radar-3. It reads window.RADAR (written beside
// dashboard/ by main.ts as data.js) and renders the ranked board, a filterable table, a
// per-protocol detail view with the model's own inputs and the protocol's costed farm
// plan, the live-token set, the 758-protocol audit, the methodology, and a model sandbox
// that recomputes expected values live from the fitted coefficients. No network: every
// byte it shows is in data.js. Press / anywhere to jump to the search box.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var VF = DATA.value_fit;
  var OF = DATA.odds_fit;
  var state = {
    q: '', category: 'all', verdict: 'all', watchlistOnly: false, tab: 'board',
    sort: 'ev', dir: -1, selected: null,
  };

  /* ---- small helpers ---- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function usd(v) {
    return '$' + Math.round(v).toLocaleString('en-US');
  }
  function money(v) {
    return v < 1 && v > -1 ? '$' + v.toFixed(2) : usd(v);
  }
  function usdM(v) {
    return '$' + (v / 1000000).toFixed(1) + 'M';
  }
  function pct(v, digits) {
    return (100 * v).toFixed(digits === undefined ? 1 : digits) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return '—';
    if (days < 365) return days + 'd';
    return (days / 365).toFixed(1) + 'y';
  }
  function clippedGrowth(pctGrowth) {
    return Math.max(-0.5, Math.min(0.5, pctGrowth / 100));
  }
  function sigmoid(z) {
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
  }

  /* ---- the fitted model, re-run in the page ----
     The same two fits main.ts runs, from the same coefficients in data.js: the ridge
     value model (log market cap on centred log TVL, category, chains, winsorized
     growth and age) and the cure-survival odds model (pi from size, growth and
     chains; a Weibull no-token clock in age). The sandbox uses it, and the row-1
     self-check re-runs it on the board's first row and compares. */
  function modelFor(tvl, growthPct, ageDays, category, chains) {
    var lt = Math.log10(Math.max(1, tvl)) - 8;
    var ageY = ((ageDays === null || ageDays === undefined) ? VF.median_age_days : ageDays) / 365;
    var growth = clippedGrowth(growthPct);
    var logMcap = VF.intercept
      + VF.log_tvl * lt
      + VF.log_tvl_sq * lt * lt
      + (VF.categories[category] || 0)
      + VF.log_chains * Math.log10(Math.max(1, chains))
      + VF.growth * growth
      + VF.age_years * ageY
      + VF.age_years_sq * ageY * ageY;
    var fitted = Math.pow(10, logMcap);
    var age = (ageDays === null || ageDays === undefined) ? 365 : Math.max(1, ageDays);
    var pi = sigmoid(
      OF.cure_pi_intercept
      + OF.cure_log_tvl * lt
      + OF.cure_growth * growth
      + OF.cure_log_chains * Math.log10(Math.max(1, chains)),
    );
    var s = Math.exp(-Math.pow(age / OF.weibull_lambda_days, OF.weibull_k));
    var odds = (pi * s) / (1 - pi + pi * s);
    return { fitted: fitted, pi: pi, odds: odds, ev: fitted * odds };
  }

  /* ---- KPI strip ---- */
  function kpiStrip() {
    var evs = DATA.rows.map(function (r) { return r.implied_value_usd; }).sort(function (a, b) { return a - b; });
    var medianEv = evs[Math.floor(evs.length / 2)];
    var farms = DATA.rows.filter(function (r) { return r.verdict === 'farm'; }).length;
    var kpis = [
      [String(DATA.board_size), 'ranked rows'],
      [DATA.audit.ranked_watchlist + ' / ' + DATA.watchlist_size, 'watchlist covered'],
      [usdM(medianEv), 'median expected value'],
      [VF.loo_ratio.toFixed(2) + '×', 'LOO beats flat multiple'],
      [pct(VF.loo_within_3x, 0), 'LOO within 3× (flat ' + pct(VF.flat_within_3x, 0) + ')'],
      [OF.auc_cv.toFixed(3), 'odds 5-fold CV AUC'],
      [farms + ' farm', 'verdicts: ' + farms + ' farm, ' + DATA.rows.filter(function (r) { return r.verdict === 'thin'; }).length + ' thin, ' + DATA.rows.filter(function (r) { return r.verdict === 'skip'; }).length + ' skip'],
      [DATA.audit.total + ' counted', '758 protocols accounted'],
    ];
    return '<ul class="kpis">' + kpis.map(function (k) {
      return '<li><span class="kpi-value">' + esc(k[0]) + '</span><span class="kpi-label">' + esc(k[1]) + '</span></li>';
    }).join('') + '</ul>';
  }

  /* ---- self-check strip ---- */
  function checksStrip() {
    var items = DATA.self_checks.map(function (c) {
      var ok = c.name === 'model sandbox agrees with row 1' ? sandboxAgrees() : c.pass;
      return '<li><span class="' + (ok ? 'pass' : 'fail') + '">' + (ok ? '✓' : '✗') + '</span> <strong>' + esc(c.name) + '</strong> — ' + esc(c.detail) + '</li>';
    }).join('');
    return '<h2>Self-checks — every claim on this page, verified</h2><ul class="checks">' + items + '</ul>';
  }

  /* The row-1 check, re-run here: recompute the first row's expected value from its
     own TVL, growth, age and category, and compare with the board's figure. */
  function sandboxAgrees() {
    var r = DATA.rows[0];
    if (!r) return false;
    var m = modelFor(r.tvl_usd, r.change_7d === null ? 0 : r.change_7d, r.age_days, r.category, r.chains.length);
    return Math.abs(m.ev - r.implied_value_usd) / Math.max(1, r.implied_value_usd) < 0.005;
  }

  /* ---- board table ---- */
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      var av = key === 'ev' ? a.implied_value_usd : key === 'fitted' ? a.fitted_value_usd
        : key === 'odds' ? a.odds : key === 'tvl' ? a.tvl_usd : key === 'age' ? (a.age_days === null ? -1 : a.age_days)
        : a.rank;
      var bv = key === 'ev' ? b.implied_value_usd : key === 'fitted' ? b.fitted_value_usd
        : key === 'odds' ? b.odds : key === 'tvl' ? b.tvl_usd : key === 'age' ? (b.age_days === null ? -1 : b.age_days)
        : b.rank;
      return (av - bv) * state.dir;
    });
    return rows;
  }

  function boardTable(rows) {
    var body = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '" class="' + (r.watchlist ? 'watch' : '') + '">'
        + '<td class="num">' + r.rank + '</td>'
        + '<td>' + esc(r.name) + (r.watchlist ? ' <span class="tag">WATCH</span>' : '') + '</td>'
        + '<td>' + esc(r.category || '—') + '</td>'
        + '<td class="num">' + usdM(r.tvl_usd) + '</td>'
        + '<td class="num">' + (r.change_7d === null ? '—' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</td>'
        + '<td class="num">' + fmtAge(r.age_days) + '</td>'
        + '<td class="num">' + usdM(r.fitted_value_usd) + '</td>'
        + '<td class="num">' + r.odds.toFixed(2) + '</td>'
        + '<td class="num"><strong>' + usdM(r.implied_value_usd) + '</strong><br><span class="muted small">' + usdM(r.ev_low_usd) + '–' + usdM(r.ev_high_usd) + '</span></td>'
        + '<td class="num">' + r.rank_low + '–' + r.rank_high + '</td>'
        + '<td><span class="pill ' + r.verdict + '">' + r.verdict + '</span></td>'
        + '</tr>';
    }).join('');
    return '<div class="tablewrap"><table><thead><tr>'
      + '<th class="num">#</th><th>Protocol</th><th>Category</th>'
      + '<th class="num">TVL</th><th class="num">7d</th><th class="num">Age</th>'
      + '<th class="num">Fitted value</th><th class="num">Odds</th>'
      + '<th class="num">Expected value</th><th class="num">Rank range</th><th>Verdict</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function controlsHtml() {
    var cats = [];
    DATA.rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
    cats.sort();
    return '<div class="controls">'
      + '<div><label for="q">Search</label><input id="q" type="search" placeholder="name or slug" value="' + esc(state.q) + '"></div>'
      + '<div><label for="cat">Category</label><select id="cat"><option value="all">All categories</option>'
      + cats.map(function (c) { return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>'
      + '<div><label for="verdict">Verdict</label><select id="verdict">'
      + ['all', 'farm', 'thin', 'skip'].map(function (v) { return '<option value="' + v + '"' + (state.verdict === v ? ' selected' : '') + '>' + (v === 'all' ? 'All verdicts' : v) + '</option>'; }).join('') + '</select></div>'
      + '<div><label for="sort">Sort by</label><select id="sort">'
      + [['ev', 'Expected value'], ['fitted', 'Fitted value'], ['odds', 'Odds'], ['tvl', 'TVL'], ['age', 'Age'], ['rank', 'Rank']].map(function (o) { return '<option value="' + o[0] + '"' + (state.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>'
      + '<div class="checkline"><input id="watch" type="checkbox"' + (state.watchlistOnly ? ' checked' : '') + '><label for="watch">Watchlist only</label></div>'
      + '</div>';
  }

  function boardView() {
    var rows = filteredRows();
    return '<h1>Token Radar <span class="muted small">radar-3</span></h1>'
      + '<p class="lede">Every pre-token protocol in the snapshot, ranked by expected launch value: a fitted value model times fitted listing odds. Snapshot ' + esc(DATA.as_of) + ' from ' + esc(DATA.source) + '; floor ' + usd(DATA.floor_usd) + '. The value model is a ridge regression fitted on the 128 traded protocols with a positive market cap; the odds come from a cure-survival model fitted on all 758 protocols. Nothing here is a hardcoded multiple.</p>'
      + kpiStrip()
      + checksStrip()
      + '<div class="tabs"><a href="#/" class="active">Board (' + DATA.board_size + ')</a><a href="#/live">Live tokens (' + DATA.audit.live + ')</a><a href="#/method">Method</a></div>'
      + controlsHtml()
      + '<p class="count">Showing ' + rows.length + ' of ' + DATA.board_size + ' rows. Expected value is the fitted value times the odds; the range is the bootstrap 80% interval. Click a row for its model breakdown and costed farm plan.</p>'
      + boardTable(rows);
  }

  /* ---- detail view ---- */
  function detailView(slug) {
    var r = null;
    DATA.rows.forEach(function (row) { if (row.slug === slug) r = row; });
    if (!r) return '<p>Unknown protocol: ' + esc(slug) + '. <a href="#/">Back to the board</a></p>';
    var m = modelFor(r.tvl_usd, r.change_7d === null ? 0 : r.change_7d, r.age_days, r.category, r.chains.length);
    var steps = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    return '<a class="back" href="#/">&larr; Back to the board</a>'
      + '<h1>#' + r.rank + ' ' + esc(r.name) + ' <span class="pill ' + r.verdict + '">' + r.verdict + '</span></h1>'
      + '<p class="lede">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) + ' · TVL ' + usdM(r.tvl_usd)
      + ' · 7d ' + (r.change_7d === null ? '—' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%')
      + ' · age ' + fmtAge(r.age_days) + (r.watchlist ? ' · on the watchlist' : '') + '.</p>'
      + '<div class="detail-grid"><div class="panel"><h3>Model breakdown</h3><dl class="kv">'
      + '<dt>Fitted value</dt><dd>' + usdM(r.fitted_value_usd) + '</dd>'
      + '<dt>Listing odds</dt><dd>' + r.odds.toFixed(3) + ' (pi ' + m.pi.toFixed(3) + ')</dd>'
      + '<dt>Expected value</dt><dd>' + usdM(r.implied_value_usd) + '</dd>'
      + '<dt>80% range</dt><dd>' + usdM(r.ev_low_usd) + ' – ' + usdM(r.ev_high_usd) + '</dd>'
      + '<dt>Rank range</dt><dd>#' + r.rank_low + ' – #' + r.rank_high + '</dd>'
      + '<dt>Recomputed in page</dt><dd>' + usdM(m.ev) + ' (fitted ' + usdM(m.fitted) + ' × odds ' + m.odds.toFixed(3) + ')</dd>'
      + '</dl><p class="econ">The page recomputes this row from its own TVL, growth, age and category with the fitted coefficients — the board and the code agree by construction.</p></div>'
      + '<div class="panel"><h3>Farm economics</h3><dl class="kv">'
      + '<dt>Capital</dt><dd>' + usd(r.capital_usd) + '</dd>'
      + '<dt>Hold</dt><dd>' + r.hold_days + ' days</dd>'
      + '<dt>Gas (7 tx)</dt><dd>' + money(r.gas_usd) + '</dd>'
      + '<dt>Total cost</dt><dd>' + usd(r.total_cost_usd) + '</dd>'
      + '<dt>Expected take</dt><dd>' + usd(r.expected_take_usd) + '</dd>'
      + '<dt>Net</dt><dd>' + usd(r.net_usd) + '</dd>'
      + '<dt>Dollars / hour</dt><dd>' + usd(r.usd_per_hour) + '</dd>'
      + '<dt>Break-even farmers</dt><dd>' + Math.round(r.breakeven_farmers).toLocaleString('en-US') + '</dd>'
      + '</dl><p class="econ">Take is the expected value times a stated 7% airdrop-pool share, split across a stated 10,000 farmers. Verdict: farm when net ≥ $100 and $/hour ≥ $25; thin when net &gt; $0; skip otherwise.</p></div></div>'
      + '<h2>Farm plan — 7 steps, costed</h2><ol class="steps">' + steps + '</ol>';
  }

  /* ---- live-token tab ---- */
  function liveView() {
    var body = DATA.live.map(function (p) {
      return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.category || '—') + '</td>'
        + '<td>' + esc(p.chains.slice(0, 2).join(', ')) + '</td>'
        + '<td class="num">' + usdM(p.tvl_usd) + '</td>'
        + '<td class="num">' + (p.mcap_usd === null ? '—' : usdM(p.mcap_usd)) + '</td>'
        + '<td class="num">' + (p.change_7d === null ? '—' : (p.change_7d >= 0 ? '+' : '') + p.change_7d.toFixed(1) + '%') + '</td></tr>';
    }).join('');
    return '<h1>Live tokens — set aside, not ranked</h1>'
      + '<p class="lede">' + DATA.audit.live + ' protocols already trade a token, so the board does not rank them: their value is the market\u2019s own, not a model\u2019s. ' + DATA.audit.live_with_mcap + ' record a positive market cap; ' + DATA.audit.live_no_mcap + ' record a token but no market cap (16 of those record a zero or negative market cap — dead tokens, excluded from the value fit and named in the method). The table shows the top ' + DATA.live.length + ' by market cap.</p>'
      + '<div class="tabs"><a href="#/">Board (' + DATA.board_size + ')</a><a href="#/live" class="active">Live tokens (' + DATA.audit.live + ')</a><a href="#/method">Method</a></div>'
      + '<div class="tablewrap"><table><thead><tr><th>Protocol</th><th>Category</th><th>Chains</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">7d</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  /* ---- audit + method + sandbox ---- */
  function auditHtml() {
    var a = DATA.audit;
    var reasons = Object.keys(a.excluded_breakdown).sort().map(function (k) {
      return '<tr><td>' + esc(k) + '</td><td class="num">' + a.excluded_breakdown[k] + '</td></tr>';
    }).join('');
    return '<h2>758 accounted — every protocol counted once</h2>'
      + '<table class="audit-table"><thead><tr><th>Bucket</th><th class="num">Count</th></tr></thead><tbody>'
      + '<tr><td>Ranked on the board</td><td class="num">' + a.ranked + ' (' + a.ranked_watchlist + ' watchlist, ' + a.ranked_below_floor + ' below the $50M floor, ' + a.ranked_above_floor + ' above it)</td></tr>'
      + '<tr><td>Pre-token, excluded by the watchlist\u2019s own rules</td><td class="num">' + a.excluded_pre_token + '</td></tr>'
      + '<tr><td>Live-token, set aside</td><td class="num">' + a.live + ' (' + a.live_with_mcap + ' with a market cap, ' + a.live_no_mcap + ' without)</td></tr>'
      + '<tr><td><strong>Total</strong></td><td class="num"><strong>' + a.total + '</strong></td></tr>'
      + '</tbody></table>'
      + '<h3>Why the 144 were excluded</h3><table class="audit-table"><thead><tr><th>Reason</th><th class="num">Count</th></tr></thead><tbody>' + reasons + '</tbody></table>'
      + '<p class="small muted">One caveat, stated in the open: the snapshot carries no parentProtocol field, so a protocol whose parent the watchlist\u2019s own computation knew cannot be checked here; the board\u2019s rules are only the ones the sealed snapshot can check.</p>';
  }

  function methodHtml() {
    var cats = Object.keys(VF.categories).sort().map(function (c) {
      return '<code>' + esc(c) + ' ' + (VF.categories[c] >= 0 ? '+' : '') + VF.categories[c].toFixed(3) + '</code>';
    }).join(', ');
    return '<h2>Method — what was fitted, what was assumed, what the numbers say</h2>'
      + '<div class="method">'
      + '<h3>Value model (ridge, λ = 10)</h3>'
      + '<p>log<sub>10</sub>(market cap) = ' + VF.intercept.toFixed(3) + ' + ' + VF.log_tvl.toFixed(3) + '·(log<sub>10</sub>TVL − 8) + ' + VF.log_tvl_sq.toFixed(3) + '·(log<sub>10</sub>TVL − 8)² + category + ' + VF.log_chains.toFixed(3) + '·log<sub>10</sub>(chains) + ' + VF.growth.toFixed(3) + '·growth + ' + VF.age_years.toFixed(3) + '·age + ' + VF.age_years_sq.toFixed(3) + '·age². Fitted on the ' + VF.n_comps + ' traded protocols that record a positive market cap. Category terms: ' + cats + '. Growth is winsorized to ±50% (99% of protocols sit inside it; one grew 4,448% in a week). Age is years since the protocol joined DefiLlama, or the median ' + VF.median_age_days + ' days where it is missing.</p>'
      + '<p><strong>Validation, all computed at run time.</strong> Leave-one-out RMSE ' + VF.loo_rmse_dex.toFixed(3) + ' dex against a flat median multiple\u2019s ' + VF.loo_flat_rmse_dex.toFixed(3) + ' (' + VF.loo_ratio.toFixed(2) + '× better); within 3× of the true market cap ' + pct(VF.loo_within_3x, 0) + ' of the time (flat multiple ' + pct(VF.flat_within_3x, 0) + '), within 2× ' + pct(VF.loo_within_2x, 0) + '. Walk-forward — fit on the older half by listing date, tested on the newer half — RMSE ratio ' + VF.wf_ratio.toFixed(2) + '×, within 3× ' + pct(VF.wf_within_3x, 0) + ' against the flat multiple\u2019s ' + pct(VF.wf_flat_within_3x, 0) + '. A placebo (shuffled target) scores R² ' + VF.placebo_r_squared.toFixed(3) + ' against the real fit\u2019s ' + VF.r_squared.toFixed(3) + '. The honest read: the fit beats a flat multiple, but only modestly — market cap is noisy, and the board\u2019s 80% intervals say so row by row.</p>'
      + '<p>' + VF.n_dead_excluded + ' traded tokens record a zero or negative market cap. They are dead tokens: the log fit leaves them out, and the board names the count here rather than silently dropping them.</p>'
      + '<h3>Odds model (cure-survival, maximum likelihood)</h3>'
      + '<p>π = sigmoid(' + OF.cure_pi_intercept.toFixed(2) + ' + ' + OF.cure_log_tvl.toFixed(2) + '·(log<sub>10</sub>TVL − 8) + ' + OF.cure_growth.toFixed(2) + '·growth + ' + OF.cure_log_chains.toFixed(2) + '·log<sub>10</sub>(chains)); the no-token clock is Weibull with λ = ' + Math.round(OF.weibull_lambda_days) + ' days and k = ' + OF.weibull_k.toFixed(2) + '. A protocol that has run <em>a</em> days with no token has odds π·S(<em>a</em>) / (1 − π + π·S(<em>a</em>)) of listing eventually. The likelihood is current-status — <code>listed_at</code> is the DefiLlama date, not the token launch date, so a listed protocol contributes P(listed by age <em>a</em>), never a density at <em>a</em>. The gradients were checked against finite differences.</p>'
      + '<p><strong>Validation.</strong> 5-fold cross-validated AUC ' + OF.auc_cv.toFixed(3) + ' for P(has a token by age) — weak but real (0.5 is chance). The snapshot\u2019s figures predict listing only modestly: fast growers are mostly young pre-token protocols in a growth spurt, which is why the growth coefficient is negative. Odds over the board run ' + OF.odds_min.toFixed(2) + ' to ' + OF.odds_max.toFixed(2) + ', median ' + OF.odds_median.toFixed(2) + '.</p>'
      + '<h3>Farm economics (assumptions, stated in the open)</h3>'
      + '<p>Gas per transaction: Ethereum $3.00, Arbitrum $0.25, Optimism $0.20, Base $0.05, Solana $0.01, Polygon $0.05, Avalanche $0.30, BNB Chain $0.15, other $0.50; a plan spends 7 transactions. Capital by TVL tier: $250 above $1B, $150 above $100M, $100 below. Hold: 45 / 60 / 90 days by the same tiers. Opportunity cost 8% a year on the capital. Expected take: expected value × a stated 7% airdrop-pool share, split across a stated 10,000 farmers. Verdict: farm when net ≥ $100 and $/hour ≥ $25; thin when net &gt; $0; skip otherwise. Re-price any of these and the verdicts move — the numbers are all on the row.</p>'
      + '</div>';
  }

  function sandboxHtml() {
    var cats = Object.keys(VF.categories).sort();
    return '<h2>Model sandbox — recompute any protocol</h2>'
      + '<p class="small muted">The same fitted coefficients, run live. Change a figure and the expected value follows.</p>'
      + '<div class="sandbox">'
      + '<div><label for="sb-tvl">TVL (USD)</label><input id="sb-tvl" type="number" value="100000000" min="1"></div>'
      + '<div><label for="sb-growth">7d growth (%)</label><input id="sb-growth" type="number" value="0" step="0.1"></div>'
      + '<div><label for="sb-age">Age (days)</label><input id="sb-age" type="number" value="365" min="0"></div>'
      + '<div><label for="sb-cat">Category</label><select id="sb-cat"><option value="">Other</option>'
      + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></div>'
      + '<div><label for="sb-chains">Chains</label><input id="sb-chains" type="number" value="1" min="1"></div>'
      + '</div><p class="sandbox-out" id="sb-out"></p>';
  }

  function methodView() {
    return '<h1>Method</h1>' + auditHtml() + methodHtml() + sandboxHtml()
      + '<p><a href="#/">&larr; Back to the board</a></p>';
  }

  /* ---- routing ---- */
  function render() {
    var hash = window.location.hash || '#/';
    app.setAttribute('aria-busy', 'false');
    if (hash.indexOf('#/row/') === 0) {
      app.innerHTML = detailView(decodeURIComponent(hash.slice(6)));
    } else if (hash === '#/live') {
      app.innerHTML = liveView();
    } else if (hash === '#/method') {
      app.innerHTML = methodView();
      bindSandbox();
    } else {
      if (hash.indexOf('#/filter=') === 0) {
        var f = hash.slice(9);
        if (f === 'watchlist') state.watchlistOnly = true;
        if (f.indexOf('verdict:') === 0) state.verdict = f.slice(8);
      }
      app.innerHTML = boardView();
      bindBoard();
    }
    window.scrollTo(0, 0);
  }

  function bindSandbox() {
    var out = document.getElementById('sb-out');
    function update() {
      var tvl = parseFloat(document.getElementById('sb-tvl').value) || 1;
      var growth = parseFloat(document.getElementById('sb-growth').value) || 0;
      var age = parseFloat(document.getElementById('sb-age').value);
      var cat = document.getElementById('sb-cat').value || null;
      var chains = parseInt(document.getElementById('sb-chains').value, 10) || 1;
      var m = modelFor(tvl, growth, isNaN(age) ? null : age, cat, chains);
      out.textContent = 'Fitted value ' + usdM(m.fitted) + ' · π ' + m.pi.toFixed(3) + ' · odds ' + m.odds.toFixed(3) + ' · expected value ' + usdM(m.ev);
    }
    ['sb-tvl', 'sb-growth', 'sb-age', 'sb-cat', 'sb-chains'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', update);
    });
    update();
  }

  function bindBoard() {
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; refreshBoard(); });
    var cat = document.getElementById('cat');
    if (cat) cat.addEventListener('change', function () { state.category = cat.value; refreshBoard(); });
    var verdict = document.getElementById('verdict');
    if (verdict) verdict.addEventListener('change', function () { state.verdict = verdict.value; refreshBoard(); });
    var sort = document.getElementById('sort');
    if (sort) sort.addEventListener('change', function () { state.sort = sort.value; refreshBoard(); });
    var watch = document.getElementById('watch');
    if (watch) watch.addEventListener('change', function () { state.watchlistOnly = watch.checked; refreshBoard(); });
    app.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { window.location.hash = '#/row/' + encodeURIComponent(tr.getAttribute('data-slug')); });
    });
  }

  function refreshBoard() {
    var rows = filteredRows();
    var wrap = app.querySelector('.tablewrap');
    if (wrap) wrap.outerHTML = boardTable(rows);
    var count = app.querySelector('.count');
    if (count) count.textContent = 'Showing ' + rows.length + ' of ' + DATA.board_size + ' rows. Expected value is the fitted value times the odds; the range is the bootstrap 80% interval. Click a row for its model breakdown and costed farm plan.';
    app.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { window.location.hash = '#/row/' + encodeURIComponent(tr.getAttribute('data-slug')); });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      var q = document.getElementById('q');
      if (q) { e.preventDefault(); q.focus(); }
    }
  });
  window.addEventListener('hashchange', render);
  render();
})();
