/* =========================================================
   The board as it actually looked the day the honour system shipped: a
   couple of fines already logged, none of them with a referee against them.

   Worth its own file because it is the state every existing board upgrades
   through, and because "no referees at all" is the case most likely to divide
   by zero or render an empty top three as a blank box.
   ========================================================= */
"use strict";

const { boot, settle, suite, boardRows } = require("./harness");

const t = suite("Board predating the honour system");
const now = Date.now();

const fixture = (R) => [
  { id: "g", who: "tor", by: null,    what: R[0], note: "", at: now - 7000 },
  { id: "h", who: "tor", by: "ghost", what: R[0], note: "", at: now - 8000 },
];

(async () => {
  const { els } = boot(fixture);
  await settle();

  t.section("referees leaderboard");
  const list = els["#refs-list"].innerHTML;
  const order = (list.match(/class="ref__name">([^<]+)</g) || []);
  t.check("nobody ranked", order.length === 0, JSON.stringify(order));
  t.check("shows an empty state rather than a blank box", /refs__empty/.test(list), list);
  t.check("invites the first booking", /takes top spot/.test(list));

  t.section("fines nobody can be credited for");
  const foot = els["#refs-foot"];
  t.check("footnote visible", foot.hidden === false);
  t.check("counts both — the null one and the departed referee",
    /^2 fines cannot be credited/.test(foot.textContent), "got: " + foot.textContent);

  t.section("the rest of the board still renders");
  const rows = boardRows(els["#board-body"].innerHTML);
  const names = Object.keys(rows);
  t.check("standings not empty", names.length > 0);
  t.check("every booked-by cell is an em dash",
    names.every((n) => rows[n][3] === "—"),
    JSON.stringify(names.map((n) => n + ":" + rows[n][3])));
  t.check("the one offender still shows their most recent offence",
    !/Nothing on record/.test(rows["Tor"][2]), "Tor → " + rows["Tor"][2]);
  t.check("ledger rendered", els["#feed"].innerHTML.length > 0);
  t.check("no referee line in the ledger", !/Booked by/.test(els["#feed"].innerHTML));

  t.done();
})();
