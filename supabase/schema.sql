-- =========================================================
--  Offside — shared board schema
--  Run once in Supabase → SQL Editor → New query → Run.
--  Safe to re-run: everything is idempotent.
--
--  Access model: OPEN
--  ------------------
--  There is no login. Anyone who has the site URL — or the anon key from
--  config.js, which is public — can read the board and log an offence.
--  That is deliberate: it is a joke fine board for one open-plan area.
--
--  Be aware of what that means: your colleagues' names, their running totals
--  and every ledger note are readable by anyone on the internet who finds the
--  URL. Do not put anything in a note you would not put on a whiteboard.
--
--  `fines.booked_by` records who issued a fine, and it is an HONOUR SYSTEM:
--  there is no login, so the database cannot tell whether the name attached to
--  a booking is really the person who typed it. Treat it as a signature on a
--  whiteboard, not as an audit trail. What it is good for is attribution and
--  the referees' leaderboard; what it is not good for is settling an argument.
--
--  What the policies below still prevent:
--    · editing history      — there is no UPDATE policy at all
--    · wiping the board     — a fine can only be deleted within 10 minutes of
--                             being logged, which covers "wrong colleague,
--                             undo" but not a drive-by deletion of the season
--    · junk rows            — length limits are enforced by the database, not
--                             just by the form
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- The squad ----------
-- Lives here rather than in data.js so the roster can be changed without a
-- redeploy: add a colleague in the Table Editor and they appear on the board.
create table if not exists public.players (
  id      text primary key,
  name    text not null,
  colour  text not null default '#b20000',
  active  boolean not null default true
);

-- ---------- The ledger ----------
-- `what` is a rule id from data.js. The rule book stays client-side so it is
-- still a one-file edit, hence no foreign key here. Entries pointing at a rule
-- you later delete are discarded when the board loads.
create table if not exists public.fines (
  id         uuid primary key default gen_random_uuid(),
  who        text not null references public.players(id) on delete cascade,
  booked_by  text references public.players(id) on delete set null,
  what       text not null,
  note       text not null default '',
  at         timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint fines_what_sane check (char_length(what) between 1 and 60),
  constraint fines_note_sane check (char_length(note) <= 90)
);

-- `booked_by` arrived mid-season, so this brings an existing board up to date.
-- (`create table if not exists` above does nothing to a table that already
-- exists, hence the separate alter.)
--
-- Nullable on purpose, and it has to stay that way: the fines logged before
-- the honour system existed have nobody's name against them, and backfilling
-- a guess would be inventing history on an append-only ledger. The form
-- requires a name for everything new; the board renders the old ones without.
--
-- `on delete set null` rather than the `cascade` used by `who`: retiring a
-- colleague should forget that they issued a fine, not erase the fine itself.
alter table public.fines
  add column if not exists booked_by text references public.players(id) on delete set null;

create index if not exists fines_at_idx on public.fines (at desc);

-- ---------- Row-level security ----------
-- RLS is ON, so these policies are the *only* way in. Nothing is implicit.
alter table public.players enable row level security;
alter table public.fines   enable row level security;

drop policy if exists "anyone reads players" on public.players;
create policy "anyone reads players" on public.players
  for select to anon, authenticated using (true);

drop policy if exists "anyone reads fines" on public.fines;
create policy "anyone reads fines" on public.fines
  for select to anon, authenticated using (true);

drop policy if exists "anyone logs a fine" on public.fines;
create policy "anyone logs a fine" on public.fines
  for insert to anon, authenticated with check (true);

-- Undo, not censorship: a ten-minute window to take back a misfire.
drop policy if exists "brief window to rescind" on public.fines;
create policy "brief window to rescind" on public.fines
  for delete to anon, authenticated
  using (created_at > now() - interval '10 minutes');

-- Deliberately no UPDATE policy: the ledger is append-only.

-- ---------- Realtime ----------
-- Push new and rescinded fines to every open tab, so the board updates
-- without anyone hitting reload.
do $$
begin
  alter publication supabase_realtime add table public.fines;
exception
  when duplicate_object then null;
end
$$;
