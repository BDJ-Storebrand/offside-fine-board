/* =========================================================
   Offside — seed data
   Edit this file to change the squad, the rules or the prices.
   ========================================================= */

/* ---------- The squad ---------- */
const EMPLOYEES = [
  { id: "eivind",  name: "Eivind",  colour: "#b20000" },
  { id: "bradley", name: "Bradley", colour: "#410e44" },
  { id: "isabel",  name: "Isabel",  colour: "#da291c" },
  { id: "mie",     name: "Mie",     colour: "#819f2b" },
  { id: "erik",    name: "Erik",    colour: "#560000" },
  { id: "badr",    name: "Badr",    colour: "#bf0900" },
  { id: "johan",   name: "Johan",   colour: "#776654" },
  { id: "jeppe",   name: "Jeppe",   colour: "#5f3f3f" },
  { id: "igor",    name: "Igor",    colour: "#bb1b18" },
  { id: "cecilie", name: "Cecilie", colour: "#aa0600" },
];

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

/* ---------- Seed ledger ----------
   daysAgo is turned into a real timestamp on load.               */
const SEED_FINES = [
  { who: "eivind",  what: "derby-meltdown",   daysAgo: 1,  note: "Would not speak until 14:00." },
  { who: "eivind",  what: "var-debate",       daysAgo: 1,  note: "Used a coffee cup as the offside line." },
  { who: "eivind",  what: "referee-rant",     daysAgo: 3,  note: "" },
  { who: "eivind",  what: "match-recap",      daysAgo: 4,  note: "Third recap of the same game." },
  { who: "eivind",  what: "tactics-lecture",  daysAgo: 6,  note: "On the retro whiteboard." },
  { who: "eivind",  what: "transfer-window",  daysAgo: 8,  note: "" },
  { who: "eivind",  what: "xg-dump",          daysAgo: 11, note: "" },

  { who: "igor",    what: "goal-reenactment", daysAgo: 2,  note: "Knocked over a plant." },
  { who: "igor",    what: "kit-offence",      daysAgo: 5,  note: "On a day with external visitors." },
  { who: "igor",    what: "match-recap",      daysAgo: 5,  note: "" },
  { who: "igor",    what: "player-gossip",    daysAgo: 7,  note: "" },
  { who: "igor",    what: "referee-rant",     daysAgo: 9,  note: "Ten uninterrupted minutes." },
  { who: "igor",    what: "table-recital",    daysAgo: 12, note: "Including goal difference." },

  { who: "badr",    what: "transfer-window",  daysAgo: 1,  note: "\"Confirmed\" by a fan account." },
  { who: "badr",    what: "transfer-window",  daysAgo: 4,  note: "Different player, same source." },
  { who: "badr",    what: "fantasy-league",   daysAgo: 4,  note: "" },
  { who: "badr",    what: "player-gossip",    daysAgo: 6,  note: "" },
  { who: "badr",    what: "var-debate",       daysAgo: 10, note: "" },
  { who: "badr",    what: "match-recap",      daysAgo: 13, note: "" },

  { who: "jeppe",   what: "fantasy-league",   daysAgo: 2,  note: "Captain choice, live, in stand-up." },
  { who: "jeppe",   what: "fantasy-league",   daysAgo: 9,  note: "Wildcard announcement." },
  { who: "jeppe",   what: "xg-dump",          daysAgo: 3,  note: "In the pension product review." },
  { who: "jeppe",   what: "table-recital",    daysAgo: 7,  note: "" },
  { who: "jeppe",   what: "match-recap",      daysAgo: 14, note: "" },

  { who: "erik",    what: "tactics-lecture",  daysAgo: 2,  note: "Formation drawn on a napkin, then laminated." },
  { who: "erik",    what: "xg-dump",          daysAgo: 5,  note: "" },
  { who: "erik",    what: "referee-rant",     daysAgo: 8,  note: "" },
  { who: "erik",    what: "match-recap",      daysAgo: 15, note: "" },

  { who: "johan",   what: "kit-offence",      daysAgo: 3,  note: "Away kit. Somehow worse." },
  { who: "johan",   what: "player-gossip",    daysAgo: 6,  note: "" },
  { who: "johan",   what: "match-recap",      daysAgo: 11, note: "" },

  { who: "bradley", what: "var-debate",       daysAgo: 4,  note: "Started it, then denied starting it." },
  { who: "bradley", what: "match-recap",      daysAgo: 7,  note: "" },
  { who: "bradley", what: "table-recital",    daysAgo: 16, note: "" },

  { who: "isabel",  what: "goal-reenactment", daysAgo: 6,  note: "Volley. Impressive, still illegal." },
  { who: "isabel",  what: "player-gossip",    daysAgo: 12, note: "" },

  { who: "cecilie", what: "transfer-window",  daysAgo: 9,  note: "" },
  { who: "cecilie", what: "match-recap",      daysAgo: 18, note: "" },

  { who: "mie",     what: "fantasy-league",   daysAgo: 13, note: "Leads the mini-league. Still a fine." },
];
