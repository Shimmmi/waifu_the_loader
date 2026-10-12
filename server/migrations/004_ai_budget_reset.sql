-- Ручной сброс дневного лимита: сегодняшний расход считается с момента последнего сброса.
-- Журнал ai_generation_log не трогается, месячный лимит учитывает всё.
CREATE TABLE ai_budget_resets (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  comment     text NOT NULL DEFAULT ''
);
