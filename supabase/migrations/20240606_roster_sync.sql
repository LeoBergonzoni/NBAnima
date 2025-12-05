-- Roster sync support: active flag, team history audit, sync runs log

alter table public.player
  add column if not exists active boolean not null default true;

create table if not exists public.player_team_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player(id),
  from_team_id uuid null references public.teams(id),
  to_team_id uuid not null references public.teams(id),
  moved_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_player_team_history_player_moved
  on public.player_team_history (player_id, moved_at desc);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  run_started_at timestamptz not null default timezone('utc'::text, now()),
  run_finished_at timestamptz null,
  status text not null default 'running',
  note text null,
  success_count integer not null default 0,
  failure_count integer not null default 0
);

create index if not exists idx_sync_runs_source_started
  on public.sync_runs (source, run_started_at desc);
