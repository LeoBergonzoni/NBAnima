-- Demo teams/games/players
with demo_games as (
  insert into public.games (
    id,
    provider,
    provider_game_id,
    season,
    status,
    game_date,
    home_team_id,
    away_team_id
  )
  values
    (
      gen_random_uuid(),
      'balldontlie',
      'demo-game-1',
      '2024-2025',
      'scheduled',
      timezone('utc', now()) + interval '12 hours',
      gen_random_uuid(),
      gen_random_uuid()
    ),
    (
      gen_random_uuid(),
      'balldontlie',
      'demo-game-2',
      '2024-2025',
      'scheduled',
      timezone('utc', now()) + interval '14 hours',
      gen_random_uuid(),
      gen_random_uuid()
    )
  returning *
)
select * from demo_games;

insert into public.player (
  provider,
  provider_player_id,
  team_id,
  first_name,
  last_name,
  position
)
values
  ('balldontlie', 'demo-player-1', (select home_team_id from public.games limit 1), 'Luca', 'Rossi', 'G'),
  ('balldontlie', 'demo-player-2', (select away_team_id from public.games limit 1), 'Marco', 'Bianchi', 'F'),
  ('balldontlie', 'demo-player-3', (select home_team_id from public.games offset 1 limit 1), 'Anna', 'Verdi', 'C'),
  ('balldontlie', 'demo-player-4', (select away_team_id from public.games offset 1 limit 1), 'Giulia', 'Neri', 'G');

insert into public.shop_cards (name, description, rarity, price, image_url, accent_color, category, conference)
values
  (
    'Rookie Spark',
    'Carta comune per iniziare la tua collezione NBAnima.',
    'common',
    150,
    '/cards/rookie-spark.png',
    '#ffd166',
    'Player',
    'Eastern Conference'
  ),
  (
    'All-Star Aura',
    'Carta rara con effetti speciali iridescenti.',
    'rare',
    450,
    '/cards/all-star-aura.png',
    '#06d6a0',
    'Celebration',
    'Western Conference'
  ),
  (
    'Legendary Echo',
    'Carta leggendaria dedicata alle icone NBA.',
    'legendary',
    1200,
    '/cards/legendary-echo.png',
    '#ef476f',
    'Courtside',
    'Special'
  );
