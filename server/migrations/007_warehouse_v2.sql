-- Классы биржи и состояние конвейера v2. Тик v1 не меняется, пока флаг выключен.
ALTER TABLE waifu_pool ADD COLUMN IF NOT EXISTS native_class text;

UPDATE waifu_pool SET native_class = CASE
  WHEN COALESCE((stats->>'spd')::float, 0) >= GREATEST(COALESCE((stats->>'str')::float, 0) + COALESCE((stats->>'end')::float, 0), COALESCE((stats->>'lck')::float, 0), COALESCE((stats->>'cha')::float, 0)) THEN 'driver'
  WHEN COALESCE((stats->>'lck')::float, 0) >= GREATEST(COALESCE((stats->>'str')::float, 0) + COALESCE((stats->>'end')::float, 0), COALESCE((stats->>'cha')::float, 0)) THEN 'crane'
  WHEN COALESCE((stats->>'cha')::float, 0) >= COALESCE((stats->>'str')::float, 0) + COALESCE((stats->>'end')::float, 0) THEN 'clerk'
  ELSE 'loader'
END
WHERE native_class IS NULL;

ALTER TABLE waifu_instances ADD COLUMN IF NOT EXISTS current_class text;
ALTER TABLE waifu_instances ADD COLUMN IF NOT EXISTS line_zone text;
ALTER TABLE waifu_instances ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false;
ALTER TABLE waifu_instances ADD COLUMN IF NOT EXISTS favorite_order int NOT NULL DEFAULT 0;
ALTER TABLE waifu_instances ADD COLUMN IF NOT EXISTS shifts_worked int NOT NULL DEFAULT 0;
ALTER TABLE waifu_instances ADD COLUMN IF NOT EXISTS wage_debt int NOT NULL DEFAULT 0;
ALTER TABLE waifu_instances ADD COLUMN IF NOT EXISTS hidden_trait text;
ALTER TABLE waifu_instances ADD COLUMN IF NOT EXISTS gear jsonb;

CREATE TABLE IF NOT EXISTS warehouse_state (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS unions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fund numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS union_members (
  union_id uuid NOT NULL REFERENCES unions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  PRIMARY KEY (union_id, user_id)
);
