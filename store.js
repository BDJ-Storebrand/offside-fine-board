/* =========================================================
   Offside — the shared board, backed by Supabase.

   What used to live in one browser's localStorage now lives in a Postgres
   table the whole team shares. Log an offence here, it shows up on everyone
   else's board — immediately if their tab is open, on load if it isn't.

   There is no sign-in. What the browser is allowed to do is decided entirely
   by the row-level security policies in supabase/schema.sql.
   ========================================================= */
var OffsideStore = (function () {
  "use strict";

  var cfg = window.OFFSIDE_CONFIG || {};
  var client = null;
  var channel = null;

  /* Has anyone actually filled in config.js? */
  function configured() {
    return !!(cfg.supabaseUrl &&
              cfg.supabaseAnonKey &&
              cfg.supabaseUrl.indexOf("PASTE_") === -1 &&
              cfg.supabaseAnonKey.indexOf("PASTE_") === -1);
  }

  function db() {
    if (!client) {
      if (!window.supabase) throw new Error("The Supabase library did not load.");
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }
    return client;
  }

  /* Supabase hands back { data, error } rather than throwing. Make it throw. */
  function unwrap(res) {
    if (res.error) throw res.error;
    return res.data;
  }

  return {
    configured: configured,

    /** The squad, in the shape the rest of the app already expects. */
    players: async function () {
      var rows = unwrap(
        await db()
          .from("players")
          .select("id,name,colour")
          .eq("active", true)
          .order("name", { ascending: true })
      );
      return rows.map(function (r) {
        return { id: r.id, name: r.name, colour: r.colour };
      });
    },

    /**
     * The whole ledger. Timestamps come back as millis, as before.
     *
     * `by` is the colleague who logged the fine. It is null for anything
     * logged before the honour system existed, so every caller has to cope
     * with not knowing.
     */
    fines: async function () {
      var rows = unwrap(
        await db()
          .from("fines")
          .select("id,who,booked_by,what,note,at")
          .order("at", { ascending: false })
      );
      return rows.map(function (r) {
        return {
          id: r.id,
          who: r.who,
          by: r.booked_by || null,
          what: r.what,
          note: r.note || "",
          at: new Date(r.at).getTime(),
        };
      });
    },

    /**
     * Log an offence. Returns the row the database actually stored.
     *
     * Takes an object rather than four positional strings, because `who` and
     * `by` are both player ids and swapping them silently would fine the
     * wrong colleague.
     */
    addFine: async function (fine) {
      var rows = unwrap(
        await db()
          .from("fines")
          .insert({
            who: fine.who,
            booked_by: fine.by,
            what: fine.what,
            note: fine.note || "",
          })
          .select("id,who,booked_by,what,note,at")
      );
      var r = rows[0];
      return {
        id: r.id,
        who: r.who,
        by: r.booked_by || null,
        what: r.what,
        note: r.note || "",
        at: new Date(r.at).getTime(),
      };
    },

    /**
     * Take back a misfire. The database only permits this within ten minutes
     * of the entry being logged, so a stranger cannot clear the season.
     *
     * A refused delete is NOT an error. The policy is a row filter, so once
     * the window has closed Postgres simply matches no rows and reports
     * success — which would have us tell the caller the fine was rescinded
     * while it sat there in the table, waiting to reappear on the next
     * refresh. `.select()` makes the deleted rows come back so we can tell
     * "removed" from "silently declined" and throw on the latter.
     */
    removeFine: async function (id) {
      var rows = unwrap(
        await db().from("fines").delete().eq("id", id).select("id")
      );
      if (!rows || !rows.length) {
        throw new Error("the ten-minute window for taking that back has closed");
      }
    },

    /**
     * Call `cb` whenever anyone, anywhere, adds or rescinds a fine.
     * This is what makes one person's fine appear on everyone else's board.
     */
    subscribe: function (cb) {
      if (channel) return;
      channel = db()
        .channel("offside-fines")
        .on("postgres_changes", { event: "*", schema: "public", table: "fines" }, cb)
        .subscribe();
    },
  };
})();
