-- Enable extensions
create extension if not exists "pgcrypto";

-- Helper types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_enum') then
    create type public.role_enum as enum ('user', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'player_category') then
    create type public.player_category as enum (
      'top_scorer',
      'top_assist',
      'top_rebound',
      'top_dunk',
      'top_threes'
    );
  end if;
end
$$;

-- Helper function
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

-- Tables
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.role_enum not null default 'user',
  anima_points_balance integer not null default 0,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.anima_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_game_id text not null,
  season text not null,
  status text not null,
  game_date timestamptz not null,
  locked_at timestamptz,
  home_team_id uuid not null,
  away_team_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_game_id)
);

create table if not exists public.player (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_player_id text not null,
  team_id uuid not null,
  first_name text not null,
  last_name text not null,
  position text,
  created_at timestamptz not null default timezone('utc', now()),
  unique(provider, provider_player_id)
);

create table if not exists public.picks_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  selected_team_id uuid not null,
  pick_date date not null,
  changes_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, game_id, pick_date)
);

create table if not exists public.picks_players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  category public.player_category not null,
  player_id uuid not null references public.player(id),
  pick_date date not null,
  changes_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, game_id, category, pick_date)
);

create table if not exists public.picks_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  player_id uuid not null references public.player(id),
  rank integer not null check (rank between 1 and 10),
  pick_date date not null,
  changes_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, rank, pick_date)
);

create table if not exists public.results_team (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  winner_team_id uuid not null,
  settled_at timestamptz not null default timezone('utc', now()),
  unique(game_id)
);

create table if not exists public.results_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  category public.player_category not null,
  player_id uuid not null references public.player(id),
  settled_at timestamptz not null default timezone('utc', now()),
  unique(game_id, category)
);

create table if not exists public.results_highlights (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.player(id),
  rank integer not null check (rank between 1 and 10),
  result_date date not null,
  settled_at timestamptz not null default timezone('utc', now()),
  unique(result_date, rank)
);

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  card_id uuid not null references public.shop_cards(id) on delete cascade,
  acquired_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shop_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  rarity text not null check (rarity in ('common','rare','epic','legendary')),
  price integer not null check (price >= 0),
  image_url text not null,
  accent_color text,
  category text not null check (category in ('Rosters','Celebrations','Courtside','Iconic')),
  conference text not null check (conference in ('Eastern Conference','Western Conference','Special')),
  check (conference <> 'Special' or category = 'Courtside'),
  created_at timestamptz not null default timezone('utc', now())
);

-- Row Level Security
alter table public.users enable row level security;
alter table public.anima_points_ledger enable row level security;
alter table public.picks_teams enable row level security;
alter table public.picks_players enable row level security;
alter table public.picks_highlights enable row level security;
alter table public.results_team enable row level security;
alter table public.results_players enable row level security;
alter table public.results_highlights enable row level security;
alter table public.user_cards enable row level security;
alter table public.shop_cards enable row level security;
alter table public.games enable row level security;
alter table public.player enable row level security;

-- Users policies
create policy "Users can view self" on public.users
  for select
  using (auth.uid() = id or public.is_admin());

create policy "Users can update profile" on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins manage users" on public.users
  using (public.is_admin())
  with check (public.is_admin());

-- Ledger policies
create policy "Users view own ledger" on public.anima_points_ledger
  for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Admin manage ledger" on public.anima_points_ledger
  using (public.is_admin())
  with check (public.is_admin());

-- Picks policies
create policy "Users manage own team picks" on public.picks_teams
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admin manage team picks" on public.picks_teams
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users manage own player picks" on public.picks_players
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admin manage player picks" on public.picks_players
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users manage own highlights picks" on public.picks_highlights
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admin manage highlights picks" on public.picks_highlights
  using (public.is_admin())
  with check (public.is_admin());

-- Results policies (admin only)
create policy "Admin manage team results" on public.results_team
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin manage player results" on public.results_players
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin manage highlights results" on public.results_highlights
  using (public.is_admin())
  with check (public.is_admin());

-- Cards policies
create policy "Users view own cards" on public.user_cards
  for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Users insert own cards" on public.user_cards
  for insert
  with check (auth.uid() = user_id);

create policy "Admin manage user cards" on public.user_cards
  using (public.is_admin())
  with check (public.is_admin());

create policy "Shop cards readable" on public.shop_cards
  for select
  using (true);

create policy "Admin manage shop cards" on public.shop_cards
  using (public.is_admin())
  with check (public.is_admin());

-- Games & players
create policy "Everyone can view games" on public.games
  for select using (true);

create policy "Admin manage games" on public.games
  using (public.is_admin())
  with check (public.is_admin());

create policy "Everyone can view players" on public.player
  for select using (true);

create policy "Admin manage players" on public.player
  using (public.is_admin())
  with check (public.is_admin());
