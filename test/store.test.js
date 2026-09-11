/* =========================================================
   store.js against a stub Supabase client.

   The point of this file is the difference between "the database said no" and
   "the database did nothing". PostgREST reports both as a 200, so the only
   way store.js can tell them apart is by looking at what came back — and the
   undo path depends on getting that right.
   ========================================================= */
"use strict";

const fs = require("fs");
const vm = require("vm");
const nodePath = require("path");
const { ROOT, suite } = require("./harness");

const t = suite("store.js");

/**
 * A chainable stand-in for the PostgREST query builder. Every method returns
 * `this`, and awaiting it resolves to whatever `result` was set to — which is
 * how the real client behaves, since the builder is itself thenable.
 */
function stubClient(result, log) {
  const builder = {
    from(table) { log.table = table; return this; },
    select(cols) { log.select = cols; return this; },
    insert(row) { log.op = "insert"; log.row = row; return this; },
    delete() { log.op = "delete"; return this; },
    eq(col, val) { log.eq = [col, val]; return this; },
    order() { return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return { from: (tbl) => builder.from(tbl) };
}

function loadStore(result, log) {
  const ctx = {
    console, Date, Object, JSON, String, Number, Array, Error, Promise,
    window: {
      OFFSIDE_CONFIG: { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "anon-key" },
      supabase: { createClient: () => stubClient(result, log) },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(nodePath.join(ROOT, "store.js"), "utf8"), ctx);
  return vm.runInContext("OffsideStore", ctx);
}

(async () => {
  t.section("removeFine — the ten-minute window");

  // Inside the window: the row comes back, so the delete really happened.
  {
    const log = {};
    const store = loadStore({ data: [{ id: "fine-1" }], error: null }, log);
    let threw = null;
    try { await store.removeFine("fine-1"); } catch (e) { threw = e; }
    t.check("resolves when a row was actually deleted", threw === null, threw && threw.message);
    t.check("asks for the deleted rows back", log.select === "id", "select was " + log.select);
    t.check("targets the right row", JSON.stringify(log.eq) === '["id","fine-1"]', JSON.stringify(log.eq));
  }

  // Past the window: RLS filters the row out. Postgres deletes nothing and
  // reports success. This is the case that used to slip through.
  {
    const log = {};
    const store = loadStore({ data: [], error: null }, log);
    let threw = null;
    try { await store.removeFine("fine-1"); } catch (e) { threw = e; }
    t.check("throws when the policy silently refused", threw !== null,
      "resolved as if it had worked — the fine is still in the table");
    t.check("explains the window in the message",
      threw && /ten-minute window/.test(threw.message), threw && threw.message);
  }

  // Belt and braces: a client that returns null data rather than [].
  {
    const store = loadStore({ data: null, error: null }, {});
    let threw = null;
    try { await store.removeFine("fine-1"); } catch (e) { threw = e; }
    t.check("throws on null data too", threw !== null);
  }

  // A genuine transport/permission error still surfaces.
  {
    const store = loadStore({ data: null, error: { message: "network is on fire" } }, {});
    let threw = null;
    try { await store.removeFine("fine-1"); } catch (e) { threw = e; }
    t.check("passes a real error through untouched",
      threw && threw.message === "network is on fire", threw && threw.message);
  }

  t.section("addFine — column names stay inside store.js");
  {
    const log = {};
    const row = { id: "n1", who: "tor", booked_by: "mie", what: "rule", note: "", at: "2026-09-11T10:00:00Z" };
    const store = loadStore({ data: [row], error: null }, log);
    const out = await store.addFine({ who: "tor", by: "mie", what: "rule", note: "" });
    t.check("writes the referee to booked_by", log.row && log.row.booked_by === "mie", JSON.stringify(log.row));
    t.check("keeps offender and referee apart", log.row && log.row.who === "tor", JSON.stringify(log.row));
    t.check("maps booked_by back to `by` for the app", out.by === "mie", JSON.stringify(out));
    t.check("returns millis, not a timestamp string", typeof out.at === "number", typeof out.at);
  }

  t.section("fines — a ledger with no referees");
  {
    const rows = [{ id: "a", who: "tor", booked_by: null, what: "rule", note: "", at: "2026-09-11T10:00:00Z" }];
    const store = loadStore({ data: rows, error: null }, {});
    const out = await store.fines();
    t.check("a missing referee arrives as null", out[0].by === null, JSON.stringify(out[0]));
  }

  t.section("configured()");
  {
    const store = loadStore({ data: [], error: null }, {});
    t.check("true once real values are in config.js", store.configured() === true);
  }

  t.done();
})();
