# Offside ⚽

A fine board for an open-plan area with one recurring conversational problem.

Log the offence, the offender pays into the kitty, and at the end of the season
the kitty buys everyone something that is not football.

One shared board: whoever logs an offence, everyone sees it. Open tabs update
live; anyone arriving later gets the current standings.

## Setup

The page is plain static files, but the ledger lives in a
[Supabase](https://supabase.com) project so the whole team shares one board.
You need to do this once.

1. **Create the project.** supabase.com → New project. Free tier is plenty.
   Note the region; pick one near you.
2. **Create the tables.** SQL Editor → New query → paste all of
   `supabase/schema.sql` → Run. Safe to re-run.
3. **Load the squad.** Same again with `supabase/seed.local.sql` — the squad
   plus the starting ledger. That file is gitignored because it has real names
   in it.
4. **Point the site at the project.** Project Settings → API. Copy the
   **Project URL** and the **anon / public** key into `config.js`.
   Never the `service_role` key — it bypasses every security policy.
5. **Publish.** Push to `main`, then repo Settings → Pages → Source:
   *Deploy from a branch*, branch `main`, folder `/ (root)`. A minute later the
   board is at `https://<user>.github.io/offside-fine-board/`.

Until step 4 is done the page loads but shows a banner telling you so.

### Updating a board that already exists

`supabase/schema.sql` is idempotent, so upgrading is just running it again —
but **run it before you push**, not after. The site and the database deploy
separately: GitHub Pages publishes the moment `main` moves, while the SQL is a
manual step. Push first and the new code asks for a `booked_by` column that
isn't there yet, and the board shows *"Cannot reach the board"* for everyone
until you catch up.

SQL Editor → paste `supabase/schema.sql` → Run → then push.

### Bump the cache buster when you change a script

The script and stylesheet tags in `index.html` carry a `?v=` date:

```html
<link rel="stylesheet" href="styles.css?v=2026-09-11">
<script src="app.js?v=2026-09-11"></script>
```

**Change `app.js`, `store.js`, `data.js`, `config.js` or `styles.css`? Bump
that date in `index.html` in the same commit.**

Without it the site half-updates. `index.html` and the scripts are separate
files with separate cache lifetimes, so a colleague who has the old `app.js`
still in their browser gets the new page wired to the old logic — new markup
the old script has never heard of, silently left blank. Changing the URL makes
it a different resource, so the browser has no choice but to fetch it.

If someone is looking at a stale board right now, a hard reload
(<kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>) fixes them
immediately.

## Who booked it

Filing a fine starts by picking your own name, and that name is stored next to
the fine. The ledger shows it, the **Busiest referees** block ranks the three
people who have handed out the most, and the full standings carry a **Booked
by** column — the referee on that person's *most recent* fine, so it changes as
the season goes on rather than accumulating.

This is an **honour system**. There is no login, so nothing stops you putting
someone else's name on a booking — the database cannot tell the difference. It
is a signature on a whiteboard, not an audit trail. Fines logged before this
existed have no referee against them and are excluded from the referee
standings, with a note under the block saying how many.

Your own name is remembered in this browser's `localStorage` so you don't
re-pick it every time. That never leaves your machine; it is a convenience,
not a claim of identity.

## Who can see it

**Anyone with the link.** There is no login. Names, running totals and every
ledger note are readable by anyone who finds the URL, and anyone can log an
offence. That is a deliberate choice for a joke board among colleagues — but it
is a real choice, so don't write anything in a note you wouldn't put on a
whiteboard in the corridor.

Two things the database still refuses, via the policies in `schema.sql`:

- **Editing history** — there is no `UPDATE` policy at all, so a fine cannot be
  quietly altered after the fact.
- **Wiping the season** — a fine can only be deleted within ten minutes of
  being logged. Enough to undo a misfire, not enough for a drive-by reset.

If you later want it properly private, the honest answer is that GitHub Pages
can't do that — no server, no password check. You'd move the site to Cloudflare
Pages and put Cloudflare Access in front of it.

## Running it locally

```bash
python3 -m http.server 8777
# → http://localhost:8777
```

Opening `index.html` straight off disk won't work any more — the browser blocks
the Supabase request from a `file://` page. Use the server above.

Local and deployed both talk to the same Supabase project, so **a fine you log
while testing is a real fine on everyone's board.**

## Tests

```bash
node test/run.js
```

No dependencies, no framework, nothing to install — if you have Node, it runs.

There is no build step here, so the tests don't get one either. They load the
real `app.js` and `store.js` into a `vm` context with a hand-rolled stub DOM
and a stub Supabase client, which means what they exercise is the same file
the browser gets, not a module-shaped copy of it. They cover the scoring and
rendering, the report form, the undo path, and the mapping between database
columns and the shapes the app expects. What they can't tell you is whether
the page *looks* right — load it in a browser for that.

Two of the fixtures look odd and are meant to. The ledger is deliberately not
in time order, because a realtime insert arrives on the end of the array and
anything meaning "most recent" has to compare timestamps rather than take the
first row it matches. And one player's most *frequent* infraction differs from
their most *recent* one, so the standings column can't pass by accident.
Please keep both properties if you edit the fixtures.

## What's in it

| Section | What it does |
| --- | --- |
| **Kitty** | Running total of everything collected this season |
| **Stats** | Most-broken rule, average per head, clean sheets, last 7 days |
| **Podium** | Top three offenders, with earned titles |
| **Referees** | Top three by fines handed out — who is doing the policing |
| **Leaderboard** | Full standings — sortable by kroner, offence count or A–Z, showing each player's most recent offence and who booked it |
| **Rule book** | 12 infractions across three severity tiers, kr 20–75 |
| **Report** | Say who you are, then who is getting booked and what for |
| **Ledger** | The last fifteen entries, each showing its referee, undoable for ten minutes |

The footer shows a live/offline indicator for the connection to the board.

## Changing the squad

The squad lives in the database, not in a file — so adding someone doesn't need
a redeploy. Supabase → Table Editor → `players` → Insert row:

| column | example | notes |
| --- | --- | --- |
| `id` | `kari` | lowercase, no spaces; referenced by every fine |
| `name` | `Kari` | what the board shows |
| `colour` | `#819f2b` | avatar colour, from the palette in `styles.css` |
| `active` | `true` | set `false` to retire someone without losing their history |

They appear on the board on the next load.

## Changing the rules

Edit **`data.js`** — the rule book is not sensitive, so it stays in the repo
and remains a one-file change.

```js
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
- `tint` — pick from the brand palette in `styles.css`

Ledger entries pointing at a rule you've deleted are discarded when the board
loads, so pruning `data.js` won't break the saved history.

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
index.html              markup
styles.css              design system + layout
data.js                 the rule book and rank titles     ← edit this
config.js               Supabase project URL + anon key   ← fill this in once
store.js                everything that talks to Supabase
app.js                  scoring, rendering, live updates
supabase/schema.sql     tables and security policies      ← run this once
supabase/seed.local.sql squad + starting ledger (gitignored, has real names)
test/run.js             runs everything below              ← node test/run.js
test/harness.js         stub DOM + Supabase client
test/*.test.js          one file per area
```

---

Built for internal amusement. Not a Storebrand product, and not endorsed by one.
All proceeds are fictional. There is no VAR.
