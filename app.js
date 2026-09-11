/* =========================================================
   Offside — application logic
   No build step, no dependencies. The board lives in Supabase (see store.js),
   so everyone is looking at the same table. New fines arrive over a realtime
   subscription; if that drops, the board refetches whenever the tab regains
   focus, so nobody ends up staring at a stale leaderboard.
   ========================================================= */
(function () {
  "use strict";

  var DAY = 86400000;
  var UNDO_WINDOW = 10 * 60000;   // must match the delete policy in schema.sql

  var byId = function (list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };
  var $ = function (sel) { return document.querySelector(sel); };

  /* ---------------- state ---------------- */

  var EMPLOYEES = [];   // the squad, from Supabase
  var fines = [];       // the ledger, from Supabase

  /* Drop entries pointing at a colleague or a rule that no longer exists. */
  function usable(list) {
    return list.filter(function (f) {
      return f && byId(EMPLOYEES, f.who) && byId(INFRACTIONS, f.what);
    });
  }

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

  /* Supabase errors are objects; pull something a human can read out of them. */
  function reason(err) {
    if (!err) return "unknown error";
    return err.message || err.error_description || String(err);
  }

  /* ---------------- derived data ---------------- */

  function tally() {
    var rows = EMPLOYEES.map(function (emp) {
      var own = fines.filter(function (f) { return f.who === emp.id; });
      var total = own.reduce(function (sum, f) { return sum + byId(INFRACTIONS, f.what).fine; }, 0);

      // Their latest offence, and who booked it. `fines` is not reliably
      // sorted once a live update pushes a new one in, so compare on `at`
      // rather than taking the first matching row.
      var latest = null;
      own.forEach(function (f) { if (!latest || f.at > latest.at) latest = f; });

      // lastRef is null when their most recent fine predates the honour
      // system, or when the referee has since left the squad.
      var lastRule = latest ? byId(INFRACTIONS, latest.what) : null;
      var lastRef = latest && latest.by ? byId(EMPLOYEES, latest.by) : null;

      return {
        emp: emp,
        count: own.length,
        total: total,
        lastRule: lastRule,
        lastAt: latest ? latest.at : 0,
        lastRef: lastRef,
      };
    });

    rows.sort(function (a, b) { return b.total - a.total || b.count - a.count || a.emp.name.localeCompare(b.emp.name); });
    return rows;
  }

  /**
   * Who has handed out the most fines.
   *
   * Only counts bookings we can attribute to somebody still on the squad:
   * fines logged before the honour system have no name against them, and a
   * retired colleague is no longer on the board to rank. Both are surfaced
   * as a footnote rather than silently vanishing.
   */
  function refTally() {
    var byRef = {};

    fines.forEach(function (f) {
      if (!f.by) return;
      var emp = byId(EMPLOYEES, f.by);
      if (!emp) return;
      if (!byRef[f.by]) byRef[f.by] = { emp: emp, count: 0, total: 0 };
      byRef[f.by].count += 1;
      byRef[f.by].total += byId(INFRACTIONS, f.what).fine;
    });

    var rows = Object.keys(byRef).map(function (k) { return byRef[k]; });
    rows.sort(function (a, b) {
      return b.count - a.count || b.total - a.total || a.emp.name.localeCompare(b.emp.name, "nb");
    });
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
    var heads = EMPLOYEES.length || 1;

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
        v: kr(Math.round(pot / heads)),
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
    var order = [top[1], top[0], top[2]]; // rendered silver, gold, bronze so gold sits centre
    var medals = { 1: "Worst offender", 2: "Runner-up", 3: "Third place" };

    $("#podium").innerHTML = order.map(function (r, i) {
      if (!r) return "";
      var place = i === 1 ? 1 : i === 0 ? 2 : 3;
      return '<article class="pod pod--' + place + '">' +
        '<span class="pod__medal">' + medals[place] + "</span>" +
        avatar(r.emp) +
        '<div class="pod__name">' + esc(r.emp.name) + "</div>" +
        '<div class="pod__meta">' + esc(titleFor(r.total)) + "</div>" +
        '<div class="pod__amount">' + kr(r.total) + "</div>" +
        '<div class="pod__fines">' + r.count + (r.count === 1 ? " offence" : " offences") + "</div>" +
        "</article>";
    }).join("");
  }

  function renderRefs() {
    var rows = refTally();
    var top = rows.slice(0, 3);
    var places = ["1st", "2nd", "3rd"];

    $("#refs-list").innerHTML = top.length
      ? top.map(function (r, i) {
          return '<li class="ref">' +
            '<span class="ref__place">' + places[i] + "</span>" +
            avatar(r.emp) +
            '<span class="ref__name">' + esc(r.emp.name) + "</span>" +
            '<span class="ref__tally">' +
              "<b>" + r.count + (r.count === 1 ? " fine" : " fines") + "</b>" +
              "<i>" + kr(r.total) + " issued</i>" +
            "</span></li>";
        }).join("")
      : '<li class="refs__empty">Nobody has signed for a booking yet. ' +
        "Whoever files the next fine takes top spot.</li>";

    // Anything we could not attribute, said out loud rather than quietly
    // dropped. Covers both cases: logged before the honour system existed, or
    // booked by someone since retired from the squad.
    var orphans = fines.filter(function (f) {
      return !f.by || !byId(EMPLOYEES, f.by);
    }).length;

    var foot = $("#refs-foot");
    foot.hidden = !orphans;
    if (orphans) {
      foot.textContent = orphans === 1
        ? "One fine cannot be credited to anyone on the current squad, so it is not counted here."
        : orphans + " fines cannot be credited to anyone on the current squad, so they are not counted here.";
    }
  }

  function renderBoard(rows) {
    var pot = rows.reduce(function (s, r) { return s + r.total; }, 0) || 1;
    var max = rows.reduce(function (m, r) { return Math.max(m, r.total); }, 0) || 1;
    var ranked = rows.slice(); // rows are already sorted by total for rank numbering
    var view = sorted(rows);

    $("#board-body").innerHTML = view.map(function (r) {
      var rank = ranked.indexOf(r) + 1;
      var share = Math.round((r.total / pot) * 100);
      // The tag names the offence; the tooltip says when, since "most recent"
      // means nothing on its own for someone last booked in March.
      var last = r.lastRule
        ? '<span class="tag" title="' + esc(timeAgo(r.lastAt)) + '">' +
          esc(r.lastRule.icon + " " + r.lastRule.name) + "</span>"
        : '<span class="tag tag--clean">Nothing on record</span>';

      return "<tr>" +
        '<td class="rank' + (rank <= 3 ? " rank--top" : "") + '">' + rank + "</td>" +
        '<td><div class="player">' + avatar(r.emp) +
          '<div><div class="player__name">' + esc(r.emp.name) + "</div>" +
          '<div class="player__title">' + esc(titleFor(r.total)) + "</div></div></div></td>" +
        '<td class="col-hide">' + last + "</td>" +
        '<td class="col-hide">' +
          (r.lastRef ? esc(r.lastRef.name) : '<span class="cell-none">—</span>') + "</td>" +
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
      // Fined the wrong colleague? There is a short window to take it back.
      var undo = (Date.now() - f.at) < UNDO_WINDOW
        ? '<button class="feed__undo" data-undo="' + esc(f.id) +
          '" title="Rescind this fine">Undo</button>'
        : "";

      // Older entries predate the honour system and simply have no referee.
      var ref = f.by ? byId(EMPLOYEES, f.by) : null;
      var byLine = "";
      if (ref && ref.id === f.who) byLine = '<p class="feed__by">Owned up voluntarily</p>';
      else if (ref) byLine = '<p class="feed__by">Booked by ' + esc(ref.name) + "</p>";

      return '<div class="feed__item">' + avatar(emp) +
        '<div class="feed__body">' +
          "<p><b>" + esc(emp.name) + "</b> — " + esc(inf.icon + " " + inf.name) + "</p>" +
          (f.note ? '<p class="feed__note">"' + esc(f.note) + '"</p>' : "") +
          byLine +
        "</div>" +
        '<span class="feed__amount">' + kr(inf.fine) + "</span>" +
        '<span class="feed__time">' + timeAgo(f.at) + undo + "</span>" +
        "</div>";
    }).join("");
  }

  function render() {
    var rows = tally();
    renderKitty(rows);
    renderStats(rows);
    renderPodium(rows);
    renderRefs();
    renderBoard(rows);
    renderRulebook();
    renderFeed();
  }

  /* ---------------- form ---------------- */

  /**
   * Who is sitting at this browser. Remembered locally so nobody has to
   * re-pick their own name every time — it is a convenience, not a claim of
   * identity, and it never leaves this device.
   */
  var ME_KEY = "offside.bookedBy";

  function rememberedMe() {
    try { return window.localStorage.getItem(ME_KEY); } catch (e) { return null; }
  }
  function rememberMe(id) {
    try { window.localStorage.setItem(ME_KEY, id); } catch (e) { /* private mode; no matter */ }
  }

  function fillSelects() {
    var squad = EMPLOYEES.slice()
      .sort(function (a, b) { return a.name.localeCompare(b.name, "nb"); })
      .map(function (e) { return '<option value="' + e.id + '">' + esc(e.name) + "</option>"; })
      .join("");

    $("#f-who").innerHTML = squad;

    // Deliberately starts blank: booking a fine should be a conscious choice,
    // not whoever happens to sort first alphabetically.
    $("#f-by").innerHTML =
      '<option value="" disabled selected>Choose your name…</option>' + squad;

    var me = rememberedMe();
    if (me && byId(EMPLOYEES, me)) $("#f-by").value = me;

    $("#f-what").innerHTML = INFRACTIONS.slice()
      .sort(function (a, b) { return a.fine - b.fine; })
      .map(function (i) {
        return '<option value="' + i.id + '">' + esc(i.icon + "  " + i.name) + " — " + kr(i.fine) + "</option>";
      }).join("");
  }

  function updatePreview() {
    var inf = byId(INFRACTIONS, $("#f-what").value);
    var emp = byId(EMPLOYEES, $("#f-who").value);
    var ref = byId(EMPLOYEES, $("#f-by").value);
    if (!inf || !emp) return;

    if (!ref) {
      $("#fine-preview").textContent = "Say who is booking this first.";
    } else if (ref.id === emp.id) {
      $("#fine-preview").textContent =
        "Owning up — " + emp.name + " will be charged " + kr(inf.fine) + ".";
    } else {
      $("#fine-preview").textContent =
        ref.name + " books " + emp.name + " for " + kr(inf.fine) + ".";
    }
  }

  var toastTimer;
  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-visible"); }, 3600);
  }

  /* ---------------- connection state ---------------- */

  function setStatus(kind, text) {
    var el = $("#board-status");
    if (!el) return;
    el.className = "boardstatus boardstatus--" + kind;
    el.textContent = text;
  }

  function showNotice(html) {
    var el = $("#notice");
    if (!el) return;
    el.innerHTML = html;
    el.hidden = false;
  }

  /* ---------------- loading ---------------- */

  var refreshTimer;

  async function refresh() {
    try {
      fines = usable(await OffsideStore.fines());
      render();
      setStatus("live", "Live — new fines appear here as they are logged.");
    } catch (err) {
      setStatus("down", "Cannot reach the board — " + reason(err));
    }
  }

  /* Realtime can fire several events at once; coalesce them into one refetch. */
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 250);
  }

  /* ---------------- wiring ---------------- */

  function wireForm() {
    $("#f-by").addEventListener("change", function () {
      if ($("#f-by").value) rememberMe($("#f-by").value);
      updatePreview();
    });
    $("#f-who").addEventListener("change", updatePreview);
    $("#f-what").addEventListener("change", updatePreview);

    $("#report-form").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var who = $("#f-who").value;
      var what = $("#f-what").value;
      var emp = byId(EMPLOYEES, who);
      var inf = byId(INFRACTIONS, what);
      if (!emp || !inf) return;

      // No login to fall back on, so the one thing we do insist on is a name.
      var ref = byId(EMPLOYEES, $("#f-by").value);
      if (!ref) {
        toast("Say who is booking this first.");
        $("#f-by").focus();
        return;
      }

      var btn = $("#report-form button[type=submit]");
      btn.disabled = true;
      btn.textContent = "Filing…";

      try {
        var row = await OffsideStore.addFine({
          by: ref.id,
          who: who,
          what: what,
          note: $("#f-note").value.trim(),
        });
        // The realtime event will also land; only add it once.
        if (!fines.some(function (f) { return f.id === row.id; })) fines.push(row);
        render();
        $("#f-note").value = "";
        toast(ref.id === emp.id
          ? emp.name + " owned up — " + kr(inf.fine) + " for " + inf.name.toLowerCase() + "."
          : ref.name + " booked " + emp.name + " — " + kr(inf.fine) + " for " + inf.name.toLowerCase() + ".");
      } catch (err) {
        toast("That fine did not save — " + reason(err));
      } finally {
        btn.disabled = false;
        btn.textContent = "Issue the fine";
      }
    });
  }

  function wireFeed() {
    $("#feed").addEventListener("click", async function (ev) {
      var btn = ev.target.closest("[data-undo]");
      if (!btn) return;
      var id = btn.getAttribute("data-undo");
      btn.disabled = true;

      try {
        await OffsideStore.removeFine(id);
        fines = fines.filter(function (f) { return f.id !== id; });
        render();
        toast("Fine rescinded.");
      } catch (err) {
        btn.disabled = false;
        toast("Could not rescind that — " + reason(err));
      }
    });
  }

  function wireSort() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-sort]"), function (btn) {
      btn.addEventListener("click", function () {
        sortMode = btn.getAttribute("data-sort");
        Array.prototype.forEach.call(document.querySelectorAll("[data-sort]"), function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        renderBoard(tally());
      });
    });
  }

  /* ---------------- boot ---------------- */

  (async function boot() {
    wireSort();

    if (!OffsideStore.configured()) {
      setStatus("down", "Not connected to a board.");
      showNotice(
        "<b>This board is not connected yet.</b> Fill in your Supabase project " +
        "URL and anon key in <code>config.js</code>, then run " +
        "<code>supabase/schema.sql</code>. Setup steps are in the README."
      );
      return;
    }

    setStatus("wait", "Loading the board…");

    try {
      EMPLOYEES = await OffsideStore.players();
    } catch (err) {
      setStatus("down", "Cannot reach the board — " + reason(err));
      showNotice("<b>Could not load the squad.</b> " + esc(reason(err)));
      return;
    }

    if (!EMPLOYEES.length) {
      setStatus("down", "No players on the board.");
      showNotice(
        "<b>The squad is empty.</b> Run <code>supabase/seed.local.sql</code> in the " +
        "Supabase SQL editor, or add people under Table Editor → <code>players</code>."
      );
      return;
    }

    fillSelects();
    updatePreview();
    wireForm();
    wireFeed();

    await refresh();

    // Someone else logs a fine → it lands here without a reload.
    OffsideStore.subscribe(scheduleRefresh);

    // Belt and braces: if the socket dropped while the tab was hidden,
    // catch up the moment it comes back.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) scheduleRefresh();
    });

    // Keep the "3m ago" stamps honest on a board left open all afternoon.
    setInterval(renderFeed, 60000);
  })();
})();
