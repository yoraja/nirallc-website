/* cobio24 beta — company search + full report preview
   Search index: 2.2M active Indian companies (MCA master data via data.gov.in, GODL-India),
   sharded by name prefix so the browser downloads only the slice it needs.
   Any company (incl. struck-off) is reachable by exact CIN through the live Data API. */
(function () {
  "use strict";

  var BUILD = "26072605";
  // Waterfall results are republished often; key their URL to a 10-minute bucket so a stale
  // copy can never sit in a browser cache the way it did on the 26 Jul 03:03 report.
  var WFV = Math.floor(Date.now() / 600000); // bump on every deploy — busts browser/CDN caches on data files
  var API_BASE = "https://api.data.gov.in/resource/4dbe5667-7b6b-41d7-82af-211562424d9a";
  var API_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";
  var DEMO_CIN = "U72900MH2008PTC185044";
  var CIN_RE = /^[LUF][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z0-9]{3}[0-9]{6}$/;
  var IDX = "data/idx/";
  var FP = "s_"; // shard filename prefix (dodges Windows-reserved names CON/PRN/AUX/NUL)

  var $q = document.getElementById("q");
  var $suggest = document.getElementById("suggest");
  var $home = document.getElementById("home");
  var $report = document.getElementById("report");
  var $idxcount = document.getElementById("idxcount");

  var manifest = null, deepSet = {}, suffixes = {}, statuses = {};
  var shardCache = {}, byCIN = {}, wfCache = {}, demoData = null, activeIdx = -1, searchSeq = 0;

  // always-available featured rows (demo reliability, independent of shard loading)
  var FEATURED = [
    { c: DEMO_CIN, n: "BIGV TELECOM PRIVATE LIMITED" },
    { c: "U73100KA2005PTC036337", n: "PROBE INFORMATION SERVICES PRIVATE LIMITED" },
    { c: "U72300KA2012PTC066088", n: "ZAUBA TECHNOLOGIES PRIVATE LIMITED" },
    { c: "L85110KA1989PLC009968", n: "TATA ELXSI LIMITED" },
    { c: "U74899DL1991PLC046774", n: "HERO FINCORP LIMITED" }
  ];
  FEATURED.forEach(function (r) { byCIN[r.c] = byCIN[r.c] || r; });

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
  function normKey(s, n) {
    var k = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!k) return Array(n + 1).join("_");
    return (k + "__").slice(0, n);
  }
  function stateFromCIN(cin) { return /^[LUF][0-9]{5}([A-Z]{2})/.test(cin) ? RegExp.$1 : ""; }

  /* ---------- manifest ---------- */
  fetch(IDX + "manifest.json?v=" + BUILD).then(function (r) { return r.json(); }).then(function (m) {
    manifest = m;
    (m.deep || []).forEach(function (p) { deepSet[p] = 1; });
    suffixes = m.suffixes || {};
    statuses = m.statuses || {};
    $idxcount.textContent = (m.total || 0).toLocaleString("en-IN");
  }).catch(function () {
    $idxcount.textContent = "unavailable";
    showSuggestNote("Search index failed to load — exact-CIN lookup still works.");
  });

  /* ---------- shard loading ---------- */
  function shardNameFor(query) {
    var k2 = normKey(query, 2);
    if (!deepSet[k2]) return { file: k2, partial: false };
    if (normKey(query, 3).length >= 3 && query.replace(/[^A-Za-z0-9]/g, "").length >= 3) {
      return { file: normKey(query, 3), partial: false };
    }
    return { file: k2 + "_top", partial: true };
  }
  function loadShard(file) {
    if (shardCache[file]) return Promise.resolve(shardCache[file]);
    return fetch(IDX + FP + file + ".json?v=" + BUILD).then(function (r) {
      if (!r.ok) throw new Error("no shard");
      return r.json();
    }).then(function (rows) {
      var out = rows.map(function (a) {
        var o = { c: a[0], n: a[1] + (suffixes[a[2]] || "") };
        if (a.length > 3) o.s = statuses[a[3]] || "Inactive";  // absent code === Active
        else o.s = "Active";
        return o;
      });
      shardCache[file] = out;
      out.forEach(function (r) { if (!byCIN[r.c]) byCIN[r.c] = r; });
      return out;
    }).catch(function () { shardCache[file] = []; return []; });
  }

  /* ---------- search ---------- */
  function showSuggestNote(msg) { $suggest.innerHTML = '<div class="snote">' + msg + "</div>"; $suggest.classList.add("open"); }
  function closeSuggest() { $suggest.classList.remove("open"); $suggest.innerHTML = ""; activeIdx = -1; }

  function renderSuggestions(rows, q, opts) {
    var html = "";
    if (opts.cin) {
      html += '<button class="srow live" data-cin="' + esc(opts.cin) + '"><div class="nm">🔎 Live registry lookup: ' + esc(opts.cin) +
        '</div><div class="meta">Query the full 3.67M-record registry for this exact CIN</div></button>';
    }
    rows.forEach(function (r) {
      var nm = esc(r.n).replace(new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "i"), "<mark>$1</mark>");
      var demo = r.c === DEMO_CIN ? ' <span class="pill warn">FULL DEMO REPORT</span>' : "";
      var st = r.s && r.s !== "Active"
        ? '<span class="pill bad">' + esc(r.s) + "</span>"
        : '<span class="pill ok">Active</span>';
      html += '<button class="srow" data-cin="' + esc(r.c) + '"><div class="nm">' + nm + demo +
        '</div><div class="meta"><span>' + esc(r.c) + "</span><span>" + esc(stateFromCIN(r.c)) + "</span>" + st + "</div></button>";
    });
    if (opts.partial) {
      html += '<div class="snote">Showing the largest matches by capital — type one more letter to search every company starting with “' + esc(q.slice(0, 2).toUpperCase()) + '”.</div>';
    } else if (!rows.length && !opts.cin) {
      html += '<div class="snote">No company starts with “' + esc(q) + '”. The index matches how a name <b>begins</b> — try the first word of the legal name, or paste an exact CIN.</div>';
    } else if (opts.more) {
      html += '<div class="snote">' + opts.more.toLocaleString("en-IN") + " more matches — keep typing to narrow.</div>";
    }
    $suggest.innerHTML = html;
    $suggest.classList.add("open");
    activeIdx = -1;
  }

  function doSearch() {
    var raw = $q.value.trim(), q = raw.toLowerCase();
    if (q.length < 2) { closeSuggest(); return; }
    var cinCandidate = raw.toUpperCase().replace(/\s/g, "");
    var cin = CIN_RE.test(cinCandidate) ? cinCandidate : null;

    var featured = FEATURED.filter(function (r) { return r.n.toLowerCase().indexOf(q) > -1; });
    var seq = ++searchSeq;
    var target = shardNameFor(raw);

    if (!shardCache[target.file]) {
      renderSuggestions(featured, q, { cin: cin, loading: true });
      var el = $suggest.querySelector(".snote");
      $suggest.insertAdjacentHTML("beforeend", '<div class="snote">Loading company index…</div>');
    }

    loadShard(target.file).then(function (rows) {
      if (seq !== searchSeq) return;
      var hits = [], qq = q;
      for (var i = 0; i < rows.length && hits.length < 400; i++) {
        if (rows[i].n.toLowerCase().indexOf(qq) === 0) hits.push(rows[i]);
      }
      if (hits.length < 15) {
        for (var j = 0; j < rows.length && hits.length < 400; j++) {
          if (rows[j].n.toLowerCase().indexOf(qq) > 0) hits.push(rows[j]);
        }
      }
      featured.forEach(function (f) {
        if (!hits.some(function (h) { return h.c === f.c; })) hits.unshift(f);
      });
      var shown = hits.slice(0, 15);
      renderSuggestions(shown, q, { cin: cin, partial: target.partial, more: hits.length > 15 ? hits.length - 15 : 0 });
    });
  }

  $q.addEventListener("input", debounce(doSearch, 140));
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

  /* ---------- render helpers ---------- */
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

  /* ---------- demo report ---------- */
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
  /* Key Financial Indicators lifted out of a rating rationale by the pipeline */
  function extractedFinancialsCard(wf) {
    var f = wf.financials;
    if (!f || !f.rows || !f.rows.length) return "";
    var h = '<div class="card"><h2>Financial Highlights ' +
      srcBadge("free", "EXTRACTED FROM " + esc((f.publisher || "rating rationale").toUpperCase()) + " — ₹0") + "</h2>" +
      '<p style="font-size:12px;color:var(--muted);margin-bottom:8px;">Read directly out of the published credit-rating rationale — the figures below are the agency\'s own key-indicator table, not an estimate.</p>' +
      '<div class="scrollx"><table>';
    if (f.headers && f.headers.length) {
      h += "<tr>";
      f.headers.forEach(function (c, i) { h += (i === 0 ? "<th>" : '<th class="n">') + esc(c) + "</th>"; });
      h += "</tr>";
    }
    f.rows.forEach(function (r) {
      h += "<tr>";
      r.forEach(function (c, i) { h += (i === 0 ? "<td>" : '<td class="n">') + esc(c) + "</td>"; });
      h += "</tr>";
    });
    h += "</table></div>";
    if (f.source) {
      h += '<p style="font-size:11px;color:var(--muted);margin-top:8px;">Source: <a target="_blank" rel="noopener" href="' +
        esc(f.source) + '">' + esc(f.title || f.source) + "</a></p>";
    }
    return h + "</div>";
  }

  /* Real waterfall result, published by db/batch_waterfall.py to data/wf/<CIN>.json */
  function waterfallResultCard(wf) {
    var tone = wf.cost === 0 ? "free" : (wf.verdict === "NO FREE ROUTE" ? "paid" : "cond");
    var color = wf.cost === 0 ? "var(--free)" : "var(--paid)";
    var h = '<div class="card"><h2>Financials Source Waterfall ' + srcBadge(tone, "RUN " + esc(wf.generated)) + "</h2>" +
      '<p style="font-size:15px;font-weight:700;color:' + color + ';margin-bottom:4px;">' + esc(wf.verdict) +
      (wf.cost === 0 ? " — data cost ₹0" : " — data cost ₹" + wf.cost) + "</p>" +
      '<p style="font-size:13px;margin-bottom:10px;">' + esc(wf.summary) + "</p>";

    var R = wf.routes || {}, rows = [];
    rows.push(["Listed equity (exchange filings free)", R.listed_equity ? "YES" : "No", R.listed_equity, null]);
    rows.push(["Credit-rating rationale (carries key financials)",
      (R.cra && R.cra.searched) ? ((R.cra.hits || []).length + " document(s) found") : "not searched",
      !!(R.cra && (R.cra.hits || []).length), R.cra]);
    rows.push(["SEBI offer document (3 yrs restated financials)",
      (R.drhp && R.drhp.searched) ? ((R.drhp.hits || []).length + " document(s) found") : "not searched",
      !!(R.drhp && (R.drhp.hits || []).length), R.drhp]);
    rows.push(["Exchange filings (listed debt, Reg 52 results)",
      (R.exchange && R.exchange.searched) ? ((R.exchange.hits || []).length + " document(s) found") : "not searched",
      !!(R.exchange && (R.exchange.hits || []).length), R.exchange]);
    rows.push(["Insolvency proceedings (IBBI)",
      R.ibbi ? (R.ibbi.checked ? (R.ibbi.insolvency ? "PROCEEDINGS FOUND" : "none on record") : "check failed") : "—",
      R.ibbi && R.ibbi.checked && !R.ibbi.insolvency, null]);

    h += '<div class="scrollx"><table><tr><th>Route checked</th><th>Result</th></tr>';
    rows.forEach(function (r) {
      var mark = r[2] ? '<span style="color:var(--free);font-weight:700;">✓ </span>' : '<span style="color:var(--muted);">— </span>';
      h += "<tr><td>" + esc(r[0]) + "</td><td>" + mark + esc(r[1]) + "</td></tr>";
    });
    h += "</table></div>";

    var found = [];
    ["cra", "drhp", "exchange"].forEach(function (k) {
      ((R[k] && R[k].hits) || []).forEach(function (hit) { found.push(hit); });
    });
    if (found.length) {
      h += '<h3 style="font-size:13px;margin:12px 0 6px;color:var(--brand);">Free financial documents located for this company</h3><div class="srcgrid">';
      found.forEach(function (f) {
        h += '<a class="srclink" target="_blank" rel="noopener" href="' + esc(f.u) + '"><div><div class="t">' +
          esc(f.t || "document") + '</div><div class="d">' + esc((f.s || "").slice(0, 110)) + '</div></div><span class="go">Open →</span></a>';
      });
      h += "</div>";
    }
    if (R.ibbi && R.ibbi.url) {
      h += '<p style="font-size:11px;color:var(--muted);margin-top:8px;">IBBI record checked at <a target="_blank" rel="noopener" href="' + esc(R.ibbi.url) + '">ibbi.gov.in</a> for this CIN.</p>';
    }
    return h + "</div>";
  }

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
    var s = String(row.s || ""), sl = s.toLowerCase();
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

  function shellSections(row, wf) {
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
    h += wf ? waterfallResultCard(wf) : waterfallCard(row);
    if (wf && wf.financials) h += extractedFinancialsCard(wf);
    h += '<div class="card"><h2>Balance Sheet &amp; P&amp;L (12 years) ' + srcBadge("paid", "MCA AOC-4 — via waterfall or ₹100") + '</h2><div class="scrollx"><table><tr><th></th><th class="n">FY (latest−2)</th><th class="n">FY (latest−1)</th><th class="n">FY (latest)</th></tr>' +
      "<tr><td>Net Revenue</td>" + "<td class='n'>—</td>".repeat(3) + "</tr>" +
      "<tr><td>EBITDA</td>" + "<td class='n'>—</td>".repeat(3) + "</tr>" +
      "<tr><td>Profit for the Period</td>" + "<td class='n'>—</td>".repeat(3) + "</tr>" +
      "<tr><td>Total Equity</td>" + "<td class='n'>—</td>".repeat(3) + "</tr>" +
      "<tr><td>Total Assets</td>" + "<td class='n'>—</td>".repeat(3) + "</tr>" +
      pendRow(4, "AOC-4 filings (waterfall above decides free vs ₹100)", null) + "</table></div></div>";
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
      pendRow(4, "SEBI-mandated CRA rationales + CIBIL suit-filed lists", gq('"' + name + '" "rating rationale" site:crisilratings.com OR site:icra.in OR site:careratings.com'), "search rationales") + "</table></div></div>";
    h += '<div class="note"><b>Why some sections are pending:</b> GST, EPFO and court portals are captcha-gated and block cross-site requests, so a browser-only app cannot fetch them — the production pipeline (server-side) automates exactly these pulls. Everything marked LIVE above came from open APIs in real time. Use the links to pull any pending section manually today.</div>';
    return h;
  }

  /* ---------- report page ---------- */
  function showReport(cin) {
    $home.style.display = "none";
    $report.style.display = "block";
    window.scrollTo(0, 0);

    var row = byCIN[cin] || null;
    var isDemo = cin === DEMO_CIN;
    var wf = wfCache[cin] || null;
    document.title = (row ? row.n + " — " : "") + "cobio24 report";

    function render(r, liveState) {
      // The published waterfall record carries a full registry snapshot from the local MCA
      // database. Use it to fill anything the index/live API did not supply, so a report is
      // never blank just because the public API is rate-limited.
      if (wf && wf.master) {
        var m = wf.master;
        r = r || { c: cin };
        r.n = r.n || m.name;
        r.s = r.s || m.status; r.cl = r.cl || m["class"]; r.cat = r.cat || m.category;
        r.l = r.l || m.listing; r.d = r.d || m.reg_date; r.ac = r.ac || m.auth_capital;
        r.pc = r.pc || m.paidup_capital; r.r = r.r || m.roc; r.st = r.st || m.state;
        r.ic = r.ic || m.industry; r.nic = r.nic || m.nic; r.ad = r.ad || m.address;
        if (!liveState || /unreachable|refreshing/.test(liveState)) {
          liveState = "Registry snapshot from the cobio24 database · " + esc(wf.generated);
        }
      } else if (!r && wf && wf.name) {
        r = { c: cin, n: wf.name };
      }
      var chips = "";
      if (r) {
        if (r.s) chips += (String(r.s).toLowerCase().indexOf("active") === 0 ? '<span class="pill ok">' : '<span class="pill bad">') + esc(r.s) + "</span>";
        if (r.l) chips += '<span class="pill info">' + esc(r.l) + "</span>";
        if (r.cl) chips += '<span class="pill info">' + esc(r.cl) + "</span>";
        if (isDemo) chips += '<span class="pill warn">FULL DEMO REPORT</span>';
      }
      var h = '<div class="backbar"><button class="backbtn" onclick="history.length>1?history.back():location.hash=\'\'">← Search</button>' +
        '<button class="backbtn" onclick="window.print()" title="Print or save as PDF">🖨 Print / PDF</button></div>' +
        '<div class="cohead"><h1>' + esc(r ? r.n : cin) + '</h1><div class="chips">' + chips + "</div></div>";
      if (r) h += masterCard(r, liveState);
      else h += '<div class="err">This CIN was not found in the index and the live registry lookup failed. Check the CIN, or retry when online.</div>';

      if (isDemo) {
        h += demoData ? demoSections(demoData) : '<div class="card"><div class="skel" style="width:60%"></div><br><div class="skel"></div><br><div class="skel" style="width:80%"></div></div>';
      } else if (r) {
        h += '<div class="card" id="fullreport-cta" style="text-align:center;">' +
          '<h2 style="justify-content:center;">Full Due-Diligence Report</h2>' +
          '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Complete 14-section format — financials, shareholding, directors, charges, GST &amp; EPFO discipline, litigation, ratings, Compliance Pulse™ and AI analyst summary.</p>' +
          '<button class="backbtn" style="background:var(--brand);color:#fff;border:none;font-size:14px;padding:12px 22px;" onclick="window.c24ToggleFull()">📄 Generate Full Report (free preview)</button>' +
          '<p style="font-size:11px;color:var(--muted);margin-top:8px;">Live sections populate instantly; gated sections render in-structure with their free-source lookups pre-filled.</p></div>' +
          '<div id="fullreport" style="display:none;">' + derivedComplianceCard(r) + shellSections(r, wf) + "</div>";
      }
      $report.innerHTML = h;
    }

    window.c24ToggleFull = function () {
      var el = document.getElementById("fullreport"), cta = document.getElementById("fullreport-cta");
      if (el) { el.style.display = "block"; if (cta) cta.style.display = "none"; window.scrollTo({ top: el.offsetTop - 70, behavior: "smooth" }); }
    };

    render(row, row ? "Index data · refreshing live from data.gov.in…" : "Looking up live from data.gov.in…");

    // published waterfall result (real free-source findings for this company)
    if (!wf) {
      fetch("data/wf/" + cin + ".json?v=" + WFV).then(function (r) {
        if (!r.ok) throw new Error("none");
        return r.json();
      }).then(function (j) {
        wfCache[cin] = j; wf = j;
        if (location.hash.indexOf(cin) === -1) return;
        var wasOpen = document.getElementById("fullreport") && document.getElementById("fullreport").style.display !== "none";
        render(byCIN[cin] || row, lastLiveState);
        if (wasOpen) window.c24ToggleFull();
      }).catch(function () { /* not yet published for this company */ });
    }

    if (isDemo && !demoData) {
      fetch("data/bigv-demo.json?v=" + BUILD).then(function (x) { return x.json(); }).then(function (d) {
        demoData = d; if (location.hash.indexOf(cin) > -1) render(byCIN[cin] || null, lastLiveState);
      });
    }

    var lastLiveState = row ? "Index data (live refresh unavailable)" : "";
    liveFetch(cin).then(function (liveRow) {
      if (location.hash.indexOf(cin) === -1) return;
      var wasOpen = document.getElementById("fullreport") && document.getElementById("fullreport").style.display !== "none";
      if (liveRow) {
        byCIN[cin] = liveRow;
        lastLiveState = '<span class="ok">✓ Live from data.gov.in</span> · fetched ' + new Date().toLocaleTimeString() + " · dataset snapshot up to 3 Nov 2023 · GODL-India";
        render(liveRow, lastLiveState);
      } else if (row) {
        lastLiveState = "Index data · CIN not returned by the live API";
        render(row, lastLiveState);
      } else { render(null, ""); }
      if (wasOpen) window.c24ToggleFull();
    }).catch(function () {
      if (location.hash.indexOf(cin) === -1) return;
      if (row) { lastLiveState = "Index data · live API unreachable (rate limit or offline)"; render(row, lastLiveState); }
      else render(null, "");
    });
  }

  route();
})();
