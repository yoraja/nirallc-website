/* cobio24 beta — company search + full report preview
   Data: MCA "RoC-wise Company Master Data" via data.gov.in (GODL-India).
   Bundled index = demo subset; live lookups hit the public Data API by CIN.
   Full report = complete 14-section format; live sections populated, pipeline
   sections rendered in-structure with pre-filled free-source lookups. */
(function () {
  "use strict";

  var API_BASE = "https://api.data.gov.in/resource/4dbe5667-7b6b-41d7-82af-211562424d9a";
  var API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b"; // public sample key (per-CIN lookups only)
  var DEMO_CIN = "U72900MH2008PTC185044";
  var CIN_RE = /^[LUF][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z0-9]{3}[0-9]{6}$/;

  var $q = document.getElementById("q");
  var $suggest = document.getElementById("suggest");
  var $home = document.getElementById("home");
  var $report = document.getElementById("report");
  var $idxcount = document.getElementById("idxcount");

  var INDEX = [], byCIN = {}, demoData = null, activeIdx = -1;

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
  function titleCase(s) { return String(s || "").toLowerCase().replace(/\b([a-z])/g, function (m, c) { return c.toUpperCase(); }); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }
  function gq(terms) { return "https://www.google.com/search?q=" + encodeURIComponent(terms); }

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
  function showSuggestNote(msg) { $suggest.innerHTML = '<div class="snote">' + esc(msg) + "</div>"; $suggest.classList.add("open"); }
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
    var raw = $q.value.trim(), q = raw.toLowerCase();
    if (q.length < 2) { closeSuggest(); return; }
    var cinCandidate = raw.toUpperCase().replace(/\s/g, "");
    var isCIN = CIN_RE.test(cinCandidate);
    var hits = [];
    for (var i = 0; i < INDEX.length; i++) {
      var r = INDEX[i], rk = rank(r, q);
      if (rk < 9) { hits.push([rk, r]); if (hits.length > 400) break; }
    }
    hits.sort(function (a, b) { return a[0] - b[0] || a[1].n.length - b[1].n.length; });
    hits = hits.slice(0, 15);
    var html = "";
    if (isCIN) html += '<button class="srow live" data-cin="' + esc(cinCandidate) + '"><div class="nm">🔎 Live registry lookup: ' + esc(cinCandidate) + '</div><div class="meta">Query data.gov.in Data API (3.67M records) for this CIN</div></button>';
    hits.forEach(function (h) {
      var r = h[1];
      var nm = esc(r.n).replace(new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "i"), "<mark>$1</mark>");
      var st = (r.s || "").toLowerCase().indexOf("active") === 0 ? '<span class="pill ok">' + esc(r.s) + "</span>" : '<span class="pill bad">' + esc(r.s || "?") + "</span>";
      var demo = r.c === DEMO_CIN ? ' <span class="pill warn">FULL DEMO REPORT</span>' : "";
      html += '<button class="srow" data-cin="' + esc(r.c) + '"><div class="nm">' + nm + demo + '</div><div class="meta"><span>' + esc(r.c) + "</span><span>" + esc(titleCase(r.st || "")) + "</span>" + st + "</div></button>";
    });
    if (!html) html = '<div class="snote">No match in the bundled demo index (' + INDEX.length.toLocaleString("en-IN") + ' companies). Paste a full 21-character CIN for a live lookup of all 3.67M records — or this name may use different spelling in the registry.</div>';
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
    if (m) showReport(m[1].toUpperCase());
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
    return { c: rec.CIN, n: rec.CompanyName, r: rec.CompanyROCcode, cat: rec.CompanyCategory, sub: rec.CompanySubCategory, cl: rec.CompanyClass, ac: rec.AuthorizedCapital, pc: rec.PaidupCapital, d: rec.CompanyRegistrationdate_date, ad: rec.Registered_Office_Address, l: rec.Listingstatus, s: rec.CompanyStatus, st: rec.CompanyStateCode, ic: rec.CompanyIndustrialClassification, nic: rec.nic_code };
  }

  /* ---------- shared render helpers ---------- */
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

  function pendRow(cols, source, link, linkLabel) {
    return '<tr><td colspan="' + cols + '" style="text-align:center;padding:14px;color:var(--muted);">⏳ Awaiting pipeline · source: ' + source +
      (link ? ' · <a target="_blank" rel="noopener" href="' + link + '">' + esc(linkLabel || "open source →") + "</a>" : "") + "</td></tr>";
  }

  /* ---------- full demo report (BIGV) ---------- */
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
    ai.signals.forEach(function (s) { h += '<div class="ai-item' + (s.flag ? " flag" : "") + '"><b>' + esc(s.label) + "</b>" + esc(s.text) + "</div>"; });
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
    d.gst.registrations.forEach(function (g2) { h += "<tr><td>" + esc(g2.gstin) + "</td><td>" + esc(g2.state) + "</td><td>" + esc(g2.status) + "</td><td>" + esc(g2.since) + "</td><td>" + esc(g2.latest) + "</td></tr>"; });
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

  /* ---------- full report preview (any company) ---------- */
  function waterfallCard(row) {
    var name = row.n || row.c;
    var listed = String(row.l || "").toLowerCase() === "listed";
    var rows = [
      { k: "Listed on BSE/NSE", v: listed ? "YES — full financials free on exchanges" : "No (per MCA master data)", live: true, ok: listed, link: listed ? gq('"' + name + '" financial results site:bseindia.com OR site:nseindia.com') : null, label: "find exchange filings" },
      { k: "Credit-rated (CRA rationale carries key financials)", v: "Check the 7 CRA sites", live: false, link: gq('"' + name + '" "rating rationale" OR "press release" site:crisilratings.com OR site:icra.in OR site:careratings.com OR site:indiaratings.co.in OR site:acuite.in OR site:infomerics.com'), label: "search CRA rationales" },
      { k: "Listed debt (Reg 52 quarterly results on exchanges)", v: "Check BSE/NSE debt segment", live: false, link: gq('"' + name + '" "financial results" debt NCD site:bseindia.com OR site:nseindia.com'), label: "search debt filings" },
      { k: "DRHP filed with SEBI (3 yrs restated financials)", v: "Check SEBI public issues", live: false, link: gq('"' + name + '" DRHP site:sebi.gov.in'), label: "search SEBI filings" },
      { k: "Subsidiary of a listed parent (s.136 / AOC-1)", v: "Check parent annual report", live: false, link: gq('"' + name + '" "AOC-1" OR subsidiary "annual report"'), label: "search AOC-1 / parent AR" },
      { k: "None of the above", v: "Source = MCA View Public Documents (₹100/company)", live: false, link: "https://www.mca.gov.in/content/mca/global/en/mca/document-related-services/view-public-documents-v3.html", label: "open MCA VPD" }
    ];
    var h = '<div class="card"><h2>Financials Source Waterfall ' + srcBadge("free", "MCA-ALTERNATE FREE ROUTES") + '</h2>' +
      '<p style="font-size:12.5px;color:var(--muted);margin-bottom:8px;">Before paying MCA ₹100, the pipeline checks every free route to this company\'s financials — in this order:</p><div class="scrollx"><table><tr><th>Route</th><th>Status for this company</th><th>Check</th></tr>';
    rows.forEach(function (r) {
      var status = r.live ? (r.ok ? '<b style="color:var(--free);">' + esc(r.v) + "</b>" : esc(r.v) + ' <span class="pill info">LIVE ✓</span>') : esc(r.v) + ' <span class="pill warn">MANUAL / PIPELINE</span>';
      h += "<tr><td><b>" + esc(r.k) + "</b></td><td>" + status + "</td><td>" + (r.link ? '<a target="_blank" rel="noopener" href="' + r.link + '">' + esc(r.label) + " →</a>" : "—") + "</td></tr>";
    });
    return h + "</table></div></div>";
  }

  function derivedComplianceCard(row) {
    var s = String(row.s || "");
    var sl = s.toLowerCase();
    var struck = sl.indexOf("strike") > -1 || sl.indexOf("struck") > -1;
    var activeOk = sl.indexOf("active") === 0;
    var badge = function (ok, txt) { return (ok ? '<b style="color:var(--free);">' : '<b style="color:var(--paid);">') + esc(txt) + "</b>"; };
    return '<div class="card"><h2>Registry Compliance Flags ' + srcBadge("free", "MCA master data — LIVE") + '</h2><div class="kv">' +
      "<div><b>Registry status</b><span>" + badge(activeOk, s || "Unknown") + "</span></div>" +
      "<div><b>Struck-off signal</b><span>" + badge(!struck, struck ? "Strike-off status on record" : "No strike-off status in master data") + "</span></div>" +
      "<div><b>Listing</b><span>" + esc(row.l || "—") + "</span></div>" +
      "<div><b>Insolvency (IBBI)</b><span><a target=\"_blank\" rel=\"noopener\" href=\"https://ibbi.gov.in/en/claims/pub-process/" + esc(row.c) + '">Check IBBI process page for this CIN →</a></span></div>' +
      "</div></div>";
  }

  function shellSections(row) {
    var name = row.n || "";
    var h = "";
    h += '<div class="card"><h2>Compliance Pulse™ ' + srcBadge("calc", "PIPELINE — computed from free signals") + '</h2>' +
      '<div class="pulse-line"><span class="pulse-score" style="color:var(--muted);">—<span style="font-size:16px;">/100</span></span><span class="pulse-band" style="color:var(--muted);">COMPUTED ON ORDER</span></div>' +
      '<div class="scrollx"><table><tr><th>Signal</th><th>Source (all free)</th><th class="n">Weight</th></tr>' +
      "<tr><td>GST filing discipline</td><td>GSTN filing table</td><td class='n'>30%</td></tr>" +
      "<tr><td>EPFO payment behaviour</td><td>EPFO TRRN records</td><td class='n'>30%</td></tr>" +
      "<tr><td>MCA standing</td><td>Master data (live above)</td><td class='n'>20%</td></tr>" +
      "<tr><td>Credit events</td><td>Charges / IBBI / CIBIL</td><td class='n'>15%</td></tr>" +
      "<tr><td>MSME payment complaints</td><td>MSME Samadhaan</td><td class='n'>5%</td></tr>" +
      '</table></div><p style="font-size:11px;color:var(--muted);margin-top:6px;">See the <a href="#/c/' + DEMO_CIN + '">completed demo report</a> for a computed Pulse.</p></div>';

    h += '<div class="card"><h2>AI Analyst Summary ' + srcBadge("calc", "PIPELINE — AI-generated") + '</h2><div class="locked">🤖 Written automatically once the sections below are populated: one-line verdict, growth &amp; strength read, red-flag digest (remuneration vs profit, related-party concentration, filing gaps), litigation posture, notable shareholders.</div></div>';

    h += waterfallCard(row);

    h += '<div class="card"><h2>Balance Sheet &amp; P&amp;L (12 years) ' + srcBadge("paid", "MCA AOC-4 — via waterfall or ₹100") + '</h2><div class="scrollx"><table><tr><th></th><th class="n">FY (latest−2)</th><th class="n">FY (latest−1)</th><th class="n">FY (latest)</th></tr>' +
      "<tr><td>Net Revenue</td>" + "<td class='n'>—</td>".repeat(3) + "</tr>" +
      "<tr><td>EBITDA</td>" + "<td class='n'>—</td>".repeat(3) + "</tr>" +
      "<tr><td>Profit for the Period</td>" + "<td class='n'>—</td>".repeat(3) + "</tr>" +
      "<tr><td>Total Equity</td>" + "<td class='n'>—</td>".repeat(3) + "</tr>" +
      "<tr><td>Total Assets</td>" + "<td class='n'>—</td>".repeat(3) + "</tr>" +
      pendRow(4, "AOC-4 filings (waterfall above decides free vs ₹100)", null) +
      "</table></div></div>";

    h += '<div class="card"><h2>Key Ratios &amp; Peer Comparison ' + srcBadge("calc", "DERIVED after financials") + '</h2><div class="scrollx"><table><tr><th>Metric</th><th class="n">Company</th><th class="n">Industry median</th></tr>' +
      ["Revenue Growth (%)", "EBITDA Margin (%)", "ROCE (%)", "Debt / Equity", "Interest Coverage"].map(function (m) { return "<tr><td>" + m + "</td><td class='n'>—</td><td class='n'>—</td></tr>"; }).join("") +
      "</table></div></div>";

    h += '<div class="card"><h2>Shareholding &amp; Securities ' + srcBadge("paid", "MGT-7 / PAS-3 — via ₹100 docs") + '</h2><div class="scrollx"><table><tr><th>Holder</th><th class="n">%</th><th>Remarks</th></tr>' + pendRow(3, "MGT-7 annual return", null) + "</table></div></div>";

    h += '<div class="card"><h2>Directors &amp; Signatories ' + srcBadge("free", "MCA DIN data — FREE") + '</h2><div class="scrollx"><table><tr><th>Name</th><th>DIN</th><th>Role</th><th>Tenure</th><th>Other directorships</th></tr>' +
      pendRow(5, "MCA V3 director master data (free, captcha-gated)", "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do", "open MCA search") +
      '</table></div><p style="font-size:11px;color:var(--muted);margin-top:6px;">Names, DINs and directorship networks only — no personal contact details, by design.</p></div>';

    h += '<div class="card"><h2>Charges (Borrowing Security) ' + srcBadge("free", "MCA Index of Charges — FREE") + '</h2><div class="scrollx"><table><tr><th>Holder</th><th class="n">Amount</th><th>Created</th><th>Status</th></tr>' +
      pendRow(4, "MCA Index of Charges (free, captcha-gated)", "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do", "open MCA search") + "</table></div></div>";

    h += '<div class="card"><h2>GST Registrations &amp; Filing Discipline ' + srcBadge("cond", "GSTN — FREE* (captcha)") + '</h2><div class="scrollx"><table><tr><th>GSTIN</th><th>State</th><th>Status</th><th>Filing history</th></tr>' +
      pendRow(4, "gst.gov.in Search Taxpayer (by PAN) + Show Filing Table", "https://services.gst.gov.in/services/searchtp", "open GST search") + "</table></div></div>";

    h += '<div class="card"><h2>EPFO Payment Behaviour ' + srcBadge("cond", "EPFO — FREE* (captcha)") + '</h2><div class="scrollx"><table><tr><th>Establishment</th><th class="n">Employees</th><th class="n">Amount</th><th>Timeliness</th></tr>' +
      pendRow(4, "EPFO establishment + TRRN search — search “" + esc(name) + "”", "https://unifiedportal-epfo.epfindia.gov.in/publicPortal/no-auth/misReport/home/loadEstSearchHome", "open EPFO search") + "</table></div></div>";

    h += '<div class="card"><h2>Legal History ' + srcBadge("cond", "eCourts ecosystem — FREE*") + '</h2><div class="scrollx"><table><tr><th>Court</th><th>Case</th><th>Party role</th><th>Status</th></tr>' +
      pendRow(4, "eCourts party-name search — search “" + esc(name) + "”", "https://services.ecourts.gov.in/ecourtindia_v6/", "open eCourts") + "</table></div></div>";

    h += '<div class="card"><h2>Credit Ratings &amp; Bureau Flags ' + srcBadge("free", "CRA sites / CIBIL — FREE") + '</h2><div class="scrollx"><table><tr><th>Agency</th><th>Instrument</th><th>Rating</th><th>Date</th></tr>' +
      pendRow(4, "SEBI-mandated CRA rationales + CIBIL suit-filed lists", gq('"' + name + '" "rating rationale" OR "press release" site:crisilratings.com OR site:icra.in OR site:careratings.com OR site:indiaratings.co.in OR site:acuite.in'), "search rationales") + "</table></div></div>";

    h += '<div class="note"><b>Why some sections are pending:</b> GST, EPFO and court portals are captcha-gated and block cross-site requests, so a browser-only app cannot fetch them — the production pipeline (server-side, per the cobio24 roadmap) automates exactly these pulls. Everything marked LIVE above came from open APIs in real time. Use the links to pull any pending section manually today.</div>';
    return h;
  }

  /* ---------- report page ---------- */
  function showReport(cin) {
    $home.style.display = "none";
    $report.style.display = "block";
    window.scrollTo(0, 0);

    var row = byCIN[cin] || null;
    var isDemo = cin === DEMO_CIN;
    document.title = (row ? row.n + " — " : "") + "cobio24 report";

    function render(r, liveState) {
      var chips = "";
      if (r) {
        chips += (String(r.s || "").toLowerCase().indexOf("active") === 0 ? '<span class="pill ok">' : '<span class="pill bad">') + esc(r.s || "—") + "</span>";
        if (r.l) chips += '<span class="pill info">' + esc(r.l) + "</span>";
        if (r.cl) chips += '<span class="pill info">' + esc(r.cl) + "</span>";
        if (isDemo) chips += '<span class="pill warn">FULL DEMO REPORT</span>';
      }
      var h = '<div class="backbar"><button class="backbtn" onclick="history.length>1?history.back():location.hash=\'\'">← Search</button>' +
        '<button class="backbtn" onclick="window.print()" title="Print or save as PDF">🖨 Print / PDF</button></div>' +
        '<div class="cohead"><h1>' + esc(r ? r.n : cin) + '</h1><div class="chips">' + chips + "</div></div>";
      if (r) h += masterCard(r, liveState);
      else h += '<div class="err">This CIN was not found in the bundled index and the live registry lookup failed. Check the CIN, or retry when online.</div>';

      if (isDemo) {
        h += demoData ? demoSections(demoData) : '<div class="card"><div class="skel" style="width:60%"></div><br><div class="skel"></div><br><div class="skel" style="width:80%"></div></div>';
      } else if (r) {
        h += '<div class="card" id="fullreport-cta" style="text-align:center;">' +
          '<h2 style="justify-content:center;">Full Due-Diligence Report</h2>' +
          '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Complete 14-section format — financials, shareholding, directors, charges, GST &amp; EPFO discipline, litigation, ratings, Compliance Pulse™ and AI analyst summary.</p>' +
          '<button class="backbtn" style="background:var(--brand);color:#fff;border:none;font-size:14px;padding:12px 22px;" onclick="window.c24ToggleFull()">📄 Generate Full Report (free preview)</button>' +
          '<p style="font-size:11px;color:var(--muted);margin-top:8px;">Live sections populate instantly; gated sections render in-structure with their free-source lookups pre-filled.</p></div>' +
          '<div id="fullreport" style="display:none;">' + derivedComplianceCard(r) + shellSections(r) + "</div>";
      }
      $report.innerHTML = h;
    }

    window.c24ToggleFull = function () {
      var el = document.getElementById("fullreport");
      var cta = document.getElementById("fullreport-cta");
      if (el) { el.style.display = "block"; if (cta) cta.style.display = "none"; window.scrollTo({ top: el.offsetTop - 70, behavior: "smooth" }); }
    };

    render(row, row ? "Showing bundled index data · refreshing live from data.gov.in…" : "Looking up live from data.gov.in…");

    if (isDemo && !demoData) {
      fetch("data/bigv-demo.json").then(function (x) { return x.json(); }).then(function (d) { demoData = d; if (location.hash.indexOf(cin) > -1) render(byCIN[cin] || null, lastLiveState); });
    }

    var lastLiveState = row ? "Bundled index data (live refresh unavailable)" : "";
    liveFetch(cin).then(function (liveRow) {
      if (location.hash.indexOf(cin) === -1) return;
      var wasOpen = document.getElementById("fullreport") && document.getElementById("fullreport").style.display !== "none";
      if (liveRow) {
        byCIN[cin] = liveRow;
        lastLiveState = '<span class="ok">✓ Live from data.gov.in</span> · fetched ' + new Date().toLocaleTimeString() + " · dataset snapshot up to 3 Nov 2023 · GODL-India";
        render(liveRow, lastLiveState);
      } else if (row) {
        lastLiveState = "Bundled index data · CIN not returned by the live API";
        render(row, lastLiveState);
      } else {
        render(null, "");
      }
      if (wasOpen) window.c24ToggleFull();
    }).catch(function () {
      if (location.hash.indexOf(cin) === -1) return;
      if (row) { lastLiveState = "Bundled index data · live API unreachable (rate limit or offline)"; render(row, lastLiveState); }
      else render(null, "");
    });
  }

  route();
})();
