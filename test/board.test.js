/* =========================================================
   A board with a full season on it: referees, the ledger, the standings
   columns and the report form.
   ========================================================= */
"use strict";

const { boot, settle, suite, boardRows } = require("./harness");

const t = suite("Board with a populated ledger");
const now = Date.now();

/* The fixture carries two traps on purpose, because both have been real bugs:

   1. It is NOT in time order. `fines` arrives sorted, but a realtime insert is
      pushed onto the end, so anything that means "most recent" has to compare
      timestamps rather than take the first row it matches.

   2. Tor's most *frequent* rule is RULES[0] (b, g, h) while his most *recent*
      is RULES[last] (a). The standings column used to show the frequent one,
      so a fixture where the two agree would pass either way. */
const fixture = (R) => [
  { id: "g", who: "tor",    by: null,     what: R[0],            note: "", at: now - 7000 },
  { id: "h", who: "tor",    by: "ghost",  what: R[0],            note: "", at: now - 8000 },
  { id: "a", who: "tor",    by: "mie",    what: R[R.length - 1], note: "", at: now - 1000 },
  { id: "b", who: "tor",    by: "mie",    what: R[0],            note: "", at: now - 2000 },
  { id: "c", who: "isabel", by: "mie",    what: R[0],            note: "", at: now - 3000 },
  { id: "d", who: "tor",    by: "eivind", what: R[R.length - 1], note: "", at: now - 4000 },
  { id: "e", who: "mie",    by: "eivind", what: R[0],            note: "", at: now - 5000 },
  { id: "f", who: "isabel", by: "isabel", what: R[R.length - 1], note: "", at: now - 6000 },
];

// mie books 3, eivind 2, isabel 1 (a self-report), plus one with no referee
// and one booked by somebody no longer in the squad.

(async () => {
  const { els, el, calls, localStore, RULES, ruleName } = boot(fixture);
  const FIRST = ruleName(RULES[0]);
  const LAST = ruleName(RULES[RULES.length - 1]);
  await settle();

  t.section("referees leaderboard");
  const list = els["#refs-list"].innerHTML;
  const order = (list.match(/class="ref__name">([^<]+)</g) || [])
    .map((s) => s.replace(/.*>/, "").replace("<", ""));
  t.check("top three, most bookings first",
    JSON.stringify(order) === '["Mie","Eivind","Isabel"]', "got " + JSON.stringify(order));
  t.check("shows only three", order.length === 3, "got " + order.length);
  t.check("counts are pluralised",
    /<b>3 fines<\/b>/.test(list) && /<b>1 fine<\/b>/.test(list), list.slice(0, 400));
  t.check("kroner issued shown", /issued/.test(list));

  t.section("fines nobody can be credited for");
  const foot = els["#refs-foot"];
  t.check("footnote visible", foot.hidden === false);
  t.check("counts the null referee AND the departed one",
    /^2 fines cannot be credited/.test(foot.textContent), "got: " + foot.textContent);

  t.section("ledger");
  const feed = els["#feed"].innerHTML;
  t.check("names the referee", /Booked by Mie/.test(feed));
  t.check("a self-report reads as owning up", /Owned up voluntarily/.test(feed));

  t.section("standings: most recent offence");
  const rows = boardRows(els["#board-body"].innerHTML);
  const rule = (n) => rows[n][2];
  t.check("newest rule, not the most frequent one",
    rule("Tor").includes(LAST), "Tor → " + rule("Tor"));
  t.check("newest rule, not the first row in the array",
    !rule("Tor").includes(FIRST), "Tor → " + rule("Tor"));
  t.check("newest rule for a player with two different ones",
    rule("Isabel").includes(FIRST), "Isabel → " + rule("Isabel"));
  t.check("no leftover xN frequency suffix",
    !/×/.test(els["#board-body"].innerHTML));
  t.check("a clean sheet reads as nothing on record",
    Object.keys(rows).some((n) => /Nothing on record/.test(rows[n][2])));

  t.section("standings: booked by");
  const by = (n) => rows[n][3];
  t.check("the referee on the most recent fine, not the first row",
    by("Tor") === "Mie", "Tor → " + by("Tor"));
  t.check("a self-report still credits the referee",
    by("Isabel") === "Mie", "Isabel → " + by("Isabel"));
  t.check("tracked per offender",
    by("Mie") === "Eivind", "Mie → " + by("Mie"));
  t.check("em dash when nobody has booked them",
    Object.keys(rows).some((n) => by(n) === "—"), JSON.stringify(rows));

  t.section("report form");
  t.check("referee select starts blank", /value="" disabled selected/.test(els["#f-by"].innerHTML));
  t.check("referee select lists the squad", /value="mie"/.test(els["#f-by"].innerHTML));
  t.check("offender select has no blank option", !/disabled selected/.test(els["#f-who"].innerHTML));

  const submit = els["#report-form"]._handlers.submit[0];
  el("#f-note").value = "test";         // only queried on submit, so conjure it first
  els["#f-who"].value = "tor";
  els["#f-what"].value = RULES[0];
  els["#f-by"].value = "";
  submit({ preventDefault() {} });
  await settle(20);

  t.check("blocks a submit with no referee",
    calls.inserted === null, "inserted anyway: " + JSON.stringify(calls.inserted));
  t.check("focuses the referee field", els["#f-by"]._focused === true);
  t.check("says why", /Say who is booking/.test(els["#toast"].textContent), els["#toast"].textContent);

  els["#f-by"].value = "mie";
  submit({ preventDefault() {} });
  await settle(20);

  t.check("submits once a referee is chosen",
    calls.inserted && calls.inserted.by === "mie", JSON.stringify(calls.inserted));
  t.check("keeps offender and referee apart",
    calls.inserted && calls.inserted.who === "tor", JSON.stringify(calls.inserted));

  els["#f-by"]._handlers.change[0]();
  t.check("remembers the referee in localStorage",
    localStore["offside.bookedBy"] === "mie", JSON.stringify(localStore));

  t.done();
})();
