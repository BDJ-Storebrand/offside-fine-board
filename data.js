/* =========================================================
   Offside — the rule book
   Edit this file to change the rules, the prices or the rank titles.

   The squad and the ledger are NOT here any more. They live in Supabase so
   that everyone shares one board:
     · add or retire a colleague → Supabase → Table Editor → players
     · the ledger fills itself as people report offences
   ========================================================= */

/* ---------- The rule book ----------
   severity: 1 = minor mumble, 2 = proper offence, 3 = straight red   */
const INFRACTIONS = [
  {
    id: "match-recap", icon: "⚽", name: "Match recap", fine: 20, severity: 1,
    tint: "#ffdfdf",
    desc: "Recounting last night's game to someone who did not ask and does not care.",
  },
  {
    id: "player-gossip", icon: "🗣️", name: "Player gossip", fine: 25, severity: 1,
    tint: "#ffe7e0",
    desc: "Opinions on a striker's haircut, contract or personal life. Not work.",
  },
  {
    id: "transfer-window", icon: "💸", name: "Transfer speculation", fine: 40, severity: 2,
    tint: "#f0deff",
    desc: "\"I heard from a guy on X that he's signing in January.\" You did not. He isn't.",
  },
  {
    id: "table-recital", icon: "📊", name: "League table recital", fine: 30, severity: 1,
    tint: "#e6d1b8",
    desc: "Reading out the standings from memory, including goal difference.",
  },
  {
    id: "referee-rant", icon: "🟥", name: "Referee rant", fine: 30, severity: 2,
    tint: "#ffdfdf",
    desc: "Extended monologue about a decision from a match that has already finished.",
  },
  {
    id: "var-debate", icon: "🖥️", name: "VAR debate", fine: 45, severity: 2,
    tint: "#f0deff",
    desc: "Any sentence containing \"armpit\" and \"offside\" in the same breath.",
  },
  {
    id: "tactics-lecture", icon: "📐", name: "Tactics lecture", fine: 45, severity: 2,
    tint: "#ecf2c2",
    desc: "Drawing a 4-2-3-1 on the whiteboard reserved for the sprint board.",
  },
  {
    id: "xg-dump", icon: "📈", name: "Unsolicited xG dump", fine: 35, severity: 2,
    tint: "#ecf2c2",
    desc: "Expected goals, progressive carries, PPDA. In a meeting about pensions.",
  },
  {
    id: "fantasy-league", icon: "🧙", name: "Fantasy team update", fine: 35, severity: 2,
    tint: "#ffe7e0",
    desc: "Live updates on your captain choice. Nobody is in your mini-league.",
  },
  {
    id: "kit-offence", icon: "👕", name: "Wearing the kit", fine: 50, severity: 3,
    tint: "#fdf4e6",
    desc: "Club shirt to the office. Doubles on a day with external visitors.",
  },
  {
    id: "goal-reenactment", icon: "🤸", name: "Goal re-enactment", fine: 60, severity: 3,
    tint: "#ffdfdf",
    desc: "Physically recreating a finish in the open-plan area. Includes the celebration.",
  },
  {
    id: "derby-meltdown", icon: "🔥", name: "Derby day meltdown", fine: 75, severity: 3,
    tint: "#f0deff",
    desc: "Emotionally unavailable for an entire working day because of a result.",
  },
];

/* ---------- Rank titles, worst first ---------- */
const TITLES = [
  { min: 400, label: "Repeat offender" },
  { min: 250, label: "Season ticket holder" },
  { min: 150, label: "On a booking" },
  { min: 60,  label: "Warned once" },
  { min: 1,   label: "Mostly behaves" },
  { min: 0,   label: "Clean sheet" },
];
