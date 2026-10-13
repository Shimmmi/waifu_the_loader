-- M5: достижения, косметика, событие, рейтинг, ежедневки, мини-события, перегенерация

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS hit_hard_pity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_streak int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_seen_on date;

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id  text NOT NULL,
  tier            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id, tier)
);

CREATE TABLE IF NOT EXISTS user_cosmetics (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_id  text NOT NULL,
  source       text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_id)
);

CREATE TABLE IF NOT EXISTS user_loadout (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  frame      text,
  title      text,
  warehouse  text,
  card       text,
  summon     text
);

CREATE TABLE IF NOT EXISTS weekly_cargo (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week     date NOT NULL,
  cargo    text NOT NULL DEFAULT '0',
  PRIMARY KEY (user_id, week)
);

CREATE TABLE IF NOT EXISTS event_claims (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id   text NOT NULL,
  milestone  int  NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id, milestone)
);

CREATE TABLE IF NOT EXISTS daily_progress (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        date NOT NULL,
  trainings  int  NOT NULL DEFAULT 0,
  contracts  int  NOT NULL DEFAULT 0,
  pulls      int  NOT NULL DEFAULT 0,
  claimed    text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS mini_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  choice      int,
  resolved_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS mini_events_open ON mini_events (user_id) WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS portrait_regens (
  instance_id uuid PRIMARY KEY REFERENCES waifu_instances(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending',
  tokens      int  NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
