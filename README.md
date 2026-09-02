# Offside ⚽

A fine board for an open-plan area with one recurring conversational problem.

Log the offence, the offender pays into the kitty, and at the end of the season
the kitty buys everyone something that is not football.

## Running it

No build step, no dependencies. Open `index.html` in a browser — that's it.

If you'd rather serve it:

```bash
python3 -m http.server 8777
# → http://localhost:8777
```

## What's in it

| Section | What it does |
| --- | --- |
| **Kitty** | Running total of everything collected this season |
| **Stats** | Most-broken rule, average per head, clean sheets, last 7 days |
| **Podium** | Top three offenders, with earned titles |
| **Leaderboard** | Full standings — sortable by kroner, offence count or A–Z |
| **Rule book** | 12 infractions across three severity tiers, kr 20–75 |
| **Report** | Issue a fine; the board updates immediately |
| **Ledger** | The last fifteen entries |

State persists to `localStorage`. The footer has a **Reset to seed data** button.

## Changing the squad or the rules

Edit **`data.js`** and nothing else — everything on the page derives from it.

```js
const EMPLOYEES = [
  { id: "eivind", name: "Eivind", colour: "#b20000" },
  // ...
];

const INFRACTIONS = [
  {
    id: "derby-meltdown", icon: "🔥", name: "Derby day meltdown",
    fine: 75, severity: 3, tint: "#f0deff",
    desc: "Emotionally unavailable for an entire working day because of a result.",
  },
  // ...
];
```

- `severity` — `1` minor, `2` serious, `3` straight red
- `colour` / `tint` — pick from the brand palette in `styles.css`
- `SEED_FINES` uses `daysAgo`, converted to real timestamps on load

Adding an eleventh colleague or a thirteenth offence is a one-line change.
Entries in the stored ledger that point at a deleted person or rule are
discarded on load, so pruning `data.js` won't break a saved board.

## Design

Storebrand-flavoured, using tokens taken from their live design system
stylesheet (`assets.storebrand.no/elements/web24`):

- **Colours** — maroon-black `#310502`, brand red `#b20000`, highlight
  `#da291c`, with the blush / peach / sand / plum surface tints
- **Type** — the real **Stb Display** and **Stb Text** faces, loaded from
  Storebrand's CDN. They are licensed, so the binaries are **not** committed
  here (see `.gitignore`). Without a network connection the page falls back to
  Georgia and the system sans, and still lays out fine.
- **Motif** — the interlocking ovals in the logo and the rotated ovals behind
  the hero are a nod to Storebrand's "link" symbol

## Files

```
index.html    markup
styles.css    design system + layout
data.js       the squad, the rule book, the seed ledger  ← edit this
app.js        scoring, rendering, persistence
```

---

Built for internal amusement. Not a Storebrand product, and not endorsed by one.
All proceeds are fictional. There is no VAR.
