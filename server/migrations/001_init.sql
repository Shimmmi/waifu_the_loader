-- Waifu Movers: базовая схема (M1 + M2)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE invite_codes (
  code        text PRIMARY KEY,
  note        text NOT NULL DEFAULT '',
  max_uses    int  NOT NULL DEFAULT 1,
  uses        int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname         text NOT NULL,
  is_admin         boolean NOT NULL DEFAULT false,
  invite_code      text REFERENCES invite_codes(code),
  age_confirmed_at timestamptz NOT NULL,
  settings         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- sha256 кода восстановления: вход с другого устройства без email
  recovery_hash    text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

-- Ресурсы игрока. Большие числа — text (мантисса+экспонента, break_infinity).
CREATE TABLE player_state (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cargo              text NOT NULL DEFAULT '0',
  cargo_total        text NOT NULL DEFAULT '0',
  coins              text NOT NULL DEFAULT '0',
  protein            text NOT NULL DEFAULT '0',
  tickets            int  NOT NULL DEFAULT 0,
  tokens             int  NOT NULL DEFAULT 0,
  seals              text NOT NULL DEFAULT '0',
  shards             int  NOT NULL DEFAULT 0,
  cargo_milestone    int  NOT NULL DEFAULT 0,
  last_tick_at       timestamptz NOT NULL DEFAULT now(),
  last_daily_on      date,
  total_pulls        int  NOT NULL DEFAULT 0,
  config_version     text NOT NULL DEFAULT ''
);

CREATE TABLE buildings_state (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  building_id  text NOT NULL,
  level        int  NOT NULL,
  PRIMARY KEY (user_id, building_id)
);

-- Пул заранее сгенерированных waifu (ТЗ 10.2)
CREATE TABLE waifu_pool (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rarity        text NOT NULL,
  archetype     text NOT NULL,
  name          text NOT NULL,
  age           int  NOT NULL CHECK (age >= 18),
  bio           text NOT NULL,
  quote         text NOT NULL,
  appearance    text NOT NULL,
  stats         jsonb NOT NULL,
  talents       jsonb NOT NULL,
  portrait_url  text NOT NULL,
  thumb_url     text NOT NULL,
  seed          bigint NOT NULL,
  source        text NOT NULL,         -- reserve | procedural | ai | fallback
  status        text NOT NULL,         -- ready | taken | review | rejected
  owner_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  reserve_id    text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  taken_at      timestamptz
);
CREATE INDEX waifu_pool_ready_idx ON waifu_pool(rarity, archetype) WHERE status = 'ready';

CREATE TABLE waifu_instances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pool_id      uuid NOT NULL UNIQUE REFERENCES waifu_pool(id),
  rarity       text NOT NULL,
  archetype    text NOT NULL,
  custom_name  text,
  level        int  NOT NULL DEFAULT 1,
  stars        int  NOT NULL DEFAULT 0,
  xp           int  NOT NULL DEFAULT 0,
  zone         text,                   -- 'warehouse' | null
  obtained_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, archetype, rarity)
);
CREATE INDEX waifu_instances_user_idx ON waifu_instances(user_id);

CREATE TABLE banners (
  id         text PRIMARY KEY,
  type       text NOT NULL,
  config     jsonb NOT NULL,
  starts_at  timestamptz,
  ends_at    timestamptz
);

CREATE TABLE gacha_pity (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banner_id  text NOT NULL,
  since_ssr  int NOT NULL DEFAULT 0,
  since_sr   int NOT NULL DEFAULT 0,
  pulls      int NOT NULL DEFAULT 0,
  uses       int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, banner_id)
);

CREATE TABLE gacha_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banner_id   text NOT NULL,
  request_id  text NOT NULL,
  pull_count  int  NOT NULL,
  results     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);
CREATE INDEX gacha_log_user_idx ON gacha_log(user_id, created_at DESC);

CREATE TABLE currency_ledger (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency    text NOT NULL,
  delta       text NOT NULL,
  reason      text NOT NULL,
  ref         text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX currency_ledger_user_idx ON currency_ledger(user_id, created_at DESC);

CREATE TABLE config_versions (
  version     text PRIMARY KEY,
  hash        text NOT NULL,
  content     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analytics_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  props       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_name_idx ON analytics_events(name, created_at);
