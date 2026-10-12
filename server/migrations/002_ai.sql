-- M3: ИИ-пайплайн (ТЗ 10.3)

-- Настройки моделей с версиями. Активна последняя версия; откат = новая версия с содержимым старой.
CREATE TABLE ai_settings (
  version     serial PRIMARY KEY,
  settings    jsonb NOT NULL,
  comment     text NOT NULL DEFAULT '',
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Каждый вызов RouterAI: модель, токены, стоимость (₽), время, итог модерации.
CREATE TABLE ai_generation_log (
  id                bigserial PRIMARY KEY,
  created_at        timestamptz NOT NULL DEFAULT now(),
  kind              text NOT NULL,              -- text | image | moderation
  purpose           text NOT NULL DEFAULT 'pool', -- pool | test
  model             text NOT NULL,
  ok                boolean NOT NULL,
  error             text,
  prompt_tokens     int,
  completion_tokens int,
  cost_rub          numeric(12, 4) NOT NULL DEFAULT 0,
  duration_ms       int NOT NULL,
  rarity            text,
  pool_id           uuid REFERENCES waifu_pool(id) ON DELETE SET NULL,
  moderation        jsonb
);
CREATE INDEX ai_generation_log_created_idx ON ai_generation_log (created_at);

ALTER TABLE waifu_pool
  ADD COLUMN image_prompt  text,
  ADD COLUMN moderation    jsonb,
  ADD COLUMN gen_cost_rub  numeric(12, 4),
  ADD COLUMN gen_meta      jsonb,
  ADD COLUMN reviewed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at   timestamptz;

CREATE INDEX waifu_pool_ready_source_idx ON waifu_pool (rarity, source) WHERE status = 'ready';
CREATE INDEX waifu_pool_review_idx ON waifu_pool (created_at) WHERE status = 'review';
