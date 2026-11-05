# Промпты заглушек терминала

Файлы лежат в `client/public/terminal/`. Замена картинки по тому же пути меняет вид без правки кода. На экране сырые id не показываются. Фон генерации для иконок — сплошной `#FF00FF`, потом он вырезается.

Стиль общий: chunky 16-bit pixel art, тёплый кремовый интерфейс (`#f3e6c8`, `#fff6df`, текст `#4a3420`, акцент `#f0b429`), без текста на картинке, без тени и без рамки кадра.

## Карта и строения

| Файл | Промпт |
|---|---|
| `map.webp` | Wide pixel-art background of a space-port warehouse terminal, sandy roads, low buildings, warm daylight, no characters, no text, no UI. |
| `buildings/pier.webp` | Pixel-art exterior of a dock with a small shuttle, isometric, no text, transparent or flat ground. |
| `buildings/warehouse.webp` | Pixel-art exterior of a brick warehouse with a sign board, isometric, no text. |
| `buildings/dorm.webp` | Pixel-art exterior of a two-story dorm with lit windows, isometric, no text. |
| `buildings/office.webp` | Pixel-art exterior of a small office with a satellite dish, isometric, no text. |
| `buildings/garage.webp` | Pixel-art exterior of an open garage with a forklift bay, isometric, no text. |
| `buildings/rest.webp` | Pixel-art exterior of a tiny cafe named only by a cup icon, isometric, no readable text. |
| `buildings/canteen.webp` | Pixel-art exterior of a canteen, isometric, no text. |
| `buildings/school.webp` | Pixel-art exterior of a small training school, isometric, no text. |
| `buildings/crane.webp` | Pixel-art exterior of a crane hangar, isometric, no text. |
| `buildings/dispatch.webp` | Pixel-art exterior of a radio dispatch hut, isometric, no text. |
| `buildings/fridge.webp` | Pixel-art exterior of a cold-storage box, isometric, no text. |
| `buildings/workshop.webp` | Pixel-art exterior of a repair workshop, isometric, no text. |
| `buildings/bunker.webp` | Pixel-art exterior of a low bunker door, isometric, no text. |
| `buildings/garden.webp` | Pixel-art exterior of a small greenhouse, isometric, no text. |
| `buildings/observatory.webp` | Pixel-art exterior of a tiny observatory dome, isometric, no text. |

Интерьеры — те же имена в `interiors/`. Промпт: `Pixel-art interior of a {место}, wide scene, no characters, no text, warm light.` Места: dock, warehouse floor, dorm room, office, garage, rest corner, canteen, classroom, crane bay, dispatch desk, cold room, workshop, bunker hall, greenhouse, observatory.

## Иконки ресурсов

Каталог `ui/`. Один предмет по центру, фон `#FF00FF`.

| Файл | Промпт |
|---|---|
| `logo.png` | Pixel-art cardboard box mascot, warm brown, no text, magenta background. |
| `cargo.png` | Pixel-art taped cardboard cargo box, no text, magenta background. |
| `coin.png` | Pixel-art gold coin, no text, magenta background. |
| `seal.png` | Pixel-art gold star medal, no text, magenta background. |
| `token.png` | Pixel-art pink heart, no text, magenta background. |
| `ticket.png` | Pixel-art blue diamond, no text, magenta background. |
| `shard.png` | Pixel-art small wooden crate, no text, magenta background. |
| `protein.png` | Pixel-art pink drink bottle, no text, magenta background. |
| `up.png` | Pixel-art green upward arrow, no text, magenta background. |

## Меню

Каталог `ui/nav-*.png`. Крупная пиксельная иконка, фон `#FF00FF`, без текста.

| Файл | Промпт |
|---|---|
| `nav-warehouse.png` | Pixel-art small warehouse building. |
| `nav-buildings.png` | Pixel-art stack of cardboard boxes. |
| `nav-collection.png` | Pixel-art two worker busts in hard hats. |
| `nav-gacha.png` | Pixel-art person silhouette with a plus. |
| `nav-training.png` | Pixel-art dumbbell. |
| `nav-contracts.png` | Pixel-art clipboard. |
| `nav-prestige.png` | Pixel-art gold medal. |
| `nav-events.png` | Pixel-art musical note. |
| `nav-achievements.png` | Pixel-art trophy. |
| `nav-shop.png` | Pixel-art paper shopping bag. |
| `nav-profile.png` | Pixel-art metal gear. |
| `nav-admin.png` | Pixel-art robot head. |

## Рамки кнопок

Рисуются без надписи, чтобы текст оставался в вёрстке. Цвета: обводка `#4a3420`, заливка `#fff6df` или `#f0b429`.

| Файл | Назначение |
|---|---|
| `btn.png` | Обычная кнопка |
| `btn-on.png` | Активная кнопка |
| `btn-upgrade.png` | Широкая жёлтая кнопка улучшения |
| `tab.png` | Вкладка |
| `tab-on.png` | Выбранная вкладка |
| `close.png` | Крестик окна |
