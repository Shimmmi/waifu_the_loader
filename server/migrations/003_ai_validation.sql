-- Итог валидации ИИ-профиля (kind = 'validation'): доля прошедших — метрика приёмки M3
ALTER TABLE ai_generation_log ADD COLUMN attempts int;
