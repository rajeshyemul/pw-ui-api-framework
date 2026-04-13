import { FlakySummary } from "../../models/testReliabilityMonitor/FlakyTestTypes";

/**
 * FlakyTestHtmlReport
 *
 * Generates a self-contained single-file HTML report.
 * No external dependencies — everything is inline CSS and JS.
 * Can be opened directly in any browser or uploaded as a CI artifact.
 */
export class FlakyTestHtmlReport {
  static generate(summary: FlakySummary): string {
    // ── Stat cards ──────────────────────────────────────────────────────────
    const statCards = `
      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">Total Tests Tracked</div>
          <div class="stat-value neutral">${summary.totalTests}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Stable Tests</div>
          <div class="stat-value green">${summary.stableTests}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Flaky Tests</div>
          <div class="stat-value ${summary.flakyTests > 0 ? "red" : "green"}">${summary.flakyTests}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">High Risk</div>
          <div class="stat-value ${summary.highRisk > 0 ? "red" : "green"}">${summary.highRisk}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Medium Risk</div>
          <div class="stat-value ${summary.mediumRisk > 0 ? "orange" : "green"}">${summary.mediumRisk}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Low Risk</div>
          <div class="stat-value ${summary.lowRisk > 0 ? "yellow" : "green"}">${summary.lowRisk}</div>
        </div>
      </div>`;

    // ── Table rows ──────────────────────────────────────────────────────────
    const riskBadge = (level: string) => {
      const map: Record<string, string> = {
        HIGH: "badge-high",
        MEDIUM: "badge-medium",
        LOW: "badge-low",
        STABLE: "badge-stable"
      };
      return `<span class="badge ${map[level] ?? "badge-stable"}">${level}</span>`;
    };

    const statusDot = (status: string) => {
      const map: Record<string, string> = {
        passed: "🟢",
        failed: "🔴",
        skipped: "⚪",
        timedOut: "🟠"
      };
      return map[status] ?? "⚫";
    };

    const tableRows = summary.results
      .map((r) => {
        const recentRunDots = r.recentRuns
          .map((run) => `<span title="${run.status} (retry ${run.retry}) — ${run.durationMs}ms">${statusDot(run.status)}</span>`)
          .join(" ");

        const errorHtml = r.lastError
          ? `<div class="error-msg" title="${r.lastError.replace(/"/g, "&quot;")}">
             ${r.lastError.substring(0, 120)}${r.lastError.length > 120 ? "…" : ""}
           </div>`
          : "";

        const fileShort = r.testFile.replace(/\\/g, "/").split("/tests/")[1] ?? r.testFile;

        return `
        <tr class="test-row ${r.riskLevel === "STABLE" ? "stable-row" : ""}" data-risk="${r.riskLevel}">
          <td class="test-title-cell">
            <div class="test-name">${r.testTitle}</div>
            <div class="test-file">📁 ${fileShort}</div>
            ${errorHtml}
          </td>
          <td class="center">${riskBadge(r.riskLevel)}</td>
          <td class="center">
            <div class="rate-bar-wrap">
              <div class="rate-bar" style="width:${Math.round(r.flakyRate * 100)}%;background:${r.riskLevel === "HIGH" ? "#ef4444" : r.riskLevel === "MEDIUM" ? "#f97316" : r.riskLevel === "LOW" ? "#eab308" : "#22c55e"}"></div>
            </div>
            <div class="rate-label">${r.flakyRateLabel}</div>
          </td>
          <td class="center">${r.flakyCount} / ${r.totalRuns}</td>
          <td class="center recent-dots">${recentRunDots}</td>
          <td class="center date-cell">${new Date(r.lastSeen).toLocaleDateString()}</td>
        </tr>`;
      })
      .join("");

    // ── Full HTML ───────────────────────────────────────────────────────────
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Test Reliability Monitor</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      /* cspell: disable-next-line */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      min-height: 100vh;
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%);
      padding: 32px 40px;
      color: #fff;
    }
    .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; }
    .header p  { font-size: 13px; opacity: 0.75; }
    .generated { font-size: 11px; opacity: 0.55; margin-top: 6px; }

    /* ── Stats ── */
    .stats {
      display: flex;
      gap: 16px;
      padding: 24px 40px;
      flex-wrap: wrap;
    }
    .stat-card {
      background: #fff;
      border-radius: 10px;
      padding: 18px 24px;
      flex: 1;
      min-width: 130px;
      box-shadow: 0 1px 3px rgba(0,0,0,.07);
      border-top: 3px solid #e2e8f0;
    }
    .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
    .stat-value { font-size: 34px; font-weight: 700; }
    .stat-value.green   { color: #16a34a; }
    .stat-value.red     { color: #dc2626; }
    .stat-value.orange  { color: #ea580c; }
    .stat-value.yellow  { color: #ca8a04; }
    .stat-value.neutral { color: #1e3a5f; }

    /* ── Filters ── */
    .filters {
      padding: 0 40px 16px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-label { font-size: 13px; color: #64748b; margin-right: 4px; }
    .filter-btn {
      padding: 6px 16px;
      border-radius: 20px;
      border: 1.5px solid #cbd5e1;
      background: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
      color: #475569;
    }
    .filter-btn:hover, .filter-btn.active { background: #1e3a5f; color: #fff; border-color: #1e3a5f; }
    .search-box {
      margin-left: auto;
      padding: 6px 14px;
      border-radius: 20px;
      border: 1.5px solid #cbd5e1;
      font-size: 13px;
      outline: none;
      width: 240px;
    }
    .search-box:focus { border-color: #1d4ed8; }

    /* ── Table ── */
    .table-wrap {
      padding: 0 40px 40px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
      overflow: hidden;
    }
    thead { background: #1e3a5f; }
    thead th {
      color: #fff;
      text-align: left;
      padding: 14px 16px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .4px;
    }
    thead th.center { text-align: center; }

    tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .1s; }
    tbody tr:hover { background: #f8fafc; }
    tbody tr.stable-row { opacity: 0.6; }
    tbody td { padding: 14px 16px; font-size: 13px; vertical-align: top; }
    td.center { text-align: center; vertical-align: middle; }

    .test-name { font-weight: 600; color: #1e293b; margin-bottom: 2px; }
    .test-file { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
    .error-msg {
      font-size: 11px;
      color: #b91c1c;
      background: #fef2f2;
      padding: 4px 8px;
      border-radius: 4px;
      border-left: 3px solid #dc2626;
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 480px;
    }

    /* ── Badges ── */
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .4px;
    }
    .badge-high   { background: #fee2e2; color: #b91c1c; }
    .badge-medium { background: #ffedd5; color: #c2410c; }
    .badge-low    { background: #fef9c3; color: #854d0e; }
    .badge-stable { background: #dcfce7; color: #15803d; }

    /* ── Rate bar ── */
    .rate-bar-wrap {
      width: 80px;
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      margin: 0 auto 4px;
      overflow: hidden;
    }
    .rate-bar { height: 100%; border-radius: 3px; min-width: 2px; }
    .rate-label { font-size: 12px; font-weight: 700; color: #475569; }

    /* ── Recent dots ── */
    .recent-dots { font-size: 16px; letter-spacing: 3px; }

    .date-cell { font-size: 12px; color: #94a3b8; white-space: nowrap; }

    /* ── No data ── */
    .no-data { text-align: center; padding: 60px; color: #94a3b8; font-size: 15px; }

    /* ── Hidden row ── */
    .hidden { display: none !important; }
  </style>
</head>
<body>

<div class="header">
  <h1>🔍 Test Reliability Monitor</h1>
  <p>Tracks tests that fail intermittently and pass on retry — automatically, across every run.</p>
  <div class="generated">Generated: ${summary.generatedAt} &nbsp;|&nbsp; ${summary.totalTests} tests tracked</div>
</div>

${statCards}

<div class="filters">
  <span class="filter-label">Filter:</span>
  <button class="filter-btn active" onclick="filterRisk('ALL')">All</button>
  <button class="filter-btn" onclick="filterRisk('HIGH')">🔴 High Risk</button>
  <button class="filter-btn" onclick="filterRisk('MEDIUM')">🟠 Medium Risk</button>
  <button class="filter-btn" onclick="filterRisk('LOW')">🟡 Low Risk</button>
  <button class="filter-btn" onclick="filterRisk('STABLE')">🟢 Stable Only</button>
  <input class="search-box" type="text" placeholder="Search test name…" oninput="searchTests(this.value)"/>
</div>

<div class="table-wrap">
  ${
    summary.results.length === 0
      ? '<div class="no-data">No test data yet. Run your test suite at least once with retries enabled.</div>'
      : `
  <table id="mainTable">
    <thead>
      <tr>
        <th>Test</th>
        <th class="center">Risk</th>
        <th class="center">Flaky Rate</th>
        <th class="center">Flaky / Total</th>
        <th class="center">Recent Runs</th>
        <th class="center">Last Seen</th>
      </tr>
    </thead>
    <tbody id="tableBody">
      ${tableRows}
    </tbody>
  </table>`
  }
</div>

<script>
  let currentRisk = 'ALL';
  let currentSearch = '';

  function filterRisk(risk) {
    currentRisk = risk;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    applyFilters();
  }

  function searchTests(query) {
    currentSearch = query.toLowerCase();
    applyFilters();
  }

  function applyFilters() {
    document.querySelectorAll('#tableBody .test-row').forEach(row => {
      const risk      = row.getAttribute('data-risk');
      const titleEl   = row.querySelector('.test-name');
      const title     = titleEl ? titleEl.textContent.toLowerCase() : '';
      const riskMatch = currentRisk === 'ALL' || risk === currentRisk;
      const textMatch = title.includes(currentSearch);
      row.classList.toggle('hidden', !(riskMatch && textMatch));
    });
  }
</script>

</body>
</html>`;
  }
}
