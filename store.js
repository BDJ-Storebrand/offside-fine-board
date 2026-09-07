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

    /** The whole ledger. Timestamps come back as millis, as before. */
    fines: async function () {
      var rows = unwrap(
        await db()
          .from("fines")
          .select("id,who,what,note,at")
          .order("at", { ascending: false })
      );
      return rows.map(function (r) {
        return {
          id: r.id,
          who: r.who,
          what: r.what,
          note: r.note || "",
          at: new Date(r.at).getTime(),
        };
      });
    },

    /** Log an offence. Returns the row the database actually stored. */
    addFine: async function (who, what, note) {
      var rows = unwrap(
        await db()
          .from("fines")
          .insert({ who: who, what: what, note: note || "" })
          .select("id,who,what,note,at")
      );
      var r = rows[0];
      return { id: r.id, who: r.who, what: r.what, note: r.note || "", at: new Date(r.at).getTime() };
    },

    /**
     * Take back a misfire. The database only permits this within ten minutes
     * of the entry being logged, so a stranger cannot clear the season.
     */
    removeFine: async function (id) {
      unwrap(await db().from("fines").delete().eq("id", id));
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
