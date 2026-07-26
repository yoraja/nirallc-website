/* cobio24 beta — company search + report preview
   Data: MCA "RoC-wise Company Master Data" via data.gov.in (GODL-India).
   Bundled index = demo subset; live lookups hit the public Data API by CIN. */
(function () {
  "use strict";

  var API_BASE = "https://api.data.gov.in/resource/4dbe5667-7b6b-41d7-82af-211562424d9a";
  var API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"; // public sample key (rate-limited)
  var DEMO_CIN = "U72900MH2008PTC185044";
  var CIN_RE = /^[LUF][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z0-9]{3}[0-9]{6}$/;

  var $q = document.getElementById("q");
  var $suggest = document.getElementById("suggest");
  var $home = document.getElementById("home");
  var $report = document.getElementById("report");
  var $idxcount = document.getElementById("idxcount");

  var INDEX = [];      // bundled rows
  var byCIN = {};      // CIN -> row
  var demoData = null; // bigv-demo.json cache
  var activeIdx = -1;  // keyboard nav

  /* ---------- utils ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtINR(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "—";
    return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }
  function fmtCr(n) {
    var v = Number(n); if (isNaN(v)) return "—";
    if (Math.abs(v) >= 1e7) return "₹" + (v / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Cr";
    if (Math.abs(v) >= 1e5) return "₹" + (v / 1e5).toLocaleString("en-IN", { maximumFractionDigits: 1 }) + " L";
    return fmtINR(n);
  }
  function titleCase(s) {
    return String(s || "").toLowerCase().replace(/\b([a-z])/g, function (m, c) { return c.toUpperCase(); });
  }
  function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }

  /* ---------- index load ---------- */
  fetch("data/companies.json").then(function (r) { return r.json(); }).then(function (rows) {
    INDEX = rows || [];
    INDEX.forEach(function (r) { if (r.c) byCIN[r.c] = r; });
    $idxcount.textContent = INDEX.length.toLocaleString("en-IN");
  }).catch(function () {
    $idxcount.textContent = "0";
    showSuggestNote("Search index failed to load — full-CIN live lookup still works.");
  });

  /* ---------- search ---------- */
  function showSuggestNote(msg) {
    $suggest.innerHTML = '<div class="snote">' + esc(msg) + "</div>";
    $suggest.classList.add("open");
  }
  function closeSuggest() { $suggest.classList.remove("open"); $suggest.innerHTML = ""; activeIdx = -1; }

  function rank(row, q) {
    var n = row.n.toLowerCase();
    if (n.indexOf(q) === 0) return 0;
    if (n.indexOf(" " + q) > -1) return 1;
    if (n.indexOf(q) > -1) return 2;
    if (row.c && row.c.toLowerCase().indexOf(q) === 0) return 3;
    return 9;
  }

  function doSearch() {
    var raw = $q.value.trim();
    var q = raw.toLowerCase();
    if (q.length < 2) { closeSuggest(); return; }

    var cinCandidate = raw.toUpperCase().replace(/\s/g, "");
    var isCIN = CIN_RE.test(cinCandidate);
    var hits = [];
    for (var i = 0; i < INDEX.length; i++) {
      var r = INDEX[i];
      var rk = rank(r, q);
      if (rk < 9) { hits.push([rk, r]); if (hits.length > 400) break; }
    }
    hits.sort(function (a, b) { return a[0] - b[0] || a[1].n.length - b[1].n.length; });
    hits = hits.slice(0, 15);

    var html = "";
    if (isCIN) {
      html += '<button class="srow live" data-cin="' + esc(cinCandidate) + '"><div class="nm">🔎 Live registry lookup: ' + esc(cinCandidate) + '</div><div class="meta">Query data.gov.in Data API (3.67M records) for this CIN</div></button>';
    }
    hits.forEach(function (h) {
      var r = h[1];
      var nm = esc(r.n).replace(new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "i"), "<mark>$1</mark>");
      var st = (r.s || "").toLowerCase().indexOf("active") === 0 ? '<span class="pill ok">' + esc(r.s) + "</span>" : '<span class="pill bad">' + esc(r.s || "?") + "</span>";
      var demo = r.c === DEMO_CIN ? ' <span class="pill warn">FULL DEMO REPORT</span>' : "";
      html += '<button class="srow" data-cin="' + esc(r.c) + '"><div class="nm">' + nm + demo + '</div><div class="meta"><span>' + esc(r.c) + "</span><span>" + esc(titleCase(r.st || "")) + "</span>" + st + "</div></button>";
    });
    if (!html) {
      html = '<div class="snote">No match in the bundled demo index (' + INDEX.length.toLocaleString("en-IN") + ' companies). Paste a full 21-character CIN for a live lookup of all 3.67M records — or this name may use different spelling in the registry.</div>';
    }
    $suggest.innerHTML = html;
    $suggest.classList.add("open");
    activeIdx = -1;
  }

  $q.addEventListener("input", debounce(doSearch, 130));
  $q.addEventListener("focus", function () { if ($q.value.trim().length >= 2) doSearch(); });
  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".srow") : null;
    if (btn && btn.dataset.cin) { closeSuggest(); location.hash = "#/c/" + btn.dataset.cin; return; }
    if (!e.target.closest || !e.target.closest(".searchbox")) closeSuggest();
    var tryLink = e.target.closest ? e.target.closest("[data-try]") : null;
    if (tryLink) { e.preventDefault(); $q.value = tryLink.dataset.try; $q.focus(); doSearch(); }
  });
  $q.addEventListener("keydown", function (e) {
    var rows = $suggest.querySelectorAll(".srow");
    if (!rows.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = e.key === "ArrowDown" ? Math.min(activeIdx + 1, rows.length - 1) : Math.max(activeIdx - 1, 0);
      rows.forEach(function (r, i) { r.classList.toggle("active", i === activeIdx); });
      rows[activeIdx].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      var pick = rows[activeIdx >= 0 ? activeIdx : 0];
      if (pick) { closeSuggest(); location.hash = "#/c/" + pick.dataset.cin; }
    } else if (e.key === "Escape") { closeSuggest(); }
  });

  /* ---------- routing ---------- */
  function route() {
    var m = location.hash.match(/^#\/c\/([A-Z0-9]{10,25})/i);
    if (m) { showReport(m[1].toUpperCase()); }
    else { $report.style.display = "none"; $home.style.display = "block"; document.title = "cobio24 — Indian Company Intelligence | NIRA LLC"; }
  }
  window.addEventListener("hashchange", route);

  /* ---------- live API ---------- */
  function liveFetch(cin) {
    var url = API_BASE + "?api-key=" + API_KEY + "&format=json&limit=2&filters%5BCIN%5D=" + encodeURIComponent(cin);
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) { return (j.records && j.records[0]) ? apiToRow(j.records[0]) : null; });
  }
  function apiToRow(rec) {
    return {
      c: rec.CIN, n: rec.CompanyName, r: rec.CompanyROCcode, cat: rec.CompanyCategory,
      sub: rec.CompanySubCategory, cl: rec.CompanyClass, ac: rec.AuthorizedCapital, pc: rec.PaidupCapital,
      d: rec.CompanyRegistrationdate_date, ad: rec.Registered_Office_Address, l: rec.Listingstatus,
      s: rec.CompanyStatus, st: rec.CompanyStateCode, ic: rec.CompanyIndustrialClassification, nic: rec.nic_code
    };
  }

  /* ---------- report ---------- */
  function srcBadge(kind, label) { return '<span class="src ' + kind + '">' + label + "</span>"; }

  function masterCard(row, liveState) {
    var g = function (v) { return v ? esc(v) : "—"; };
    return '<div class="card"><h2>Key Statistics ' + srcBadge("free", "MCA master data — FREE · GODL") + "</h2>" +
      '<div class="kv">' +
      "<div><b>Company Name</b><span>" + g(row.n) + "</span></div>" +
      "<div><b>CIN</b><span>" + g(row.c) + "</span></div>" +
      "<div><b>Status</b><span>" + g(row.s) + "</span></div>" +
      "<div><b>Class / Category</b><span>" + g([row.cl, row.cat].filter(Boolean).join(" · ")) + "</span></div>" +
      "<div><b>Listing</b><span>" + g(row.l || "—") + "</span></div>" +
      "<div><b>Incorporated</b><span>" + g(row.d) + "</span></div>" +
      "<div><b>Authorized Capital</b><span>" + fmtINR(row.ac) + "</span></div>" +
      "<div><b>Paid-up Capital</b><span>" + fmtINR(row.pc) + "</span></div>" +
      "<div><b>RoC / State</b><span>" + g([row.r, titleCase(row.st)].filter(Boolean).join(" · ")) + "</span></div>" +
      "<div><b>Industry (NIC)</b><span>" + g([row.ic, row.nic].filter(Boolean).join(" · ")) + "</span></div>" +
      '<div style="grid-column:1/-1;"><b>Registered Office</b><span>' + g(row.ad) + "</span></div>" +
      "</div>" +
      '<div class="livestat" id="livestat">' + liveState + "</div></div>";
  }

  function tableHTML(spec, moneyFmt) {
    var h = '<div class="scrollx"><table><tr><th></th>';
    spec.years.forEach(function (y) { h += '<th class="n">' + esc(y) + "</th>"; });
    h += "</tr>";
    spec.rows.forEach(function (r) {
      h += "<tr" + (r.total ? ' class="tot"' : "") + "><td>" + esc(r.label) + "</td>";
      r.v.forEach(function (v) { h += '<td class="n">' + (typeof v === "number" ? (moneyFmt ? fmtINR(v) : v) : esc(v)) + "</td>"; });
      h += "</tr>";
    });
    return h + "</table></div>";
  }

  function pulseCard(p) {
    var h = '<div class="card"><h2>Compliance Pulse™ ' + srcBadge("free", "GST + EPFO + MCA + Samadhaan — FREE") + "</h2>" +
      '<div class="pulse-line"><span class="pulse-score">' + p.composite + '<span style="font-size:16px;color:var(--muted);">/100</span></span><span class="pulse-band">' + esc(p.band) + "</span></div>" +
      '<p style="font-size:13px;margin:6px 0 10px;">' + esc(p.interpretation) + "</p><div class=\"scrollx\"><table><tr><th>Signal</th><th>Reading</th><th class=\"n\">Sub-score (weight)</th></tr>";
    p.signals.forEach(function (s) {
      h += "<tr><td><b>" + esc(s.name) + "</b><br><span style='color:var(--muted);font-size:11px;'>" + esc(s.source) + "</span></td><td>" + esc(s.reading) + '</td><td class="n"><b>' + s.score + "</b> — " + esc(s.band) + " (" + s.weight + "%)</td></tr>";
    });
    return h + "</table></div></div>";
  }

  function aiCard(ai) {
    var h = '<div class="card"><h2>AI Analyst Summary ' + srcBadge("calc", "AI-generated — DERIVED") + "</h2>" +
      '<p style="font-size:13.5px;font-weight:600;margin-bottom:6px;">' + esc(ai.oneLine) + "</p>";
    ai.signals.forEach(function (s) {
      h += '<div class="ai-item' + (s.flag ? " flag" : "") + '"><b>' + esc(s.label) + "</b>" + esc(s.text) + "</div>";
    });
    return h + '<p style="font-size:11px;color:var(--muted);margin-top:8px;">Every claim traces to a report section. Production adds chat-with-the-filing (cited Q&amp;A).</p></div>';
  }

  function demoSections(d) {
    var h = "";
    h += pulseCard(d.pulse);
    h += aiCard(d.aiSummary);
    h += '<div class="card"><h2>Balance Sheet (₹) ' + srcBadge("paid", "MCA AOC-4 — parsed for demo") + "</h2>" + tableHTML(d.financials.balanceSheet, true) + '<p style="font-size:11px;color:var(--muted);margin-top:6px;">Full report: 12 years (FY2014–FY2025) + consolidated.</p></div>';
    h += '<div class="card"><h2>Profit &amp; Loss (₹) ' + srcBadge("paid", "MCA AOC-4 — parsed for demo") + "</h2>" + tableHTML(d.financials.pnl, true) + "</div>";
    h += '<div class="card"><h2>Key Ratios ' + srcBadge("calc", "DERIVED") + "</h2>" + tableHTML(d.financials.ratios, false) + "</div>";

    h += '<div class="card"><h2>Peer Comparison ' + srcBadge("calc", "DERIVED — own database") + '</h2><div class="scrollx"><table><tr><th>Metric (FY2025)</th><th class="n">Company</th><th class="n">Industry median (30 peers)</th></tr>';
    d.peers.metrics.forEach(function (m) { h += "<tr><td>" + esc(m.label) + '</td><td class="n">' + esc(m.company) + '</td><td class="n">' + esc(m.median) + "</td></tr>"; });
    h += '</table></div><p style="font-size:11px;color:var(--muted);margin-top:6px;">Closest peers by revenue: ' + esc(d.peers.closest.join(" · ")) + "</p></div>";

    h += '<div class="card"><h2>Shareholding (&gt;5%, FY2025) ' + srcBadge("paid", "MGT-7 — parsed for demo") + '</h2><p style="font-size:12.5px;color:var(--muted);margin-bottom:8px;">' + esc(d.shareholding.summary) + '</p><div class="scrollx"><table><tr><th>Holder</th><th class="n">%</th><th>Remarks</th></tr>';
    d.shareholding.holders.forEach(function (s) { h += "<tr><td>" + esc(s.name) + '</td><td class="n">' + esc(s.pct) + "</td><td>" + esc(s.note) + "</td></tr>"; });
    h += "</table></div></div>";

    h += '<div class="card"><h2>Directors &amp; Signatories ' + srcBadge("free", "MCA DIN data — FREE") + '</h2><div class="scrollx"><table><tr><th>Name</th><th>DIN</th><th>Role</th><th>From</th><th>To</th><th>Flags</th></tr>';
    d.directors.forEach(function (x) { h += "<tr><td>" + esc(x.name) + "</td><td>" + esc(x.din) + "</td><td>" + esc(x.role) + "</td><td>" + esc(x.from) + "</td><td>" + esc(x.to) + "</td><td>" + esc(x.flag || "—") + "</td></tr>"; });
    h += '</table></div><p style="font-size:11px;color:var(--muted);margin-top:6px;">Auditor: ' + esc(d.auditor) + " · No director contact details are collected or displayed (privacy by design).</p></div>";

    h += '<div class="card"><h2>Charges (Borrowing Security) ' + srcBadge("free", "MCA Index of Charges — FREE") + '</h2><p style="font-size:12.5px;margin-bottom:6px;">Open charges: <b>none</b>. Satisfied history:</p><div class="scrollx"><table><tr><th>Holder</th><th class="n">Amount</th><th>Created</th><th>Satisfied</th><th>Security</th></tr>';
    d.charges.forEach(function (c) { h += "<tr><td>" + esc(c.holder) + '</td><td class="n">' + fmtCr(c.amount) + "</td><td>" + esc(c.created) + "</td><td>" + esc(c.satisfied) + "</td><td>" + esc(c.property) + "</td></tr>"; });
    h += "</table></div></div>";

    h += '<div class="card"><h2>GST Registrations &amp; Filing Discipline ' + srcBadge("cond", "GSTN — FREE* (captcha)") + '</h2><div class="scrollx"><table><tr><th>GSTIN</th><th>State</th><th>Status</th><th>Since</th><th>Latest filing</th></tr>';
    d.gst.registrations.forEach(function (g) { h += "<tr><td>" + esc(g.gstin) + "</td><td>" + esc(g.state) + "</td><td>" + esc(g.status) + "</td><td>" + esc(g.since) + "</td><td>" + esc(g.latest) + "</td></tr>"; });
    h += '</table></div><div class="scrollx" style="margin-top:8px;"><table><tr><th>Return</th><th>Period</th><th>Due</th><th>Filed</th><th>Status</th></tr>';
    d.gst.filings.forEach(function (f) { h += "<tr><td>" + esc(f.ret) + "</td><td>" + esc(f.period) + "</td><td>" + esc(f.due) + "</td><td>" + esc(f.filed) + "</td><td>" + esc(f.status) + "</td></tr>"; });
    h += "</table></div></div>";

    h += '<div class="card"><h2>EPFO Payment Behaviour ' + srcBadge("cond", "EPFO — FREE* (captcha)") + '</h2><p style="font-size:12.5px;margin-bottom:6px;">' + esc(d.epfo.establishment) + "<br><b style='color:var(--paid);'>⚠ " + esc(d.epfo.note) + '</b></p><div class="scrollx"><table><tr><th>Wage month</th><th class="n">Employees</th><th class="n">Amount</th><th>Due</th><th>Credited</th></tr>';
    d.epfo.months.forEach(function (m) { h += "<tr><td>" + esc(m.month) + '</td><td class="n">' + m.employees + '</td><td class="n">' + fmtINR(m.amount) + "</td><td>" + esc(m.due) + "</td><td>" + esc(m.credited) + "</td></tr>"; });
    h += "</table></div></div>";

    h += '<div class="card"><h2>Legal History ' + srcBadge("cond", "eCourts ecosystem — FREE*") + '</h2><p style="font-size:12.5px;margin-bottom:8px;">' + esc(d.legal.summary) + "</p><ul style='font-size:12.5px;padding-left:18px;'>";
    d.legal.highlights.forEach(function (x) { h += "<li style='margin:4px 0;'>" + esc(x) + "</li>"; });
    h += "</ul></div>";

    h += '<div class="card"><h2>Ratings &amp; Compliance Flags ' + srcBadge("free", "CRA / MCA / IBBI / bureaus — FREE") + '</h2><div class="kv">' +
      "<div><b>Credit ratings</b><span>" + esc(d.compliance.ratings) + "</span></div>" +
      "<div><b>Struck-off</b><span>" + esc(d.compliance.struckOff) + "</span></div>" +
      "<div><b>BIFR / CDR</b><span>" + esc(d.compliance.bifr) + "</span></div>" +
      "<div><b>Suit-filed (bureaus)</b><span>" + esc(d.compliance.suitFiled) + "</span></div>" +
      "</div></div>";

    h += '<div class="note"><b>Source waterfall for this company:</b> not credit-rated · no listed debt · no DRHP · not a listed parent\'s subsidiary → financials source = MCA VPD (₹100). Sections above were parsed from source filings for this demonstration report.</div>';
    return h;
  }

  function pipelineSections(row) {
    var name = encodeURIComponent(row.n || "");
    var links = [
      { t: "MCA — company / charges / directors", d: "Master data, index of charges, signatories (free, captcha)", u: "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do" },
      { t: "GST — Search Taxpayer & filing table", d: "GSTINs by PAN, month-by-month return filings (free, captcha)", u: "https://services.gst.gov.in/services/searchtp" },
      { t: "EPFO — establishment search", d: "Headcount, wage months, payment timeliness (free, captcha)", u: "https://unifiedportal-epfo.epfindia.gov.in/publicPortal/no-auth/misReport/home/loadEstSearchHome" },
      { t: "eCourts — party name search", d: "District & High Court cases by/against (free, captcha)", u: "https://services.ecourts.gov.in/ecourtindia_v6/" },
      { t: "IBBI — insolvency processes", d: "CIRP announcements, claims, orders (free)", u: "https://ibbi.gov.in/en/claims/corporate-personals" },
      { t: "CIBIL — suit-filed & wilful defaulters", d: "₹1 Cr+ suit-filed accounts, wilful defaulters (free)", u: "https://suit.cibil.com/" },
      { t: "Credit ratings — CRA rationales", d: "CRISIL / ICRA / CARE / Ind-Ra / Acuité press releases (free)", u: "https://www.careratings.com/ratings" },
      { t: "MSME Samadhaan — payment complaints", d: "Delayed-payment cases as respondent (free)", u: "https://samadhaan.msme.gov.in/MyMsme/MSEFC/MSEFC_Welcome.aspx" }
    ];
    var h = '<div class="card"><h2>Compliance Pulse™ &amp; AI Analyst Summary ' + srcBadge("calc", "PIPELINE") + '</h2>' +
      '<div class="locked">🔒 Generated when a full report is ordered.<br>The production pipeline pulls this company\'s GST filing discipline, EPFO payment behaviour, litigation, ratings and financials, computes the Pulse score, and writes the AI analyst digest — see the <a href="#/c/' + DEMO_CIN + '">full demo report</a> for the finished format.</div></div>';
    h += '<div class="card"><h2>Free public sources for this company ' + srcBadge("free", "OPEN THE SOURCE") + '</h2><div class="srcgrid">';
    links.forEach(function (l) {
      h += '<a class="srclink" target="_blank" rel="noopener" href="' + l.u + '"><div><div class="t">' + esc(l.t) + '</div><div class="d">' + esc(l.d) + '</div></div><span class="go">Open →</span></a>';
    });
    h += '</div><p style="font-size:11px;color:var(--muted);margin-top:8px;">These are the same free sources the automated pipeline uses. Search this company by name' + (row.n ? " (“" + esc(row.n) + "”)" : "") + ' or CIN on each portal.</p></div>';
    return h;
  }

  function showReport(cin) {
    $home.style.display = "none";
    $report.style.display = "block";
    window.scrollTo(0, 0);

    var row = byCIN[cin] || null;
    var isDemo = cin === DEMO_CIN;
    document.title = (row ? row.n + " — " : "") + "cobio24 report preview";

    function render(r, liveState) {
      var chips = "";
      if (r) {
        chips += (String(r.s || "").toLowerCase().indexOf("active") === 0 ? '<span class="pill ok">' : '<span class="pill bad">') + esc(r.s || "—") + "</span>";
        if (r.l) chips += '<span class="pill info">' + esc(r.l) + "</span>";
        if (r.cl) chips += '<span class="pill info">' + esc(r.cl) + "</span>";
        if (isDemo) chips += '<span class="pill warn">FULL DEMO REPORT</span>';
      }
      var h = '<div class="backbar"><button class="backbtn" onclick="history.length>1?history.back():location.hash=\'\'">← Search</button></div>' +
        '<div class="cohead"><h1>' + esc(r ? r.n : cin) + '</h1><div class="chips">' + chips + "</div></div>";
      if (r) h += masterCard(r, liveState);
      else h += '<div class="err">This CIN was not found in the bundled index and the live registry lookup failed. Check the CIN, or retry when online.</div>';

      if (isDemo) {
        h += demoData ? demoSections(demoData) : '<div class="card"><div class="skel" style="width:60%"></div><br><div class="skel"></div><br><div class="skel" style="width:80%"></div></div>';
      } else if (r) {
        h += pipelineSections(r);
      }
      $report.innerHTML = h;
    }

    render(row, row ? "Showing bundled index data · refreshing live from data.gov.in…" : "Looking up live from data.gov.in…");

    if (isDemo && !demoData) {
      fetch("data/bigv-demo.json").then(function (x) { return x.json(); }).then(function (d) { demoData = d; if (location.hash.indexOf(cin) > -1) render(byCIN[cin] || apiRowCache || null, lastLiveState); });
    }

    var apiRowCache = null, lastLiveState = row ? "Bundled index data (live refresh unavailable)" : "";
    liveFetch(cin).then(function (liveRow) {
      if (location.hash.indexOf(cin) === -1) return;
      if (liveRow) {
        apiRowCache = liveRow; byCIN[cin] = liveRow;
        lastLiveState = '<span class="ok">✓ Live from data.gov.in</span> · fetched ' + new Date().toLocaleTimeString() + " · dataset snapshot up to 3 Nov 2023 · GODL-India";
        render(liveRow, lastLiveState);
      } else if (row) {
        lastLiveState = "Bundled index data · CIN not returned by the live API";
        render(row, lastLiveState);
      } else {
        render(null, "");
      }
    }).catch(function () {
      if (location.hash.indexOf(cin) === -1) return;
      if (row) { lastLiveState = "Bundled index data · live API unreachable (rate limit or offline)"; render(row, lastLiveState); }
      else render(null, "");
    });
  }

  route();
})();
