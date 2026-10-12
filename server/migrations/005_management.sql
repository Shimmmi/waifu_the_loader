-- M4: тренировки, контракты, усталость, престиж

ALTER TABLE waifu_instances
  ADD COLUMN IF NOT EXISTS stat_bonus jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fatigue real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fatigue_at timestamptz NOT NULL DEFAULT now();
-- zone: 'warehouse' | 'gym' | 'contract' | null

CREATE TABLE IF NOT EXISTS training_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id  uuid NOT NULL REFERENCES waifu_instances(id) ON DELETE CASCADE,
  type         text NOT NULL,
  duration_min int  NOT NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ends_at      timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'active',  -- active | done | cancelled
  result       jsonb,
  claimed_at   timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS training_jobs_active_instance ON training_jobs (instance_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS training_jobs_user_status ON training_jobs (user_id, status);

CREATE TABLE IF NOT EXISTS contracts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id      text NOT NULL,
  cargo_id       text NOT NULL,
  tag            text NOT NULL,
  stat           text NOT NULL,
  duration_min   int  NOT NULL,
  required_power real NOT NULL,
  reward_coins   text NOT NULL,
  reward_protein text NOT NULL,
  ticket_chance  real NOT NULL,
  status         text NOT NULL DEFAULT 'offer',  -- offer | active | done | expired | cancelled
  team           uuid[] NOT NULL DEFAULT '{}',
  success_chance real,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  started_at     timestamptz,
  ends_at        timestamptz,
  result         jsonb
);
CREATE INDEX IF NOT EXISTS contracts_user_status ON contracts (user_id, status);

CREATE TABLE IF NOT EXISTS prestige_state (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prestiges    int NOT NULL DEFAULT 0,
  seals_earned double precision NOT NULL DEFAULT 0,
  upgrades     jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto         jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_at      timestamptz
);
