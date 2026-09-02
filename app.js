/* =========================================================
   Offside — application logic
   No build step, no dependencies. State lives in localStorage.
   ========================================================= */
(function () {
  "use strict";

  var STORE_KEY = "offside.fines.v1";
  var DAY = 86400000;

  var byId = function (list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };
  var $ = function (sel) { return document.querySelector(sel); };

  /* ---------------- state ---------------- */

  function seed() {
    var now = Date.now();
    return SEED_FINES.map(function (f, i) {
      return {
        id: "seed-" + i,
        who: f.who,
        what: f.what,
        note: f.note || "",
        // spread seeded entries through the working day for a plausible ledger
        at: now - f.daysAgo * DAY + (i % 7) * 40 * 60000,
      };
    });
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return seed();
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return seed();
      // drop entries pointing at people or rules that no longer exist
      return parsed.filter(function (f) {
        return f && byId(EMPLOYEES, f.who) && byId(INFRACTIONS, f.what);
      });
    } catch (e) {
      return seed();
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(fines)); } catch (e) { /* private mode */ }
  }

  var fines = load();

  /* ---------------- helpers ---------------- */

  var kr = function (n) { return "kr " + n.toLocaleString("nb-NO"); };

  function titleFor(total) {
    for (var i = 0; i < TITLES.length; i++) if (total >= TITLES[i].min) return TITLES[i].label;
    return TITLES[TITLES.length - 1].label;
  }

  function initials(name) { return name.charAt(0).toUpperCase(); }

  function timeAgo(ts) {
    var mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    var days = Math.round(hrs / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return days + "d ago";
    return Math.round(days / 7) + "w ago";
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function avatar(emp, cls) {
    return '<span class="avatar ' + (cls || "") + '" style="background:' + emp.colour +
      '" aria-hidden="true">' + initials(emp.name) + "</span>";
  }

  /* ---------------- derived data ---------------- */

  function tally() {
    var rows = EMPLOYEES.map(function (emp) {
      var own = fines.filter(function (f) { return f.who === emp.id; });
      var total = own.reduce(function (sum, f) { return sum + byId(INFRACTIONS, f.what).fine; }, 0);

      // most frequent infraction, ties broken by the more expensive one
      var counts = {};
      own.forEach(function (f) { counts[f.what] = (counts[f.what] || 0) + 1; });
      var signature = null;
      Object.keys(counts).forEach(function (k) {
        if (!signature ||
            counts[k] > counts[signature] ||
            (counts[k] === counts[signature] && byId(INFRACTIONS, k).fine > byId(INFRACTIONS, signature).fine)) {
          signature = k;
        }
      });

      return {
        emp: emp,
        count: own.length,
        total: total,
        signature: signature ? byId(INFRACTIONS, signature) : null,
        signatureCount: signature ? counts[signature] : 0,
      };
    });

    rows.sort(function (a, b) { return b.total - a.total || b.count - a.count || a.emp.name.localeCompare(b.emp.name); });
    return rows;
  }

  var sortMode = "total";

  function sorted(rows) {
    var copy = rows.slice();
    if (sortMode === "count") {
      copy.sort(function (a, b) { return b.count - a.count || b.total - a.total || a.emp.name.localeCompare(b.emp.name); });
    } else if (sortMode === "name") {
      copy.sort(function (a, b) { return a.emp.name.localeCompare(b.emp.name, "nb"); });
    }
    return copy;
  }

  /* ---------------- rendering ---------------- */

  function renderKitty(rows) {
    var pot = rows.reduce(function (s, r) { return s + r.total; }, 0);
    $("#kitty-amount").textContent = kr(pot);
    $("#kitty-count").textContent = fines.length;
    $("#kitty-worst").textContent = rows.length && rows[0].total > 0 ? rows[0].emp.name : "—";
    $("#kitty-note").textContent = pot >= 800
      ? "That is a proper cake budget. Keep talking."
      : "Collected so far this season.";
  }

  function renderStats(rows) {
    // busiest rule
    var perRule = {};
    fines.forEach(function (f) { perRule[f.what] = (perRule[f.what] || 0) + 1; });
    var topRule = null;
    Object.keys(perRule).forEach(function (k) {
      if (!topRule || perRule[k] > perRule[topRule]) topRule = k;
    });

    var clean = rows.filter(function (r) { return r.count === 0; }).length;
    var pot = rows.reduce(function (s, r) { return s + r.total; }, 0);

    var week = Date.now() - 7 * DAY;
    var thisWeek = fines.filter(function (f) { return f.at >= week; });
    var weekPot = thisWeek.reduce(function (s, f) { return s + byId(INFRACTIONS, f.what).fine; }, 0);

    var items = [
      {
        k: "Most broken rule",
        v: topRule ? byId(INFRACTIONS, topRule).name : "—",
        d: topRule ? perRule[topRule] + " separate incidents" : "Nothing logged yet",
      },
      {
        k: "Average per head",
        v: kr(Math.round(pot / EMPLOYEES.length)),
        d: "Across all " + EMPLOYEES.length + " of us",
      },
      {
        k: "Clean sheets",
        v: clean + " / " + EMPLOYEES.length,
        d: clean ? "Not yet caught. Give it time." : "Nobody is innocent",
      },
      {
        k: "Last 7 days",
        v: kr(weekPot),
        d: thisWeek.length + " offences this week",
      },
    ];

    $("#stats").innerHTML = items.map(function (s) {
      return '<div class="stat"><div class="stat__k">' + esc(s.k) + "</div>" +
        '<div class="stat__v">' + esc(s.v) + "</div>" +
        '<div class="stat__d">' + esc(s.d) + "</div></div>";
    }).join("");
  }

  function renderPodium(rows) {
    var top = rows.slice(0, 3);
    var order = [top[1], top[0], top[2]]; // silver, gold, bronze
    var medals = ["Runner-up", "Worst offender", "Third place"];

    $("#podium").innerHTML = order.map(function (r, i) {
      if (!r) return "";
      var place = i === 1 ? 1 : i === 0 ? 2 : 3;
      return '<article class="pod pod--' + place + '">' +
        '<span class="pod__medal">' + medals[place - 1] + "</span>" +
        avatar(r.emp) +
        '<div class="pod__name">' + esc(r.emp.name) + "</div>" +
        '<div class="pod__meta">' + esc(titleFor(r.total)) + "</div>" +
        '<div class="pod__amount">' + kr(r.total) + "</div>" +
        '<div class="pod__fines">' + r.count + (r.count === 1 ? " offence" : " offences") + "</div>" +
        "</article>";
    }).join("");
  }

  function renderBoard(rows) {
    var pot = rows.reduce(function (s, r) { return s + r.total; }, 0) || 1;
    var max = rows.reduce(function (m, r) { return Math.max(m, r.total); }, 0) || 1;
    var ranked = rows.slice(); // rows are already sorted by total for rank numbering
    var view = sorted(rows);

    $("#board-body").innerHTML = view.map(function (r) {
      var rank = ranked.indexOf(r) + 1;
      var share = Math.round((r.total / pot) * 100);
      var sig = r.signature
        ? '<span class="tag">' + esc(r.signature.icon + " " + r.signature.name) +
          (r.signatureCount > 1 ? " ×" + r.signatureCount : "") + "</span>"
        : '<span class="tag tag--clean">Nothing on record</span>';

      return "<tr>" +
        '<td class="rank' + (rank <= 3 ? " rank--top" : "") + '">' + rank + "</td>" +
        '<td><div class="player">' + avatar(r.emp) +
          '<div><div class="player__name">' + esc(r.emp.name) + "</div>" +
          '<div class="player__title">' + esc(titleFor(r.total)) + "</div></div></div></td>" +
        '<td class="col-hide">' + sig + "</td>" +
        '<td class="col-hide"><div class="bar" title="' + share + '% of the kitty">' +
          '<i style="width:' + Math.round((r.total / max) * 100) + '%"></i></div></td>' +
        '<td class="num">' + r.count + "</td>" +
        '<td class="num total">' + kr(r.total) + "</td>" +
        "</tr>";
    }).join("");
  }

  function renderRulebook() {
    var counts = {};
    fines.forEach(function (f) { counts[f.what] = (counts[f.what] || 0) + 1; });
    var sevLabel = { 1: "Minor", 2: "Serious", 3: "Straight red" };

    $("#rulebook-cards").innerHTML = INFRACTIONS.map(function (inf) {
      var n = counts[inf.id] || 0;
      return '<article class="card">' +
        '<div class="card__top">' +
          '<span class="card__icon" style="background:' + inf.tint + '">' + inf.icon + "</span>" +
          '<span class="card__price">' + kr(inf.fine) + "</span>" +
        "</div>" +
        "<h3>" + esc(inf.name) + "</h3>" +
        "<p>" + esc(inf.desc) + "</p>" +
        '<div class="card__foot">' +
          "<span>" + sevLabel[inf.severity] + "</span>" +
          "<span>" + (n ? n + (n === 1 ? " incident" : " incidents") : "Never called") + "</span>" +
        "</div></article>";
    }).join("");
  }

  function renderFeed() {
    var recent = fines.slice().sort(function (a, b) { return b.at - a.at; }).slice(0, 15);

    if (!recent.length) {
      $("#feed").innerHTML = '<p class="feed__note" style="padding:14px 0">The ledger is empty. Suspiciously quiet.</p>';
      return;
    }

    $("#feed").innerHTML = recent.map(function (f) {
      var emp = byId(EMPLOYEES, f.who);
      var inf = byId(INFRACTIONS, f.what);
      return '<div class="feed__item">' + avatar(emp) +
        '<div class="feed__body">' +
          "<p><b>" + esc(emp.name) + "</b> — " + esc(inf.icon + " " + inf.name) + "</p>" +
          (f.note ? '<p class="feed__note">"' + esc(f.note) + '"</p>' : "") +
        "</div>" +
        '<span class="feed__amount">' + kr(inf.fine) + "</span>" +
        '<span class="feed__time">' + timeAgo(f.at) + "</span>" +
        "</div>";
    }).join("");
  }

  function render() {
    var rows = tally();
    renderKitty(rows);
    renderStats(rows);
    renderPodium(rows);
    renderBoard(rows);
    renderRulebook();
    renderFeed();
  }

  /* ---------------- form ---------------- */

  function fillSelects() {
    $("#f-who").innerHTML = EMPLOYEES.slice()
      .sort(function (a, b) { return a.name.localeCompare(b.name, "nb"); })
      .map(function (e) { return '<option value="' + e.id + '">' + esc(e.name) + "</option>"; })
      .join("");

    $("#f-what").innerHTML = INFRACTIONS.slice()
      .sort(function (a, b) { return a.fine - b.fine; })
      .map(function (i) {
        return '<option value="' + i.id + '">' + esc(i.icon + "  " + i.name) + " — " + kr(i.fine) + "</option>";
      }).join("");
  }

  function updatePreview() {
    var inf = byId(INFRACTIONS, $("#f-what").value);
    var emp = byId(EMPLOYEES, $("#f-who").value);
    if (!inf || !emp) return;
    $("#fine-preview").textContent = emp.name + " will be charged " + kr(inf.fine) + ".";
  }

  var toastTimer;
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, 3600);
  }

  /* ---------------- wiring ---------------- */

  fillSelects();
  updatePreview();
  render();

  $("#f-who").addEventListener("change", updatePreview);
  $("#f-what").addEventListener("change", updatePreview);

  $("#report-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var who = $("#f-who").value;
    var what = $("#f-what").value;
    var emp = byId(EMPLOYEES, who);
    var inf = byId(INFRACTIONS, what);
    if (!emp || !inf) return;

    fines.push({
      id: "f-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      who: who,
      what: what,
      note: $("#f-note").value.trim(),
      at: Date.now(),
    });
    save();
    render();

    $("#f-note").value = "";
    toast(emp.name + " fined " + kr(inf.fine) + " for " + inf.name.toLowerCase() + ".");
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-sort]"), function (btn) {
    btn.addEventListener("click", function () {
      sortMode = btn.getAttribute("data-sort");
      Array.prototype.forEach.call(document.querySelectorAll("[data-sort]"), function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      renderBoard(tally());
    });
  });

  $("#reset").addEventListener("click", function () {
    if (!confirm("Reset the board back to the seeded example data?")) return;
    fines = seed();
    save();
    render();
    toast("Board reset to seed data.");
  });
})();
