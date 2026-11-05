-- Старые карточки остаются альбомом. Новые призывы становятся наёмницами.
ALTER TABLE waifu_instances ADD COLUMN IF NOT EXISTS hired boolean NOT NULL DEFAULT false;

-- Десять бесплатных призывов каждому текущему игроку. Миграция применяется один раз.
UPDATE player_state SET tickets = tickets + 10;
