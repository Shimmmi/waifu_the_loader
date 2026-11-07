-- v3: шаблоны, персонажи, база, забег, сюжет, наследие.
CREATE TABLE character_templates (
  template_id  text PRIMARY KEY,
  race         text NOT NULL,
  class        text NOT NULL,
  first_name   text NOT NULL,
  last_name    text NOT NULL,
  look_tags    jsonb NOT NULL DEFAULT '[]',
  portrait     text NOT NULL,
  thumb        text NOT NULL,
  status       text NOT NULL CHECK (status IN ('draft', 'approved', 'rejected')),
  pack_version int NOT NULL DEFAULT 1,
  phash        text
);
CREATE INDEX character_templates_pair ON character_templates (race, class, status);

CREATE TABLE characters (
  id               uuid PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id      text REFERENCES character_templates(template_id),
  legacy_portrait  boolean NOT NULL DEFAULT false,
  race             text NOT NULL,
  class            text NOT NULL,
  rarity           text NOT NULL,
  first_name       text NOT NULL,
  last_name        text NOT NULL,
  nickname         text NOT NULL DEFAULT '',
  bio              text NOT NULL DEFAULT '',
  quote            text NOT NULL DEFAULT '',
  traits           jsonb NOT NULL DEFAULT '[]',
  level            int NOT NULL DEFAULT 1,
  xp               double precision NOT NULL DEFAULT 0,
  star_rank        int NOT NULL DEFAULT 0,
  portrait         text NOT NULL DEFAULT '',
  thumb            text NOT NULL DEFAULT '',
  in_reserve       boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX characters_template_user ON characters (user_id, template_id) WHERE template_id IS NOT NULL;
CREATE INDEX characters_user ON characters (user_id);

CREATE TABLE player_base (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  base_template_id text NOT NULL,
  layout_type      text NOT NULL,
  plots            jsonb NOT NULL,
  plot_cap         int
);

CREATE TABLE run_cards (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cards          jsonb NOT NULL DEFAULT '[]',
  pending        jsonb,
  pending_bases  jsonb
);

CREATE TABLE run_state (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  credits            double precision NOT NULL DEFAULT 0,
  tons_run           double precision NOT NULL DEFAULT 0,
  pity               jsonb NOT NULL,
  expansions         int NOT NULL DEFAULT 0,
  card_dry           int NOT NULL DEFAULT 0,
  free_rerolls_used  int NOT NULL DEFAULT 0,
  offer_rerolls      int NOT NULL DEFAULT 0,
  base_rerolls       int NOT NULL DEFAULT 0,
  last_tick          timestamptz NOT NULL DEFAULT now(),
  spent              double precision NOT NULL DEFAULT 0,
  last_expand_cost   double precision NOT NULL DEFAULT 0,
  counters           jsonb NOT NULL DEFAULT '{}',
  pending_free       int NOT NULL DEFAULT 0,
  company            text NOT NULL DEFAULT '',
  motion             boolean NOT NULL DEFAULT true,
  offline            jsonb,
  offers             jsonb NOT NULL DEFAULT '[]',
  active             jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE story_state (
  user_id  uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  seen     jsonb NOT NULL DEFAULT '[]',
  queue    jsonb NOT NULL DEFAULT '[]',
  journal  jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE meta_state (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legacy      int NOT NULL DEFAULT 0,
  stars       int NOT NULL DEFAULT 0,
  rebirths    int NOT NULL DEFAULT 0,
  meta        jsonb NOT NULL DEFAULT '{}',
  flags       jsonb NOT NULL DEFAULT '{}',
  tons_total  double precision NOT NULL DEFAULT 0,
  last_daily  text NOT NULL DEFAULT '',
  migrated_at timestamptz
);

CREATE TABLE ai_log (
  id         bigserial PRIMARY KEY,
  user_id    uuid,
  model      text,
  tokens     int,
  ok         boolean NOT NULL,
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE v3_rolls (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  result     jsonb NOT NULL,
  PRIMARY KEY (user_id, request_id)
);
