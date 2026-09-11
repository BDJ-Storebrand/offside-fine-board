/* =========================================================
   The undo button in the ledger.

   store.test.js covers whether store.js can *tell* that a delete was refused.
   This covers what the board does about it: the old failure was that a
   refused undo still removed the fine from the page and said "Fine
   rescinded.", so the entry reappeared on the next refresh with no
   explanation.
   ========================================================= */
"use strict";

const { boot, settle, suite } = require("./harness");

const now = Date.now();
const fixture = (R) => [
  { id: "fresh", who: "tor", by: "mie", what: R[0], note: "", at: now - 5000 },
  { id: "older", who: "mie", by: "tor", what: R[0], note: "", at: now - 60 * 60000 },
];

/* The real handler starts from `ev.target.closest("[data-undo]")`, so hand it
   an event whose target resolves to a button carrying the fine id. */
function clickUndo(els, id) {
  const btn = {
    disabled: false,
    getAttribute: (a) => (a === "data-undo" ? id : null),
  };
  els["#feed"]._handlers.click[0]({ target: { closest: () => btn } });
  return btn;
}

(async () => {
  const t = suite("Undo in the ledger");

  t.section("a fine still inside the window");
  {
    const { els, calls } = boot(fixture);
    await settle();
    t.check("fresh fine offers an undo button", /data-undo="fresh"/.test(els["#feed"].innerHTML));
    t.check("hour-old fine does not", !/data-undo="older"/.test(els["#feed"].innerHTML));

    clickUndo(els, "fresh");
    await settle(20);
    t.check("asks the store to delete it", calls.removed[0] === "fresh", JSON.stringify(calls.removed));
    t.check("drops it from the ledger", !/data-undo="fresh"/.test(els["#feed"].innerHTML));
    t.check("confirms to the user", /rescinded/i.test(els["#toast"].textContent), els["#toast"].textContent);
  }

  t.section("a delete the database refuses");
  {
    const { els } = boot(fixture, {
      removeFineThrows: "the ten-minute window for taking that back has closed",
    });
    await settle();
    const before = els["#feed"].innerHTML;

    const btn = clickUndo(els, "fresh");
    await settle(20);

    t.check("keeps the fine on the board",
      els["#feed"].innerHTML === before,
      "the board dropped a fine the database still has");
    t.check("does not claim success",
      !/rescinded\./i.test(els["#toast"].textContent), els["#toast"].textContent);
    t.check("surfaces the reason",
      /ten-minute window/.test(els["#toast"].textContent), els["#toast"].textContent);
    t.check("re-enables the button so it can be retried", btn.disabled === false);
  }

  t.done();
})();
