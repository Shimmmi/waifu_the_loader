-- Терминал. Флаг app_flags.terminal не ставится этой миграцией и не ставится при старте сервера.
CREATE TABLE IF NOT EXISTS app_flags (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS terminal_state (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  expand_n int NOT NULL DEFAULT 0,
  rerolls int NOT NULL DEFAULT 0,
  offer jsonb NOT NULL DEFAULT '[]'::jsonb,
  mode text NOT NULL DEFAULT 'normal',
  shift_started_at timestamptz,
  shift_ends_at timestamptz,
  trial_done boolean NOT NULL DEFAULT false,
  rush_until timestamptz,
  rush_ready_at timestamptz,
  shift_kg text NOT NULL DEFAULT '0',
  shift_coins text NOT NULL DEFAULT '0',
  expected_kg text NOT NULL DEFAULT '0',
  report jsonb,
  seen_intro boolean NOT NULL DEFAULT false,
  pairs jsonb NOT NULL DEFAULT '{}'::jsonb,
  courses jsonb NOT NULL DEFAULT '{}'::jsonb,
  morale int NOT NULL DEFAULT 0,
  building_until timestamptz,
  building_sector text,
  building_spent int NOT NULL DEFAULT 0,
  auto_shift boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS terminal_sectors (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector text NOT NULL,
  level int NOT NULL DEFAULT 1,
  spent int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, sector)
);

ALTER TABLE waifu_instances ADD COLUMN IF NOT EXISTS station text;
