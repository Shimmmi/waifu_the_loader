# PROMPTS_LOADERS — промпты для генерации изображений грузчиц («Космо-грузчицы»)

Версия 1.0 · 28.10.2026 · Приложение к ТЗ v0.3 (пункт 2). Промпты написаны на английском (для генераторов изображений), пояснения — на русском.

Три слоя промптов: **общий** (стиль, фон, форматы, негативный список), **по расе** (5 рас), **по классу** (6 классов). Дополнительно: эмоции (6) и типажи (6). Итоговый промпт собирается склейкой (раздел 5).

## 0. Как пользоваться

**Формула сборки:**

```text
# TEMPLATE:FORMULA
FINAL_PROMPT   = GENERAL_STYLE + GENERAL_BG + GENERAL_SAFE + {FORMAT: F1..F5} + RACE_x + CLASS_y + EMO_z [+ ARCH_k] [+ EXTRAS]
FINAL_NEGATIVE = GENERAL_NEG + RACE_x_NEG + CLASS_y_NEG
```

Правила работы:

1. Блоки лежат в отдельных блоках кода. **Первая строка каждого блока — служебный тег** (`# PROMPT:ID`, `# NEGATIVE:ID`, `# TEMPLATE:ID`). При копировании в генератор эту строку **не копировать**.
2. Слои склеиваются через запятую или перенос строки в порядке формулы. Не менять порядок, не сокращать формулировки, не добавлять «улучшатели» от себя.
3. Подстановки в фигурных скобках (`{SKIN_TONE}`, `{HAIR_STYLE}`, `{HAIR_COLOR}`, `{EYE_SHAPE}`, `{EYE_COLOR}`, `{OUTFIT_COLOR}`, `{RACE_PALETTE}`, `{LED_COLOR}`, `{ACTION}`) заменяются значениями из приложения A. После подстановки скобок в тексте быть не должно.
4. Рекомендуемый порядок генерации одного персонажа: **F1** (портрет, нейтральное лицо) → одобрить → **F2** (полный рост) → **F3** (лист поворотов) → **F4** (лист эмоций) → **F5** (рабочая поза). Одобренные F1/F2 использовать как референс для остальных (раздел 2.8).
5. Размеры и соотношения сторон по умолчанию: см. таблицу в разделе 2.5.
6. Все результаты записываются по правилам раздела 10.

## 1. Правила и ограничения

1. **Возраст.** Все героини — девушки разного возраста. По телосложению также могут различными - как хрупкого, так и крупного/мощного в зависимости от расы. 
2. **Одежда и ракурсы** — по нормам: закрытая или открытая рабочая/повседневная одежда. Открыты различные части тела, но в пределах допустимого (нет изображений нагой груди);
3. **Тон.** Изображения без эротики и откровенного контента, но с возможными seductive темами. 
4. **Содержимое.** Допускаются  реальных бренды в грузовой тематике (например ozon, wildberries и т.д.). Никаких реальных и узнаваемых персонажей. На изображении нет текста, логотипов, водяных знаков и рамок.
5. **Стиль.** Единый для всей игры: аниме пиксель-арт стиль.
6. **Условия сервиса.** Условия использования и коммерческого применения результатов определяет сервис генерации. Владелец проверяет их до использования изображений в релизе и записывает ссылку в журнал.

## 2. Общий промпт (GENERAL)

### 2.1 Стиль: пиксель-арт (основной режим)

```text
# PROMPT:GENERAL_STYLE
pixel art illustration of an original anime-style character, woman who looks 18 to 28 years old, cute face, large expressive eyes with one bright highlight, tiny nose shown only by a small shadow, expressive eyebrows, clean 1-pixel dark outline, crisp hard-edged pixels, no anti-aliasing, limited palette of 16 to 24 colors inspired by the DawnBringer 32 palette, flat cel shading with three tones (shadow, base, light), consistent light from the upper left, readable silhouette, cheerful professional mood, sci-fi cargo terminal worker
```

### 2.2 Стиль: чистая иллюстрация для последующей пикселизации (второй режим)

Если генератор плохо держит пиксель-арт, используйте этот режим, а затем уменьшайте изображение и приводите к палитре вне генератора.

```text
# PROMPT:GENERAL_STYLE_HIRES
clean high-resolution anime illustration of an original character, woman who looks 18 to 28 years old, cute face, large expressive eyes with one bright highlight, simplified shapes designed to be downscaled into pixel art, bold clean line art with uniform line weight, flat cel shading with three tones (shadow, base, light), limited palette of about 24 flat colors, no gradients, no texture noise, consistent light from the upper left, readable silhouette, cheerful professional mood, sci-fi cargo terminal worker
```

### 2.3 Фон

```text
# PROMPT:GENERAL_BG
plain solid flat light gray background (#D0D0D0), no scenery, no floor shadow, no props except those described, no text, no watermark, no logo, no frame, no border
```

### 2.4 Одежда и ракурсы

```text
# PROMPT:GENERAL_SAFE
in practical work clothing, modest and professional look, relaxed neutral posture, camera at eye level, strictly front view or side profile, no dramatic angles
```

### 2.5 Форматы (F1–F5)

| Формат | Назначение | Соотношение | Размер по умолчанию |
|---|---|---|---|
| F1 | Портрет по плечи (для портрета 48×48) | 1:1 | 1024×1024 |
| F2 | Полный рост (референс спрайта 16×24) | 2:3 | 832×1216 |
| F3 | Лист поворотов: вид спереди, сбоку, сзади | 3:2 | 1536×1024 |
| F4 | Лист эмоций: 6 портретов в сетке 3×2 | 3:2 | 1536×1024 |
| F5 | Рабочая поза в профиле (референс анимаций) | 1:1 | 1024×1024 |

```text
# PROMPT:F1_PORTRAIT
bust portrait, head and shoulders, front view with a very slight three-quarter turn, looking at the viewer, centered with a small margin on all sides, bold simple facial features that stay readable when downscaled to 48x48 pixels, square canvas 1:1
```

```text
# PROMPT:F2_FULLBODY
full-body standing character, front view, relaxed idle pose with arms at the sides, both feet visible, centered with a small margin, chibi-plus proportions about three heads tall (large head, compact body), vertical canvas 2:3
```

```text
# PROMPT:F3_TURNAROUND
character turnaround sheet with the same character shown three times side by side: front view, side view facing right, back view, identical design and scale in every view, evenly spaced, full body, chibi-plus proportions about three heads tall, wide canvas 3:2
```

```text
# PROMPT:F4_EXPRESSIONS
expression sheet of the same character: six bust portraits in a grid of 3 columns by 2 rows, identical design in every cell, expressions in reading order: neutral, happy, tired, irritated, panicked, dizzy with a small adhesive bandage on the cheek, wide canvas 3:2
```

```text
# PROMPT:F5_ACTION
full-body side view facing right, performing a work action: {ACTION}, dynamic but modest working pose, whole body visible, centered, chibi-plus proportions about three heads tall, square canvas 1:1
```

Подстановка `{ACTION}` берётся из таблицы действий в разделе 4 (колонка «ACTION»).

### 2.6 Негативный промпт (общий)

```text
# NEGATIVE:GENERAL_NEG
photo, photorealistic, 3d render, blurry, anti-aliasing, smooth gradient shading, airbrush, jpeg artifacts, text, letters, numbers, watermark, signature, logo, frame, border, extra fingers, extra limbs, deformed hands, fused fingers, cropped head, cropped feet, multiple characters (except on sheets)
```

### 2.7 Параметры популярных типов сервисов (примеры)

Это ориентиры; параметры сервисов меняются, сверяйтесь с их документацией.

| Тип сервиса | Соотношение сторон | Негативный список | Прочее |
|---|---|---|---|
| Сервисы с параметрами в строке (в стиле Midjourney) | `--ar 1:1`, `--ar 2:3`, `--ar 3:2` | `--no` + список из негативного блока | `--style raw`, умеренная стилизация; фиксировать `--seed` |
| Сервисы с полями (в стиле Stable Diffusion) | поля ширина × высота (размеры из раздела 2.5) | отдельное поле Negative prompt | CFG 5–8, шагов 25–35, фиксировать seed; для консистентности img2img с силой 0,35–0,5 |
| Чат-сервисы изображений | соотношение сторон словами: «square», «vertical 2:3», «wide 3:2» | фраза «do not include: …» со списком | просить «single image» либо «one sheet» по формату |

### 2.8 Консистентность персонажа между генерациями

1. Заведите **карточку персонажа**: все подстановки (раздел 11.A) и номер версии записываются один раз и не меняются.
2. Сначала генерируйте **F3 и F4** (листы) для фиксации дизайна, затем одобренный лист используйте как референс (загрузка изображения) для F1, F2, F5.
3. Фиксируйте seed, если сервис это позволяет; в журнале seed сохраняется.
4. В каждом промпте повторяйте одни и те же слова для причёски, цвета волос, формы и цвета глаз, цвета одежды. Не заменять синонимами.
5. При дрейфе внешности используйте img2img/вариации одобренного изображения с малой силой изменения, а не новую генерацию с нуля.

```text
# TEMPLATE:CHARACTER_CARD
CHARACTER CARD
race: {RACE_ID}            class: {CLASS_ID}           version: v1
SKIN_TONE / RACE_PALETTE : ...
HAIR_STYLE / HAIR_COLOR  : ...
EYE_SHAPE / EYE_COLOR    : ...
OUTFIT_COLOR             : ...
LED_COLOR (android only) : ...
approved reference files : ...
```

## 3. Промпты рас (RACE)

Каждый блок состоит из позитивного промпта (`RACE_*`) и негативной добавки (`RACE_*_NEG`). Значения подстановок — в приложении 11.A, палитры — в 11.B. Раса должна читаться за секунду в масштабе 16×24 (ТЗ v0.1 §6.14.7).

### 3.1 Землянки (`human`)

Эталонная раса, без фантастических признаков. Максимум разнообразия причёсок и лиц.

```text
# PROMPT:RACE_HUMAN
Earthling woman with no fantasy features, natural human skin tone {SKIN_TONE}, {HAIR_STYLE} {HAIR_COLOR} hair, {EYE_SHAPE} {EYE_COLOR} eyes, light natural blush, optional small freckles or a beauty mark, human round ears, friendly confident smile
```

```text
# NEGATIVE:RACE_HUMAN_NEG
pointed elf ears, horns, animal ears, wings, tail, scales, glowing skin, crystals, mechanical parts, translucent body, feathers
```

### 3.2 Кремнийки (`silicate`)

Читаются по кристаллическим рожкам на висках и прожилкам. Кожа гладкая, не «каменная».

```text
# PROMPT:RACE_SILICATE
Silicate woman, a crystalline mineral humanoid, warm pastel mineral-toned skin in {RACE_PALETTE} with a soft smooth surface, two or three small translucent faceted crystal horns on the temples, thin crystal veins on the cheeks and forearms, {HAIR_STYLE} hair whose strands end in translucent gem-like crystal tips with a small sparkle, hair and crystals in the same color, gem-like two-tone irises with a faceted highlight, sturdy but cute build, soft stone-textured sleeves on the forearms
```

```text
# NEGATIVE:RACE_SILICATE_NEG
cracked skin, scars, claws, rough boulder texture, monster face, lava, spikes, jagged rocks, moss
```

### 3.3 Жестянки (`android`)

Читаются по антеннам-«наушникам», светящейся пряди и индикатору. Лицо живое и человеческое.

```text
# PROMPT:RACE_ANDROID
Android woman with a friendly human face, matte porcelain-ceramic skin in {RACE_PALETTE}, thin panel seam lines at the wrists and neck, sensor antenna ears shaped like small headphones, a small glowing status LED on the collar or wrist, {HAIR_STYLE} hair with one glowing fiber-optic strand and softly glowing tips in {LED_COLOR}, large eyes with a ring-shaped interface pupil inside the iris, all panels closed and clean
```

```text
# NEGATIVE:RACE_ANDROID_NEG
exposed wires, exposed mechanical skeleton, cyborg face, robot mask, metal face plates, visible gears, hanging cables, glowing red eyes, menacing look
```

### 3.4 Желейки (`gel`)

Читаются по полупрозрачным волосам и светящемуся «ядру». «Желейность» только на волосах, ушках, манжетах и кончиках пальцев.

```text
# PROMPT:RACE_GEL
Gel woman, a jelly-like slime humanoid, opaque pastel skin in {RACE_PALETTE} with glossy highlights, translucent jelly hair at 60 to 70 percent transparency with bright highlights and droplet tips, droplet-shaped jelly ears, a small glowing core gem shaped like a heart-shaped pebble on the collar or shoulder, translucent cuffs at the wrists, tiny drips at the fingertips, big glossy eyes with gradient irises, slightly shorter height
```

```text
# NEGATIVE:RACE_GEL_NEG
internal organs, bones, skeleton, slime mess, puddle body, goo covering the face, gore, monster, tentacles, mouth full of teeth
```

### 3.5 Пернатки (`avian`)

Читаются по перьевому хохолку, сложенным крыльям и хвостику. Клюва нет.

```text
# PROMPT:RACE_AVIAN
Avian bird-folk woman, feathered crest ears made of two or three feathers on the head, small folded wings on the back like a backpack, a tail of three to five feathers, feather cuffs on the forearms, no beak, human hands and feet in boots, bright eyes with a slightly sharp bird-like highlight, feathers in {RACE_PALETTE} with contrasting mask-like markings, taller and slimmer build, {HAIR_STYLE} hair with a few feather accents
```

```text
# NEGATIVE:RACE_AVIAN_NEG
beak, bird head, talons, spread wings, large wings covering the body, feathers covering bare skin, wings instead of arms, nude
```

## 4. Промпты классов (CLASS)

Каждый класс задаётся одеждой, реквизитом и общим настроем. Цвет одежды `{OUTFIT_COLOR}` берётся из схем приложения 11.C (по три схемы на класс). Строка **ACTION** используется только для формата F5 (подстановка `{ACTION}`). Адаптации под расы (вырезы под рожки, антенны, хохолок, крылья) — раздел 6.

### 4.1 Грузчица (`loader`)

```text
# PROMPT:CLASS_LOADER
cargo terminal loader, wearing a durable utility vest over a long-sleeved shirt in {OUTFIT_COLOR}, work trousers, sturdy boots, thick work gloves, a work cap, holding a small cargo crate in both hands, strong and cheerful posture
```

```text
# NEGATIVE:CLASS_LOADER_NEG
forklift, crane, heavy machinery in the frame, oversized crate hiding the body, barbell, weapon
```

ACTION: `lifting a small cargo crate from a hatch and carrying it forward`

### 4.2 Водитель погрузчика (`driver`)

```text
# PROMPT:CLASS_DRIVER
forklift driver, wearing a high-visibility reflective safety vest in yellow-green with silver stripes over a long-sleeved shirt in {OUTFIT_COLOR}, work trousers, boots, a baseball cap, gloves, a keycard clipped to the belt, holding a forklift ignition key, confident thumbs-up
```

```text
# NEGATIVE:CLASS_DRIVER_NEG
speeding, crash, fire, passengers, car, truck cabin interior, weapon
```

ACTION: `driving a small forklift that carries a crate, side view with the vehicle visible`

### 4.3 Крановщица (`crane`)

```text
# PROMPT:CLASS_CRANE
crane operator, wearing a padded work jacket with a high collar in {OUTFIT_COLOR}, a hard hat with a headset and a small microphone, gloves, holding a joystick controller, focused and calm expression
```

```text
# NEGATIVE:CLASS_CRANE_NEG
dangling cables across the body, falling harness, flames, weapon
```

ACTION: `operating crane control levers inside a small cabin`

### 4.4 Кладовщица (`storekeeper`)

```text
# PROMPT:CLASS_STOREKEEPER
warehouse storekeeper, wearing a pocketed work apron-vest over a shirt in {OUTFIT_COLOR}, round glasses, a pen behind the ear, holding a handheld scanner and a tablet, neat tidy look
```

```text
# NEGATIVE:CLASS_STOREKEEPER_NEG
readable text on papers, barcode artwork, cash register, weapon
```

ACTION: `scanning a crate with a handheld scanner beam and then placing it on a shelf`

### 4.5 Механик (`mechanic`)

```text
# PROMPT:CLASS_MECHANIC
terminal mechanic, wearing a coverall with small oil stains in {OUTFIT_COLOR}, goggles pushed up on the forehead, hair tied back, a large wrench in a tool belt, a small smudge of oil on the cheek, practical and resourceful look
```

```text
# NEGATIVE:CLASS_MECHANIC_NEG
weapon-like tools, blood, fire, welding sparks covering the face, heavy dirt covering the face
```

ACTION: `tightening a bolt with a large wrench`

### 4.6 Бригадир (`foreman`)

```text
# PROMPT:CLASS_FOREMAN
shift foreman, wearing a neat work jacket in {OUTFIT_COLOR}, a white hard hat, an armband, a whistle on a lanyard, holding a tablet, authoritative but friendly look
```

```text
# NEGATIVE:CLASS_FOREMAN_NEG
military uniform, police badge, weapon, rank insignia, stern scowl
```

ACTION: `pointing with the tablet while giving orders`

## 5. Сборка промпта

### 5.1 Порядок склейки

1. `GENERAL_STYLE` (или `GENERAL_STYLE_HIRES`)
2. `GENERAL_BG`
3. `GENERAL_SAFE`
4. Формат `F1…F5` (для F5 подставить `{ACTION}` из раздела 4)
5. `RACE_x` с подстановками из приложения A и B
6. `CLASS_y` с подстановкой `{OUTFIT_COLOR}`
7. `EMO_z` (раздел 7); для форматов F3 и F4 эмоцию не добавлять (лист эмоций уже задан в F4, лист поворотов использует нейтральную)
8. Необязательно: `ARCH_k` (раздел 8) и свои дополнения (`EXTRAS`) — в самом конце
9. Негативный промпт: `GENERAL_NEG` + `RACE_x_NEG` + `CLASS_y_NEG`

### 5.2 Примеры собранных промптов

**Пример 1. F1, Землянка, Грузчица, нейтральное лицо.**
Подстановки: `SKIN_TONE = golden tan`, `HAIR_STYLE = ponytail`, `HAIR_COLOR = chestnut brown`, `EYE_SHAPE = round`, `EYE_COLOR = green`, `OUTFIT_COLOR = blue (#306082)`.
Негативный: `GENERAL_NEG` + `RACE_HUMAN_NEG` + `CLASS_LOADER_NEG`.

```text
# TEMPLATE:EXAMPLE_1
pixel art illustration of an original anime-style character, adult woman who looks 24 to 28 years old, cute but mature face, large expressive eyes with one bright highlight, tiny nose shown only by a small shadow, expressive eyebrows, clean 1-pixel dark outline, crisp hard-edged pixels, no anti-aliasing, limited palette of 16 to 24 colors inspired by the DawnBringer 32 palette, flat cel shading with three tones (shadow, base, light), consistent light from the upper left, readable silhouette, cheerful professional mood, sci-fi cargo terminal worker, plain solid flat light gray background (#D0D0D0), no scenery, no floor shadow, no props except those described, no text, no watermark, no logo, no frame, no border, fully clothed in practical closed work clothing with only face, neck, hands and forearms uncovered, modest and professional look, relaxed neutral posture, camera at eye level, strictly front view or side profile, no dramatic angles, bust portrait, head and shoulders, front view with a very slight three-quarter turn, looking at the viewer, centered with a small margin on all sides, bold simple facial features that stay readable when downscaled to 48x48 pixels, square canvas 1:1, Earthling woman with no fantasy features, natural human skin tone golden tan, ponytail chestnut brown hair, round green eyes, light natural blush, optional small freckles or a beauty mark, human round ears, friendly confident smile, cargo terminal loader, wearing a durable utility vest over a long-sleeved shirt in blue (#306082), work trousers, sturdy boots, thick work gloves, a work cap, holding a small cargo crate in both hands, strong and cheerful posture, calm neutral expression, soft closed-mouth smile, relaxed eyebrows
```

**Пример 2. F2, Жестянка, Крановщица, радость.**
Подстановки: `RACE_PALETTE = mint (#a8e6cf)`, `HAIR_STYLE = twin tails`, `LED_COLOR = cyan`, `OUTFIT_COLOR = orange (#df7126)`.
Негативный: `GENERAL_NEG` + `RACE_ANDROID_NEG` + `CLASS_CRANE_NEG`.

```text
# TEMPLATE:EXAMPLE_2
pixel art illustration of an original anime-style character, adult woman who looks 24 to 28 years old, cute but mature face, large expressive eyes with one bright highlight, tiny nose shown only by a small shadow, expressive eyebrows, clean 1-pixel dark outline, crisp hard-edged pixels, no anti-aliasing, limited palette of 16 to 24 colors inspired by the DawnBringer 32 palette, flat cel shading with three tones (shadow, base, light), consistent light from the upper left, readable silhouette, cheerful professional mood, sci-fi cargo terminal worker, plain solid flat light gray background (#D0D0D0), no scenery, no floor shadow, no props except those described, no text, no watermark, no logo, no frame, no border, fully clothed in practical closed work clothing with only face, neck, hands and forearms uncovered, modest and professional look, relaxed neutral posture, camera at eye level, strictly front view or side profile, no dramatic angles, full-body standing character, front view, relaxed idle pose with arms at the sides, both feet visible, centered with a small margin, chibi-plus proportions about three heads tall (large head, compact body), vertical canvas 2:3, Android woman with a friendly human face, matte porcelain-ceramic skin in mint (#a8e6cf), thin panel seam lines at the wrists and neck, sensor antenna ears shaped like small headphones, a small glowing status LED on the collar or wrist, twin tails hair with one glowing fiber-optic strand and softly glowing tips in cyan, large eyes with a ring-shaped interface pupil inside the iris, all panels closed and clean, crane operator, wearing a padded work jacket with a high collar in orange (#df7126), a hard hat with a headset and a small microphone, gloves, holding a joystick controller, focused and calm expression, happy expression, wide open smile, bright sparkling eyes, raised eyebrows
```

**Пример 3. F5, Пернатка, Механик.**
Подстановки: `RACE_PALETTE = parrot (green, red, yellow)`, `HAIR_STYLE = short pixie cut`, `OUTFIT_COLOR = olive (#6a8a3a)`, `ACTION = tightening a bolt with a large wrench`.
Негативный: `GENERAL_NEG` + `RACE_AVIAN_NEG` + `CLASS_MECHANIC_NEG`.

```text
# TEMPLATE:EXAMPLE_3
pixel art illustration of an original anime-style character, adult woman who looks 24 to 28 years old, cute but mature face, large expressive eyes with one bright highlight, tiny nose shown only by a small shadow, expressive eyebrows, clean 1-pixel dark outline, crisp hard-edged pixels, no anti-aliasing, limited palette of 16 to 24 colors inspired by the DawnBringer 32 palette, flat cel shading with three tones (shadow, base, light), consistent light from the upper left, readable silhouette, cheerful professional mood, sci-fi cargo terminal worker, plain solid flat light gray background (#D0D0D0), no scenery, no floor shadow, no props except those described, no text, no watermark, no logo, no frame, no border, fully clothed in practical closed work clothing with only face, neck, hands and forearms uncovered, modest and professional look, relaxed neutral posture, camera at eye level, strictly front view or side profile, no dramatic angles, full-body side view facing right, performing a work action: tightening a bolt with a large wrench, dynamic but modest working pose, whole body visible, centered, chibi-plus proportions about three heads tall, square canvas 1:1, Avian bird-folk woman, feathered crest ears made of two or three feathers on the head, small folded wings on the back like a backpack, a tail of three to five feathers, feather cuffs on the forearms, no beak, human hands and feet in boots, bright eyes with a slightly sharp bird-like highlight, feathers in parrot green, red and yellow with contrasting mask-like markings, taller and slimmer build, short pixie cut hair with a few feather accents, terminal mechanic, wearing a coverall with small oil stains in olive (#6a8a3a), goggles pushed up on the forehead, hair tied back, a large wrench in a tool belt, a small smudge of oil on the cheek, practical and resourceful look, calm neutral expression, soft closed-mouth smile, relaxed eyebrows
```

### 5.3 Скрипт сборки (необязательно)

Скрипт читает этот же файл и собирает промпт по тегам блоков. Запуск: `python assemble.py`. Файл `PROMPTS_LOADERS.md` должен лежать рядом.

```python
# TEMPLATE:ASSEMBLER_PY
import re
from pathlib import Path

DOC = Path("PROMPTS_LOADERS.md").read_text(encoding="utf-8")
BLOCKS = {}
for m in re.finditer(r"```[a-z]*\n# (PROMPT|NEGATIVE):([A-Z0-9_]+)\n(.*?)```", DOC, re.S):
    BLOCKS[m.group(2)] = m.group(3).strip()


def build(fmt, race, cls, emotion="NEUTRAL", archetype=None, **slots):
    keys = ["GENERAL_STYLE", "GENERAL_BG", "GENERAL_SAFE", fmt,
            "RACE_" + race, "CLASS_" + cls]
    if fmt not in ("F3_TURNAROUND", "F4_EXPRESSIONS"):
        keys.append("EMO_" + emotion)
    if archetype:
        keys.append("ARCH_" + archetype)
    text = ", ".join(BLOCKS[k] for k in keys)
    neg_keys = ["GENERAL_NEG", "RACE_" + race + "_NEG", "CLASS_" + cls + "_NEG"]
    negative = ", ".join(BLOCKS[k] for k in neg_keys)
    for name, value in slots.items():
        text = text.replace("{" + name + "}", value)
    left = re.findall(r"\{[A-Z_]+\}", text)
    if left:
        raise ValueError("unfilled slots: " + ", ".join(sorted(set(left))))
    return text, negative


if __name__ == "__main__":
    prompt, negative = build(
        "F1_PORTRAIT", "HUMAN", "LOADER", emotion="NEUTRAL",
        SKIN_TONE="golden tan", HAIR_STYLE="ponytail", HAIR_COLOR="chestnut brown",
        EYE_SHAPE="round", EYE_COLOR="green", OUTFIT_COLOR="blue (#306082)")
    print(prompt)
    print()
    print("NEGATIVE:", negative)
```

## 6. Матрица «раса × класс»

Что добавить к промпту (в самый конец, как `EXTRAS`), чтобы одежда не скрывала расовый признак. Для Землянок дополнений нет.

| Раса \ Класс | Грузчица | Водитель | Крановщица | Кладовщица | Механик | Бригадир |
|---|---|---|---|---|---|---|
| Землянки | — | — | — | — | — | — |
| Кремнийки | `cap sits behind the crystal horns, stone-textured sleeves over the work gloves` | `cap worn low so the horns stay visible` | `hard hat with two small cutouts for the crystal horns` | `round glasses sit below the horns` | `goggles pushed up between the horns` | `white hard hat with cutouts for the crystal horns` |
| Жестянки | `cap with small openings for the antenna ears, seam lines visible at the wrists` | `cap with openings for the antenna ears` | `headset replaced by the antenna ears with a small microphone` | `scanner beam in the same color as the status LED` | `goggles above the base of the antenna ears` | `armband worn above the wrist LED` |
| Желейки | `translucent cuffs over the work gloves, cap resting on the jelly hair` | `jelly hair under the cap, droplets at the edges` | `headset over the droplet-shaped ears` | `apron straps avoid the glowing core gem` | `goggles on the forehead, drips kept away from the tools` | `white hard hat with the jelly hair visible through the gaps` |
| Пернатки | `cap with an opening for the feather crest, wings tucked under the vest` | `safety vest with wing slits` | `hard hat with a crest opening, jacket with wing slits` | `apron straps avoid the wings, feather cuffs under the sleeves` | `coverall with a wing cutout, tail through a flap` | `white hard hat with a crest opening` |

## 7. Эмоции

Для формата F1 и F5. Соответствие состояниям героини в игре (ТЗ v0.2 §3.4): нейтраль, радость (мораль ≥ 70), усталость (≥ 80), раздражение (мораль ≤ 30), паника (событие), травма.

```text
# PROMPT:EMO_NEUTRAL
calm neutral expression, soft closed-mouth smile, relaxed eyebrows
```

```text
# PROMPT:EMO_JOY
happy expression, wide open smile, bright sparkling eyes, raised eyebrows
```

```text
# PROMPT:EMO_TIRED
tired expression, half-closed eyelids, slightly drooping eyebrows, a small sweat drop, faint dark circles under the eyes
```

```text
# PROMPT:EMO_IRRITATED
irritated expression, furrowed eyebrows, puffed cheek, pressed lips, side glance
```

```text
# PROMPT:EMO_PANIC
panicked expression, wide round eyes with tiny pupils, open mouth, raised eyebrows, small sweat drops
```

```text
# PROMPT:EMO_INJURED
dizzy expression with spiral eyes, a small adhesive bandage on the cheek, wobbly mouth, no blood
```

## 8. Типажи (психотипы)

Необязательный слой для поз и мимики. Соответствие психотипам ТЗ v0.1 §10.2: Трудоголик → `ARCH_WORKAHOLIC`, Душа компании → `ARCH_PARTY`, Ворчун → `ARCH_GRUMBLER`, Хитрец → `ARCH_TRICKSTER`, Тихоня → `ARCH_QUIET`, Бунтарь → `ARCH_REBEL`. Типаж добавляется в конец промпта и не отменяет эмоцию.

```text
# PROMPT:ARCH_WORKAHOLIC
upright confident posture, focused determined gaze, a pencil tucked behind the ear, energetic professional aura
```

```text
# PROMPT:ARCH_PARTY
warm wide smile, one hand raised in a friendly wave, open cheerful body language, sparkling eyes
```

```text
# PROMPT:ARCH_GRUMBLER
arms crossed, puffed cheeks, pouting expression, eyes looking slightly away, mild annoyed attitude
```

```text
# PROMPT:ARCH_TRICKSTER
sly smirk, narrowed playful eyes, one eyebrow raised, hands behind the back, mischievous attitude
```

```text
# PROMPT:ARCH_QUIET
shy posture, gaze lowered, long bangs partly covering the eyes, hands clasped in front, gentle quiet attitude
```

```text
# PROMPT:ARCH_REBEL
confident defiant pose, chewing gum, one corner of the mouth raised, hair with a bold colored streak, rebellious attitude
```

## 9. Контроль качества

### 9.1 Чек-лист приёмки изображения

1. Героиня выглядит взрослой (24–28), лицо милое, без детских признаков.
2. Одежда закрытая, открыты только лицо, шея, кисти и предплечья; ракурс спереди или в профиль.
3. Раса читается за секунду (силуэт и цветовой акцент): рожки-кристаллы, антенны со светящейся прядью, прозрачные волосы с «ядром», хохолок с крыльями; у Землянок признаков нет.
4. Класс читается по одежде и реквизиту (перчатки, жилет, гарнитура, сканер, ключ, белая каска).
5. Один персонаж (кроме листов F3 и F4), все пальцы на месте, руки держат реквизит.
6. Фон ровный светло-серый, без теней, рамок, текста и логотипов.
7. Контур 1 px, резкие края (для пиксельного режима), палитра ограничена, свет сверху слева.
8. Дизайн совпадает с карточкой персонажа (причёска, цвета, форма глаз).
9. На листах F3 и F4 все ячейки одного дизайна и масштаба.
10. Нет реальных людей, брендов, узнаваемых персонажей.
11. Изображение читается при уменьшении до 48×48 (портрет) и 16×24 (полный рост).

### 9.2 Что добавлять к промпту при типовых проблемах

| Симптом | Что добавить (в конец промпта) |
|---|---|
| Лицо выглядит слишком юным | `mature adult face, defined cheekbones, adult proportions, calm confident eyes` |
| Одежда слишком открытая | `fully covered work clothing, long sleeves, long trousers, high neckline` |
| Слишком реалистично или «3D» | `pixel art, flat colors, hard-edged pixels, no shading gradients` |
| Размытые края | `hard-edged pixels, no smoothing, clean 1-pixel outline` |
| Расовый признак пропал | усилить: `clearly visible {feature}` (рожки, антенны, ядро, хохолок) |
| Лишние персонажи или руки | `single character only, exactly two arms, five fingers on each hand` |
| Текст на одежде или фоне | `no text anywhere, plain fabric without prints` |
| Фон не ровный | `plain solid flat light gray background (#D0D0D0), nothing else in the background` |
| Поза «вычурная» | `relaxed neutral posture, front view, arms at the sides` |
| Цвета не из палитры | `limited flat palette of 16 colors, no gradients` |

## 10. Хранение и учёт результатов

1. **Каталог:** `art_src/gen/<race>/<class>/`, где `<race>` ∈ `human, silicate, android, gel, avian`; `<class>` ∈ `loader, driver, crane, storekeeper, mechanic, foreman`.
2. **Имя файла:** `<race>_<class>_<fmt>_<emotion>_s<seed>_v<N>.png`, где `<fmt>` ∈ `F1…F5`, `<emotion>` ∈ `neutral, joy, tired, irritated, panic, injured, sheet`; seed — число или `x`, если сервис не даёт seed. Пример: `avian_mechanic_F1_neutral_s48213_v1.png`.
3. **Промпт рядом:** текстовый файл с тем же именем и расширением `.txt`, внутри — итоговый позитивный и негативный промпты после подстановок.
4. **Принятые файлы:** копия с суффиксом `_OK` перед расширением, например `avian_mechanic_F1_neutral_s48213_v1_OK.png`.
5. **Журнал:** каждая генерация записывается в `docs/art/GENLOG.md`: дата, раса, класс, эмоция, формат, сервис и модель, seed, файл, статус (`принято` / `отклонено`), причина отклонения, ссылка на условия использования сервиса.
6. **Версии:** изменения дизайна — новая версия `v2, v3…` и обновление карточки персонажа.
7. Файлы из `art_src/` в игровую сборку не попадают.

## 11. Приложения

### A. Словарь подстановок

| Переменная | Значения |
|---|---|
| `SKIN_TONE` (6) | `porcelain light`, `light warm beige`, `golden tan`, `warm medium brown`, `deep brown`, `dark ebony brown` |
| `HAIR_STYLE` (12) | `ponytail`, `twin tails`, `bob cut`, `long braid`, `hair bun`, `short pixie cut`, `asymmetric bob`, `loose long hair`, `short hair with a small ponytail`, `shoulder-length hair with side-swept bangs`, `hime cut with straight bangs`, `low work ponytail` |
| `HAIR_COLOR` (16) | естественные: `black`, `dark brown`, `chestnut brown`, `auburn`, `blonde`, `ash blonde`, `dark red`, `silver gray`; яркие: `pink`, `sky blue`, `lavender`, `mint green`, `platinum white`, `scarlet`, `violet`, `golden yellow` |
| `EYE_SHAPE` (8) | `round`, `cat-like`, `sleepy half-lidded`, `sharp`, `long-lashed`, `wide-set round`, `almond`, `gentle droopy` |
| `EYE_COLOR` (12) | `brown`, `dark brown`, `amber`, `hazel`, `green`, `teal`, `blue`, `sky blue`, `violet`, `red`, `gold`, `gray` |
| `LED_COLOR` (4) | `green` (норма), `yellow` (износ выше 50), `red` (износ выше 80), `cyan` (после ремонта) |
| `OUTFIT_COLOR` | по схемам класса, приложение C |
| `RACE_PALETTE` | по таблице расы, приложение B |
| `ACTION` | строка ACTION класса, раздел 4 |

### B. Палитры рас (`RACE_PALETTE`, по 6 значений)

| Раса | Значения |
|---|---|
| Кремнийки | `rose quartz pink (#e8a0b4)`, `amethyst violet (#9a6fd0)`, `jade green (#6cc59a)`, `graphite gray (#6b7280)`, `limestone sand (#d8c9a3)`, `amber orange (#e0a040)` |
| Жестянки | `ceramic white (#f2f2f2)`, `mint (#a8e6cf)`, `metallic pink (#e8a0c0)`, `steel blue (#6f8fb5)`, `champagne gold (#e6d3a3)`, `graphite (#4a4f57)` |
| Желейки | `mint (#9ee6b8)`, `strawberry (#ff8fa3)`, `lavender (#c3a6f0)`, `lemon (#fff08a)`, `sky blue (#8fd3ff)`, `grape (#9b6bd6)` |
| Пернатки | `sparrow (brown and cream)`, `parrot (green, red and yellow)`, `owl (brown, white and tan)`, `magpie (black and white with a blue sheen)`, `flamingo (pink and white)`, `crow (blue-black)` |
| Землянки | палитра задаётся `SKIN_TONE`, `HAIR_COLOR`, `EYE_COLOR` |

### C. Цветовые схемы одежды классов (`OUTFIT_COLOR`)

| Класс | Схема 1 | Схема 2 | Схема 3 |
|---|---|---|---|
| Грузчица | `blue (#306082)` | `orange (#df7126)` | `olive (#6a8a3a)` |
| Водитель | `dark gray (#45475a)` | `navy (#2f3e6b)` | `brown (#6b4a32)` |
| Крановщица | `orange (#df7126)` | `dark teal (#2f6b6b)` | `burgundy (#7a2f45)` |
| Кладовщица | `forest green (#37946e)` | `plum (#76428a)` | `sand (#b89a6a)` |
| Механик | `olive (#6a8a3a)` | `steel gray (#6b7280)` | `rust (#a8552f)` |
| Бригадир | `navy (#2f3e6b)` | `charcoal (#3a3d4a)` | `dark red (#8a2f2f)` |

### D. Соответствие данным игры (ТЗ v0.1 §6.14.5)

| Поле `appearance` | Подстановка |
|---|---|
| `skin` (1–6) | `SKIN_TONE` по порядку списка |
| `hair_style` (1–12) | `HAIR_STYLE` по порядку списка |
| `hair_color` (1–16) | `HAIR_COLOR` по порядку списка |
| `eyes_style` (1–8) | `EYE_SHAPE` по порядку списка |
| `eye_color` (1–12) | `EYE_COLOR` по порядку списка |
| `species` | выбор блока `RACE_*` |
| `uniform.class` | выбор блока `CLASS_*` |
| `uniform.scheme` (1–3) | схема из приложения C |
| `expression_set` | блок `ARCH_*` по психотипу |
