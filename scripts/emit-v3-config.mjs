/** Одноразовая сборка заглушек config/v3. Игра читает JSON. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'config', 'v3');
mkdirSync(root, { recursive: true });
const dump = (name, data) => writeFileSync(resolve(root, name), JSON.stringify(data, null, 2) + '\n');

const S = (str, spd, acc, end, cha, lck) => ({ str, spd, acc, end, cha, lck });
const one = S(1, 1, 1, 1, 1, 1);

const races = [
  ['terran', 'Терранки', S(1, 1, 1, 1, 1, 1), '+10% опыта', 'Нет бонуса к выработке', [{ type: 'xp_mult', value: 0.1 }]],
  ['felid', 'Фелиды', S(1, 1.08, 1, 0.95, 1, 1), '+8% скорости погрузки', '−5% выносливости', [{ type: 'output_add', value: 0.08 }]],
  ['kitsune', 'Кицунэ', S(0.95, 1, 1, 1, 1, 1.08), '+8% удачи', '−5% силы', []],
  ['astrel', 'Астрэли', S(1, 1, 1.08, 0.95, 1, 1), '+8% точности', '−5% выносливости', []],
  ['drakei', 'Дракеи', S(1.1, 0.92, 1, 1, 1, 1), '+10% силы', '−8% скорости', []],
  ['synth', 'Синты', S(1, 1, 1, 1.05, 0.85, 1), 'Выносливость падает медленнее', '−15% к бонусам морали', []],
  ['aquali', 'Аквали', S(0.95, 1, 1, 1.1, 1, 1), '+10% восстановления', '−5% силы', [{ type: 'stamina_regen', value: 0.1 }]],
  ['inferni', 'Инферни', S(1, 1, 1, 1, 0.95, 1), '+8% дохода с контрактов', '−5% морали', [{ type: 'contract_mult', value: 0.08 }]],
].map(([id, name_ru, mult, passive, weakness, effects]) => ({ id, name_ru, mult, passive, weakness, effects }));

const classes = [
  ['loader', 'Грузчица', 'Тоннаж', 'str', 'dock', 1, 20, S(12, 6, 5, 8, 4, 4), S(0.4, 0.2, 0.15, 0.25, 0.1, 0.1)],
  ['forklift', 'Оператор погрузчика', 'Скорость', 'spd', 'dock', 15, S(6, 12, 8, 6, 4, 5), S(0.15, 0.4, 0.2, 0.15, 0.1, 0.15)],
  ['crane', 'Крановщица', 'Тяжёлые грузы', 'acc', 'dock', 12, S(7, 5, 12, 7, 4, 5), S(0.2, 0.15, 0.4, 0.2, 0.1, 0.15)],
  ['stocker', 'Кладовщица', 'Склад', 'acc', 'warehouse', 14, S(6, 5, 11, 8, 5, 5), S(0.15, 0.15, 0.35, 0.25, 0.15, 0.15)],
  ['dispatcher', 'Диспетчер', 'Бригада', 'cha', 'dispatch', 12, S(4, 5, 6, 6, 12, 6), S(0.1, 0.15, 0.15, 0.15, 0.4, 0.2)],
  ['mechanic', 'Механик', 'Ремонт', 'end', 'workshop', 10, S(7, 5, 8, 12, 4, 5), S(0.2, 0.15, 0.25, 0.4, 0.1, 0.15)],
  ['guard', 'Охрана', 'Защита', 'str', 'security', 9, S(11, 6, 5, 8, 8, 4), S(0.35, 0.2, 0.15, 0.25, 0.25, 0.1)],
  ['medic_cook', 'Медик-кок', 'Мораль', 'cha', 'canteen', 8, S(5, 5, 5, 8, 12, 6), S(0.15, 0.15, 0.15, 0.25, 0.4, 0.2)],
].map(([id, name_ru, role, key_stat, synergy_building, weight, class_mult, base, growth]) => ({
  id, name_ru, role, key_stat, synergy_building, weight, class_mult, base, growth,
}));
// fix class_mult: I put weight in class_mult slot by mistake in the tuple. Reconstruct properly.
const classRows = [
  ['loader', 'Грузчица', 'Тоннаж', 'str', 'dock', 1, 20],
  ['forklift', 'Оператор погрузчика', 'Скорость', 'spd', 'dock', 1.05, 15],
  ['crane', 'Крановщица', 'Тяжёлые грузы', 'acc', 'dock', 1.15, 12],
  ['stocker', 'Кладовщица', 'Склад', 'acc', 'warehouse', 0.9, 14],
  ['dispatcher', 'Диспетчер', 'Бригада', 'cha', 'dispatch', 0.7, 12],
  ['mechanic', 'Механик', 'Ремонт', 'end', 'workshop', 0.75, 10],
  ['guard', 'Охрана', 'Защита', 'str', 'security', 0.85, 9],
  ['medic_cook', 'Медик-кок', 'Мораль', 'cha', 'canteen', 0.65, 8],
];
const bases = {
  loader: [S(12, 6, 5, 8, 4, 4), S(0.4, 0.2, 0.15, 0.25, 0.1, 0.1)],
  forklift: [S(6, 12, 8, 6, 4, 5), S(0.15, 0.4, 0.2, 0.15, 0.1, 0.15)],
  crane: [S(7, 5, 12, 7, 4, 5), S(0.2, 0.15, 0.4, 0.2, 0.1, 0.15)],
  stocker: [S(6, 5, 11, 8, 5, 5), S(0.15, 0.15, 0.35, 0.25, 0.15, 0.15)],
  dispatcher: [S(4, 5, 6, 6, 12, 6), S(0.1, 0.15, 0.15, 0.15, 0.4, 0.2)],
  mechanic: [S(7, 5, 8, 12, 4, 5), S(0.2, 0.15, 0.25, 0.4, 0.1, 0.15)],
  guard: [S(11, 6, 5, 8, 8, 4), S(0.35, 0.2, 0.15, 0.25, 0.25, 0.1)],
  medic_cook: [S(5, 5, 5, 8, 12, 6), S(0.15, 0.15, 0.15, 0.25, 0.4, 0.2)],
};
const classesFixed = classRows.map(([id, name_ru, role, key_stat, synergy_building, class_mult, weight]) => ({
  id, name_ru, role, key_stat, synergy_building, class_mult, weight, base: bases[id][0], growth: bases[id][1],
}));

const T = (id, name_ru, sign, tier, kind, effects, conflicts, tags, weight, min_rarity) => ({
  id, name_ru, sign, tier, kind, effects, conflicts, tags, weight, min_rarity,
});
const traits = [
  T('iron_back', 'Стальная спина', '+', 1, 'skill', [{ type: 'mult', stat: 'str', value: 1.1 }], [], ['work'], 10, 'common'),
  T('quick_hands', 'Быстрые руки', '+', 1, 'skill', [{ type: 'mult', stat: 'spd', value: 1.1 }], [], ['work'], 10, 'common'),
  T('eagle_eye', 'Орлиный глаз', '+', 1, 'skill', [{ type: 'mult', stat: 'acc', value: 1.1 }], [], ['work'], 10, 'common'),
  T('thrifty', 'Хозяйственная', '+', 1, 'character', [{ type: 'cost_mult', value: -0.1 }], [], ['money'], 8, 'common'),
  T('iron_stomach', 'Железный желудок', '+', 1, 'quirk', [{ type: 'flag', key: 'poison_immune', value: 1 }], [], ['food'], 6, 'common'),
  T('night_owl', 'Сова', '+', 1, 'quirk', [{ type: 'mult', stat: 'output', value: 1.15, cond: 'night' }], ['dark_fear'], ['night'], 8, 'common'),
  T('team_player', 'Командная', '+', 2, 'character', [{ type: 'output_add', value: 0.05, cond: 'crew_gte_3' }], [], ['work'], 8, 'uncommon'),
  T('lucky', 'Везучая', '+', 2, 'character', [{ type: 'mult', stat: 'lck', value: 1.1 }], [], ['luck'], 8, 'uncommon'),
  T('big_heart', 'Душа компании', '+', 2, 'character', [{ type: 'morale', value: 8 }], [], ['social'], 8, 'uncommon'),
  T('caffeinated', 'Кофеиновая', '+', 2, 'quirk', [{ type: 'output_add', value: 0.2, cond: 'shift_start' }], [], ['food'], 6, 'uncommon'),
  T('mentor', 'Наставница', '+', 2, 'skill', [{ type: 'xp_mult', value: 0.2 }], [], ['social'], 6, 'uncommon'),
  T('perfectionist', 'Перфекционистка', '+', 2, 'skill', [{ type: 'loss_mult', value: -0.2 }], [], ['work'], 6, 'uncommon'),
  T('workaholic', 'Трудоголичка', '+', 3, 'skill', [{ type: 'mult', stat: 'output', value: 1.25, cond: 'stamina_gt_50' }], ['procrastinator'], ['work'], 5, 'rare'),
  T('dock_legend', 'Легенда дока', '+', 3, 'skill', [{ type: 'output_add', value: 0.15 }], [], ['work'], 4, 'rare'),
  T('union_boss', 'Профорг', '+', 3, 'character', [{ type: 'contract_mult', value: 0.1 }], [], ['social'], 4, 'rare'),
  T('golden_hands', 'Золотые руки', '+', 3, 'skill', [{ type: 'tonnage_mult', value: 0.25 }], [], ['work'], 4, 'rare'),
  T('sleepyhead', 'Сонная', '-', 1, 'quirk', [{ type: 'mult', stat: 'spd', value: 0.9, cond: 'morning' }], [], ['night'], 10, 'common'),
  T('clumsy', 'Неуклюжая', '-', 1, 'quirk', [{ type: 'loss_mult', value: 0.05 }], [], ['work'], 10, 'common'),
  T('gossip', 'Сплетница', '-', 1, 'character', [{ type: 'morale', value: -3 }], [], ['social'], 8, 'common'),
  T('picky', 'Привередливая', '-', 1, 'character', [{ type: 'flag', key: 'refuses_danger', value: 1 }], [], ['work'], 6, 'common'),
  T('shopaholic', 'Шопоголичка', '-', 1, 'character', [{ type: 'cost_mult', value: 0.1 }], [], ['money'], 8, 'common'),
  T('procrastinator', 'Прокрастинаторша', '-', 2, 'character', [{ type: 'output_add', value: -0.2, cond: 'shift_start' }], ['workaholic'], ['work'], 6, 'uncommon'),
  T('hothead', 'Вспыльчивая', '-', 2, 'character', [{ type: 'event_mod', value: 0.1 }], [], ['social'], 6, 'uncommon'),
  T('bad_knees', 'Больные колени', '-', 2, 'quirk', [{ type: 'mult', stat: 'end', value: 0.75 }], [], ['body'], 6, 'uncommon'),
  T('dark_fear', 'Боится темноты', '-', 2, 'quirk', [{ type: 'mult', stat: 'output', value: 0.7, cond: 'night' }], ['night_owl'], ['night'], 6, 'uncommon'),
  T('gambler', 'Азартная', '-', 3, 'character', [{ type: 'mult', stat: 'lck', value: 1.1 }, { type: 'contract_mult', value: -0.05 }], [], ['luck'], 4, 'rare'),
  T('mob_debtor', 'Должница мафии', '-', 3, 'character', [{ type: 'contract_mult', value: -0.05 }], [], ['money'], 3, 'rare'),
  T('saboteur', 'Саботажница', '-', 3, 'quirk', [{ type: 'event_mod', value: 0.03 }], [], ['work'], 2, 'epic'),
];

const B = (id, name_ru, tag, base_cost, effects, extra = {}) => ({ id, name_ru, tag, base_cost, effects, ...extra });
const buildings = [
  B('dock', 'Погрузочный док', 'logistics', 100, [{ type: 'tonnage_mult', value: 0.1 }], { shift_slots: { base: 1, per_levels: 2 } }),
  B('dispatch', 'Диспетчерская', 'office', 250, [{ type: 'crew_mult', value: 0.02 }], { contract_slots: { base: 1, extra_at: [3, 6, 9] } }),
  B('dorm', 'Общежитие', 'comfort', 400, [{ type: 'stamina_regen', value: 0.05 }], { crew_slots: { at_1: 2, extra_at: [3, 6, 9] } }),
  B('warehouse', 'Склад', 'logistics', 500, [{ type: 'loss_mult', value: -0.03 }]),
  B('canteen', 'Кантина', 'comfort', 600, [{ type: 'morale', value: 3 }, { type: 'stamina_regen', value: 0.04 }]),
  B('workshop', 'Мастерская', 'production', 800, [{ type: 'loss_mult', value: -0.05 }]),
  B('gym', 'Тренажёрный зал', 'social', 900, [{ type: 'xp_mult', value: 0.06 }]),
  B('medbay', 'Медблок', 'comfort', 1000, [{ type: 'stamina_regen', value: 0.08 }]),
  B('hr_office', 'HR-офис', 'office', 1200, [{ type: 'roll_cost_mult', value: -0.02 }]),
  B('security', 'Охранный пост', 'security', 1500, [{ type: 'theft_mult', value: -0.08 }]),
  B('comms', 'Радиорубка', 'office', 2000, [{ type: 'contract_mult', value: 0.04 }]),
  B('greenhouse', 'Оранжерея', 'production', 2500, [{ type: 'passive_credits', value: 1 }], { passive_credits: 20 }),
  B('bar', 'Бар «Тупик»', 'social', 3000, [{ type: 'event_mod', value: 0.05 }]),
  B('reactor', 'Реактор', 'production', 5000, [{ type: 'global_mult', value: 0.05 }]),
];

const card = (id, name_ru, rarity, tags, effects, extra = {}) => ({
  id, name_ru, rarity, tags, effects, curse: extra.curse ?? null, max_stacks: extra.max_stacks ?? { common: 3, rare: 2, epic: 1, legendary: 1 }[rarity],
  weight: extra.weight ?? 10, min_expansion_index: extra.min ?? 0, requires: extra.requires ?? [], persist: extra.persist ?? false,
});
const cards = [
  card('rusty_oil', 'Ржавая смазка', 'common', ['production'], [{ type: 'tag_mult', tag: 'production', value: 0.08 }]),
  card('extra_rack', 'Лишний стеллаж', 'common', ['logistics'], [{ type: 'tag_mult', tag: 'logistics', value: 0.15 }]),
  card('coffee_machine', 'Кофемат', 'common', ['comfort'], [{ type: 'stamina_regen', value: 0.1 }]),
  card('foreman_discount', 'Скидка от прораба', 'common', ['any'], [{ type: 'cost_mult', value: -0.15 }]),
  card('lunch_vouchers', 'Талоны на обед', 'common', ['comfort'], [{ type: 'morale', value: 5 }]),
  card('spare_lantern', 'Запасной фонарь', 'common', ['logistics'], [{ type: 'loss_mult', value: -0.1, cond: 'night' }]),
  card('notice_board', 'Доска объявлений', 'common', ['office'], [{ type: 'slot_add', key: 'contract_board', value: 1 }]),
  card('intern_kit', 'Стажёрский набор', 'common', ['social'], [{ type: 'xp_mult', value: 0.1 }]),
  card('scooter_cart', 'Тележка-самокат', 'common', ['logistics'], [{ type: 'stat_mult', stat: 'spd', value: 0.03 }]),
  card('seals', 'Пломбы', 'common', ['security'], [{ type: 'theft_mult', value: -0.1 }]),
  card('warm_floor', 'Тёплый пол', 'common', ['comfort'], [{ type: 'tag_mult', tag: 'comfort', value: 0.08 }]),
  card('supplier_list', 'Список поставщиков', 'common', ['office'], [{ type: 'contract_mult', value: 0.05 }]),
  card('vending', 'Автомат со снеками', 'common', ['production'], [{ type: 'passive_credits', value: 50 }]),
  card('night_lamp', 'Ночные лампы', 'common', ['logistics'], [{ type: 'output_add', value: 0.08, cond: 'night' }]),
  card('feng_shui', 'Фэн-шуй по-грузчицки', 'rare', ['any'], [{ type: 'adjacency_bonus', value: 0.05 }], { min: 3 }),
  card('love_overtime', 'Сверхурочные по любви', 'rare', ['logistics'], [{ type: 'output_add', value: 0.2 }], { curse: [{ type: 'morale', value: -5 }] }),
  card('crew_contract', 'Бригадный подряд', 'rare', ['social'], [{ type: 'crew_mult', value: 0.12 }]),
  card('xray_gate', 'Рентген на въезде', 'rare', ['security'], [{ type: 'theft_mult', value: -0.25 }]),
  card('comm_channels', 'Каналы связи', 'rare', ['office'], [{ type: 'contract_mult', value: 0.12 }]),
  card('basement_gym', 'Тренажёрка в подвале', 'rare', ['social'], [{ type: 'xp_mult', value: 0.2 }], { curse: [{ type: 'stat_mult', stat: 'end', value: -0.05 }] }),
  card('collector', 'Коллекционер', 'rare', ['gacha'], [{ type: 'gacha_mod', key: 'dup_stars', value: 0.25 }]),
  card('happy_hour', 'Счастливый час', 'rare', ['comfort'], [{ type: 'tag_mult', tag: 'comfort', value: 0.25 }]),
  card('spare_parts', 'Склад запчастей', 'rare', ['production'], [{ type: 'loss_mult', value: -0.3 }]),
  card('night_union', 'Ночной профсоюз', 'rare', ['social'], [{ type: 'output_add', value: 0.25, cond: 'night' }]),
  card('hr_tricks', 'Кадровые уловки', 'rare', ['gacha'], [{ type: 'gacha_mod', value: -0.08 }]),
  card('spec_cargo', 'Спецгрузы', 'rare', ['logistics'], [{ type: 'contract_mult', value: 0.15 }]),
  card('overstock', 'Затоваривание', 'rare', ['logistics'], [{ type: 'tag_mult', tag: 'logistics', value: 0.4 }], { curse: [{ type: 'loss_mult', value: 0.05 }] }),
  card('inspector_friend', 'Знакомый инспектор', 'rare', ['office'], [{ type: 'cost_mult', value: -0.5, target: 'fine' }]),
  card('goldberg', 'Конвейер Голдберга', 'epic', ['production'], [{ type: 'timed_burst', value: 2 }]),
  card('corp_culture', 'Корпоративная культура', 'epic', ['social'], [{ type: 'crew_mult', value: 0.01 }]),
  card('black_cash', 'Чёрная касса', 'epic', ['office'], [{ type: 'contract_mult', value: 0.3 }], { curse: [{ type: 'event_mod', value: 1 }] }),
  card('locker_lottery', 'Лотерея в раздевалке', 'epic', ['gacha'], [{ type: 'grant', key: 'free_roll', amount: 1 }]),
  card('race_union', 'Союз рас', 'epic', ['social'], [{ type: 'output_add', value: 0.04 }]),
  card('deep_shaft', 'Глубокая шахта', 'epic', ['any'], [{ type: 'cost_mult', target: 'expand', value: -0.2 }]),
  card('reactor_overclock', 'Разгон реактора', 'epic', ['production'], [{ type: 'tag_mult', tag: 'production', value: 0.5 }], { curse: [{ type: 'event_mod', value: 0.05 }] }),
  card('safe_hands', 'Надёжные руки', 'epic', ['security'], [{ type: 'tag_mult', tag: 'security', value: 0.15 }]),
  card('vip_clients', 'VIP-клиенты', 'epic', ['office'], [{ type: 'contract_mult', value: 0.4 }]),
  card('golden_parachute', 'Золотой парашют', 'legendary', ['any'], [{ type: 'grant', key: 'credits', amount: 1 }]),
  card('red_button', 'Красная кнопка', 'legendary', ['logistics'], [{ type: 'timed_burst', value: 3 }]),
  card('pension_fund', 'Пенсионный фонд', 'legendary', ['meta'], [{ type: 'meta_mod', key: 'legacy', value: 0.25 }], { persist: true }),
  card('omnicon_leak', 'Утечка из «Омникона»', 'legendary', ['meta'], [{ type: 'meta_mod', key: 'choices', value: 5 }], { persist: true }),
  card('second_wind', 'Второе дыхание', 'legendary', ['comfort'], [{ type: 'stamina_regen', value: 0.3 }]),
];

const base = (id, name_ru, rarity, risk, buffs, debuffs, start, flavor, extra = {}) => ({
  id, name_ru, rarity, risk, layout_type: extra.layout ?? 'shaft', start_buildings: start, buffs, debuffs,
  flavor_ru: flavor, min_rebirth: extra.min ?? 1, weight: extra.weight ?? 10, floors: extra.floors, cell_cap: extra.cell_cap,
});
const st = (type, level) => ({ type, level });
const basesCards = [
  base('rusty_hangar', 'Ржавый ангар «Как есть»', 'common', 'low', [{ type: 'tonnage_mult', value: 0.1 }], [{ type: 'slot_add', key: 'crew', value: -1 }], [st('dock', 2)], 'Док есть, коек нет.'),
  base('smuggler_warehouse', 'Склад контрабандиста', 'common', 'medium', [{ type: 'tag_mult', tag: 'logistics', value: 1 }], [{ type: 'event_mod', value: 0.05 }], [st('warehouse', 2)], 'Места много, гости сами приходят.'),
  base('old_office', 'Бывший офис корпорации', 'common', 'low', [{ type: 'tag_mult', tag: 'office', value: 0.2 }], [{ type: 'tonnage_mult', value: -0.1 }], [st('dispatch', 3)], 'Таблицы на месте, док хромает.'),
  base('abandoned_greenhouse', 'Заброшенная оранжерея', 'common', 'low', [{ type: 'passive_credits', value: 30 }], [{ type: 'tag_mult', tag: 'logistics', value: -0.15 }], [st('greenhouse', 3)], 'Паёк растёт сам.'),
  base('hostel', 'Хостел «Три койки»', 'common', 'low', [{ type: 'slot_add', key: 'crew', value: 4 }], [{ type: 'cost_mult', value: 0.3, target: 'workshop' }], [st('dorm', 2)], 'Спать есть где.'),
  base('scrapyard', 'Планета-свалка', 'common', 'medium', [{ type: 'event_mod', value: 0.1 }], [{ type: 'flag', key: 'no_medbay', value: 1 }], [st('workshop', 1)], 'Медблока нет.'),
  base('caravan', 'Караван-база', 'common', 'low', [{ type: 'cost_mult', target: 'expand', value: -0.3 }], [], [st('dock', 1)], 'Не больше восьми мест.', { cell_cap: 8 }),
  base('orbit_station', 'Станция «Сквозняк»', 'common', 'medium', [{ type: 'tag_mult', tag: 'logistics', value: 0.25 }], [{ type: 'tag_mult', tag: 'comfort', value: -0.15 }], [st('dock', 1)], 'Дует, зато груз идёт.'),
  base('ice_outpost', 'Ледяной аванпост', 'common', 'medium', [{ type: 'loss_mult', value: -1 }], [{ type: 'tag_mult', tag: 'comfort', value: -0.2 }], [st('warehouse', 1)], 'Груз не портится.'),
  base('gym_basement', 'Подвал спортзала', 'common', 'low', [{ type: 'xp_mult', value: 0.15 }], [{ type: 'tag_mult', tag: 'logistics', value: -0.1 }], [st('gym', 3)], 'Качаются быстрее, чем грузят.'),
  base('old_market', 'Старый рынок', 'common', 'medium', [{ type: 'contract_mult', value: 0.1 }], [{ type: 'theft_mult', value: 0.1 }], [st('comms', 1)], 'Цены хорошие, карманы дырявые.'),
  base('tourist_trap', 'Туристическая ловушка', 'common', 'low', [{ type: 'event_mod', value: 0.15 }], [{ type: 'tag_mult', tag: 'production', value: -0.1 }], [st('bar', 2)], 'Гости шумят.'),
  base('ghost_factory', 'Фабрика-призрак', 'rare', 'medium', [{ type: 'tag_mult', tag: 'production', value: 0.3 }], [{ type: 'tag_mult', tag: 'comfort', value: -0.2 }], [st('workshop', 2), st('reactor', 1)], 'Станки ещё помнят смену.'),
  base('bunker', 'Подземный бункер', 'rare', 'low', [{ type: 'tag_mult', tag: 'security', value: 0.3 }], [{ type: 'cost_mult', value: 0.1 }], [st('security', 2)], 'Тихо и дорого.'),
  base('beach_resort', 'Курорт «Три пальмы»', 'rare', 'low', [{ type: 'tag_mult', tag: 'comfort', value: 0.3 }], [{ type: 'tag_mult', tag: 'production', value: -0.15 }], [st('canteen', 2), st('dorm', 1)], 'Мораль высокая, станки ржавеют.'),
  base('casino_station', 'Станция-казино «Джекпот»', 'rare', 'medium', [{ type: 'grant', key: 'free_roll', amount: 1 }, { type: 'stat_mult', stat: 'lck', value: 0.1 }], [{ type: 'contract_mult', value: -0.05 }], [st('bar', 1), st('hr_office', 1)], 'Удача любит чаевые.'),
  base('science_town', 'Научный городок', 'rare', 'low', [{ type: 'xp_mult', value: 0.15 }], [{ type: 'tag_mult', tag: 'logistics', value: -0.1 }], [st('workshop', 2), st('gym', 1)], 'Опыт капает.'),
  base('gravity_well', 'Гравитационный колодец', 'rare', 'medium', [{ type: 'stat_mult', stat: 'str', value: 0.15 }], [{ type: 'stat_mult', stat: 'end', value: -0.1 }], [st('dock', 2)], 'Ящики тяжёлые даже пустые.'),
  base('smuggler_nest', 'Гнездо контрабандистов', 'rare', 'high', [{ type: 'contract_mult', value: 0.4 }], [{ type: 'event_mod', value: 0.1 }], [st('comms', 1)], 'Серые контракты жирнее.'),
  base('union_branch', 'Филиал профсоюза', 'rare', 'low', [{ type: 'morale', value: 10 }], [{ type: 'cost_mult', value: 0.1 }], [st('dispatch', 1), st('canteen', 1)], 'Плакаты уже висят.'),
  base('military_base', 'Бывшая военная база', 'rare', 'medium', [{ type: 'tag_mult', tag: 'security', value: 0.4 }], [{ type: 'tag_mult', tag: 'comfort', value: -0.15 }], [st('security', 3)], 'КПП на месте.'),
  base('amusement_ruins', 'Парк аттракционов-призрак', 'rare', 'medium', [{ type: 'tag_mult', tag: 'social', value: 0.25 }], [{ type: 'tag_mult', tag: 'logistics', value: -0.1 }], [st('bar', 1), st('gym', 1)], 'Карусель скрипит.'),
  base('mall', 'Торговая площадь', 'rare', 'low', [{ type: 'contract_mult', value: 0.15 }], [{ type: 'tag_mult', tag: 'logistics', value: -0.1 }], [st('comms', 2)], 'Витрины вместо стеллажей.'),
  base('whale_port', 'Порт на космическом ките', 'rare', 'high', [{ type: 'timed_burst', value: 0.25 }], [], [st('dock', 1)], 'Каждую смену везёт по-разному.'),
  base('prison_asteroid', 'Тюремный астероид', 'epic', 'high', [{ type: 'cost_mult', value: -0.4 }], [{ type: 'morale', value: -20 }], [st('dorm', 2), st('security', 1)], 'Зарплата низкая, лица кислые.'),
  base('glass_tower', 'Стеклянная башня', 'epic', 'medium', [{ type: 'contract_mult', value: 0.03 }], [{ type: 'tag_mult', tag: 'logistics', value: -0.2 }], [st('dispatch', 4)], 'Диспетчеры любят высоту.'),
  base('co_op', 'Кооператив', 'epic', 'low', [{ type: 'crew_mult', value: 0.08 }], [{ type: 'contract_mult', value: -0.05 }], [st('dorm', 2), st('canteen', 1)], 'Все свои.'),
  base('floating_platform', 'Плавучая платформа', 'epic', 'medium', [{ type: 'output_add', value: 0.1 }], [{ type: 'output_add', value: -0.05 }], [st('dock', 2), st('medbay', 1)], 'Аквалям тут легче.'),
  base('luxury_moon', 'Лунный курорт для богатых', 'epic', 'medium', [{ type: 'contract_mult', value: 0.5 }], [], [st('bar', 2)], 'VIP платят, если бар жив.'),
  base('dead_city', 'Мёртвый город', 'epic', 'high', [{ type: 'cost_mult', value: -0.7 }], [{ type: 'grant', key: 'credits', amount: 0 }], [st('dock', 1)], 'Ремонт дешёвый, касса пустая.'),
  base('rival_base', 'База «БыстроГруза»', 'epic', 'high', [{ type: 'tonnage_mult', value: 0.2 }], [{ type: 'event_mod', value: 0.15 }], [st('dock', 3), st('warehouse', 3)], 'Чужой логотип ещё читается.'),
  base('old_ark', 'Корабль-ковчег', 'legendary', 'medium', [{ type: 'slot_add', key: 'crew', value: 2 }], [{ type: 'cost_mult', value: 0.5 }], [st('dock', 2), st('dorm', 2), st('warehouse', 2)], 'Сразу три палубы.', { floors: 3 }),
  base('golden_fund', '«Золотой фонд»', 'legendary', 'low', [{ type: 'meta_mod', key: 'legacy', value: 0.2 }], [], [st('dock', 1)], 'Пусто, зато пенсия жирнее.'),
  base('insurance_scam', 'Страховая афера', 'legendary', 'high', [{ type: 'grant', key: 'credits', amount: 20000 }], [{ type: 'contract_mult', value: -0.05 }], [st('dock', 1)], 'Долг висит на договоре.'),
  base('last_station', 'Станция на последнем издыхании', 'legendary', 'high', [{ type: 'global_mult', value: 0.6 }], [{ type: 'event_mod', value: 0.1 }], [st('reactor', 1)], 'Всё орёт и светится.'),
  base('omnicon_branch', 'Филиал «Омникона»', 'legendary', 'medium', [{ type: 'tag_mult', tag: 'office', value: 0.5 }], [{ type: 'event_mod', value: 0.1 }], [st('dispatch', 3), st('comms', 2)], 'Бланки знакомые.'),
];
for (const race of ['terran', 'felid', 'kitsune', 'astrel', 'drakei', 'synth', 'aquali', 'inferni']) {
  basesCards.push(base(`race_quarter_${race}`, `Квартал расы ${race}`, 'epic', 'medium', [{ type: 'output_add', value: 0.25 }], [{ type: 'output_add', value: -0.05 }], [st('dorm', 2)], `Свой квартал: ${race}.`));
}

const msg = (speaker, key) => ({ speaker, key });
const milestones = [
  { id: 'm01_prologue', act: 1, title_ru: 'Увольнение', trigger: { type: 'flag', key: 'act' }, messages: [0, 1, 2, 3, 4].map((n) => msg('hero', `story.m01.${n}`)), rewards: [{ type: 'grant', key: 'credits', amount: 120 }, { type: 'grant', key: 'free_roll', amount: 1 }], once: true },
  { id: 'm02_first_cargo', act: 1, title_ru: 'Первый клиент', trigger: { type: 'counter', key: 'tons_total', gte: 10 }, messages: [msg('hero', 'story.m02.0')], rewards: [{ type: 'flag', key: 'hire_open', value: 1 }], once: true },
  { id: 'm03_first_hire', act: 1, title_ru: 'Первая сотрудница', trigger: { type: 'counter', key: 'hires', gte: 1 }, messages: [msg('hero', 'story.m03.0')], rewards: [{ type: 'grant', key: 'free_roll', amount: 1 }], once: true },
  { id: 'm04_first_contract', act: 1, title_ru: 'Первая выручка', trigger: { type: 'counter', key: 'contracts_done', gte: 1 }, messages: [msg('hero', 'story.m04.0')], rewards: [{ type: 'flag', key: 'contracts_open', value: 1 }], once: true },
  { id: 'm05_dorm', act: 1, title_ru: 'Общежитие', trigger: { type: 'building_level', id: 'dorm', gte: 1 }, messages: [msg('hero', 'story.m05.0')], rewards: [{ type: 'grant', key: 'stars', amount: 20 }], once: true },
  { id: 'm06_crew5', act: 1, title_ru: 'Пять голосов', trigger: { type: 'crew_size', gte: 5 }, messages: [msg('hero', 'story.m06.0')], rewards: [{ type: 'crew_mult', value: 0.03 }], once: true },
  { id: 'm07_first_expansion', act: 2, title_ru: 'Это надолго', trigger: { type: 'counter', key: 'expansions_total', gte: 1 }, messages: [msg('hero', 'story.m07.0')], rewards: [{ type: 'card_pick', pool: 'expansion', rarity_min: 'common' }], once: true },
  { id: 'm08_first_epic', act: 2, title_ru: 'Звезда дока', trigger: { type: 'rarity_obtained', rarity: 'epic' }, messages: [msg('hero', 'story.m08.0')], rewards: [{ type: 'grant', key: 'stars', amount: 50 }], once: true },
  { id: 'm09_omnicon_letter', act: 2, title_ru: 'Письмо', trigger: { type: 'counter', key: 'tons_total', gte: 1000 }, messages: [msg('corp', 'story.m09.0')], rewards: [{ type: 'card_pick', pool: 'expansion', rarity_min: 'rare' }], once: true },
  { id: 'm10_act2', act: 2, title_ru: 'Конец ссылки', trigger: { type: 'all', of: [{ type: 'building_level', id: 'dispatch', gte: 5 }, { type: 'counter', key: 'contracts_done', gte: 4 }] }, messages: [msg('hero', 'story.m10.0')], rewards: [{ type: 'flag', key: 'act2', value: 1 }], once: true },
  { id: 'm11_rivals', act: 2, title_ru: 'Филиал напротив', trigger: { type: 'all', of: [{ type: 'flag', key: 'act2' }, { type: 'counter', key: 'shift_tons', gte: 150 }] }, messages: [msg('rival', 'story.m11.0')], rewards: [{ type: 'flag', key: 'chain_sabotage', value: 1 }], once: true },
  { id: 'm12_inspection', act: 2, title_ru: 'Проверка', trigger: { type: 'counter', key: 'events_done', gte: 15 }, messages: [msg('hero', 'story.m12.0')], rewards: [{ type: 'grant', key: 'credits', amount: 500 }], once: true },
  { id: 'm13_union', act: 2, title_ru: 'Профсоюз', trigger: { type: 'all', of: [{ type: 'crew_size', gte: 15 }, { type: 'counter', key: 'races_distinct', gte: 4 }] }, messages: [msg('hero', 'story.m13.0')], rewards: [{ type: 'crew_mult', value: 0.05 }], once: true },
  { id: 'm14_act3', act: 3, title_ru: 'А что если заново', trigger: { type: 'building_level', id: 'dispatch', gte: 10 }, messages: [msg('hero', 'story.m14.0')], rewards: [{ type: 'flag', key: 'rebirth_open', value: 1 }], once: true },
  { id: 'm15_first_rebirth', act: 3, title_ru: 'Переезд', trigger: { type: 'rebirth_count', gte: 1 }, messages: [msg('hero', 'story.m15.0')], rewards: [{ type: 'grant', key: 'stars', amount: 30 }], once: true },
  { id: 'm16_rebirth_3', act: 3, title_ru: 'Три сектора', trigger: { type: 'rebirth_count', gte: 3 }, messages: [msg('hero', 'story.m16.0')], rewards: [{ type: 'card_pick', pool: 'base', rarity_min: 'rare' }], once: true },
  { id: 'm17_legend', act: 3, title_ru: 'Корпорации заметили', trigger: { type: 'rarity_obtained', rarity: 'legendary' }, messages: [msg('hero', 'story.m17.0')], rewards: [{ type: 'grant', key: 'stars', amount: 100 }], once: true },
  { id: 'm18_buyout', act: 4, title_ru: 'Выкуп', trigger: { type: 'all', of: [{ type: 'flag', key: 'act4' }, { type: 'counter', key: 'tons_total', gte: 1000000 }] }, messages: [msg('corp', 'story.m18.0')], rewards: [], once: true },
  { id: 'm19_ending_sell', act: 4, title_ru: 'Продать', trigger: { type: 'chain_step', id: 'sell' }, messages: [msg('hero', 'story.m19.sell')], rewards: [{ type: 'flag', key: 'ng_plus', value: 1 }], once: true },
  { id: 'm19_ending_refuse', act: 4, title_ru: 'Отказать', trigger: { type: 'chain_step', id: 'refuse' }, messages: [msg('hero', 'story.m19.refuse')], rewards: [{ type: 'flag', key: 'ng_plus', value: 1 }], once: true },
  { id: 'm19_ending_buy', act: 4, title_ru: 'Купить корпорацию', trigger: { type: 'chain_step', id: 'buy' }, messages: [msg('hero', 'story.m19.buy')], rewards: [{ type: 'flag', key: 'ng_plus', value: 1 }], once: true },
  { id: 'm_meta_story', act: 1, title_ru: 'Мемуары', trigger: { type: 'flag', key: 'meta_story' }, messages: [msg('hero', 'story.meta.0')], rewards: [], once: true },
];

const locale = {
  'story.m01.0': 'Ваша должность была оптимизирована. Вместе с вами. Желаем успехов в дальнейшей жизни, которая, по расчётам HR, будет короткой и без бонусов.',
  'story.m01.1': 'Тупик-9. Население: 4 000. Из них работающих: 11. Из них трезвых: 2.',
  'story.m01.2': 'Пенсионные накопления ушли на ржавый док и вывеску. Вывеска, кстати, самая дорогая часть.',
  'story.m01.3': 'Резюме на столе одно. Зато с фотографией и хвостом.',
  'story.m01.4': 'Меня уволили из корпорации за неэффективность. Посмотрим, кто теперь неэффективен.',
  'story.m02.0': 'Первый клиент оказался пьяным курьером. Груз, впрочем, настоящий.',
  'story.m03.0': 'Бригада началась с одного резюме. Док сразу стал громче.',
  'story.m04.0': 'Первая выручка и первый налог пришли в одном конверте.',
  'story.m05.0': 'Люди должны где-то спать, а не только на ящиках.',
  'story.m06.0': 'Первая смена на пять голосов. Склад наконец спорит сам с собой.',
  'story.m07.0': 'Герой понимает, что это надолго. Стены уже не казённые.',
  'story.m08.0': 'По терминалу ходят слухи о звезде дока.',
  'story.m09.0': 'Бывший босс пишет: мы за вас рады. Формально.',
  'story.m10.0': 'На планету садится чужой борт. Вывеска напротив обещает быстрее и дешевле.',
  'story.m11.0': 'БыстроГруз открывает филиал напротив. Эдуард Лоск машет из окна.',
  'story.m12.0': 'Налоговая нашла дверь с первого раза. Это уже подозрительно.',
  'story.m13.0': 'Профсоюз требует людей, а не людей, а ещё хвостатых.',
  'story.m14.0': 'А что, если продать всё и начать заново. Мысль неприятная и поэтому рабочая.',
  'story.m15.0': 'База продана. Дорога на новую станцию пахнет тем же растворителем.',
  'story.m16.0': 'Меня уже узнают в трёх секторах. Это не комплимент, но приятно.',
  'story.m17.0': 'Корпорации заметили героя. Письма стали вежливее и опаснее.',
  'story.m18.0': 'Омникон предлагает выкуп. В бланке три клеточки и ни одной честной.',
  'story.m19.sell': 'Подпись. Печать. Титрам можно начинать.',
  'story.m19.refuse': 'Отказ ушёл тем же каналом, что и увольнение. На этот раз без бонуса.',
  'story.m19.buy': 'Выкуп корпорации занимает больше строк, чем увольнение из неё.',
  'story.meta.0': 'Мемуары находятся сами: каждый переезд помнит, кого вы не уволили.',
};

const economy = {
  version: 'v3-0.1.0',
  output_scale: 0.02,
  credits_per_ton: 8,
  start_credits: 0,
  daily_stars: 15,
  offline_hours: 8,
  offline_rate: 0.5,
  online_grace_sec: 90,
  base_crew_slots: 1,
  level_cost_growth: 1.28,
  level_cap_building: 30,
  milestone_levels: [10, 20, 30],
  expand_base: 800,
  expand_growth: 1.45,
  max_cells_per_floor: 5,
  second_copy: 0.6,
  adjacency: 0.05,
  skip_refund: 0.1,
  reroll_base: 100,
  reroll_growth: 2,
  base_reroll_stars: 40,
  rebirth_base: 500000,
  rebirth_growth: 4,
  rebirth_refund: 0.15,
  legacy_tons: 10000,
  star_stat: 0.04,
  star_cap: 5,
  xp_base: 40,
  xp_growth: 1.3,
  duplicate_stars: { common: 10, uncommon: 20, rare: 50, epic: 150, legendary: 500 },
  rarity_mult: { common: 1, uncommon: 1.15, rare: 1.35, epic: 1.65, legendary: 2 },
  level_cap: { common: 10, uncommon: 15, rare: 20, epic: 30, legendary: 40 },
  r_window: {
    common: { max: 2.49 },
    uncommon: { min: 2.5, max: 4.4 },
    rare: { min: 4.5, max: 6.4 },
    epic: { min: 6.5, max: 8.9 },
    legendary: { min: 9 },
  },
  trait_slots: {
    common: { min: 1, max: 2 },
    uncommon: { min: 2, max: 3 },
    rare: { min: 3, max: 3 },
    epic: { min: 4, max: 4 },
    legendary: { min: 4, max: 5 },
  },
  tag_sets: {
    logistics: [{ type: 'tonnage_mult', value: 0.1 }],
    production: [{ type: 'tag_mult', tag: 'production', value: 0.1 }],
    comfort: [{ type: 'morale', value: 5 }, { type: 'stamina_regen', value: 0.1 }],
    office: [{ type: 'contract_mult', value: 0.1 }],
    security: [{ type: 'theft_mult', value: -0.2 }],
    social: [{ type: 'xp_mult', value: 0.1 }],
    gacha: [{ type: 'grant', key: 'free_roll', amount: 1 }],
  },
};

const gacha = {
  version: 'v3-gacha-0.1.0',
  cost: 100,
  cost10: 900,
  weights: { common: 58, uncommon: 27, rare: 11, epic: 3.5, legendary: 0.5 },
  pity: { rare: 10, epic: 50, legendary: 100 },
  race_weight: 12.5,
  focus_mult: 3,
  focus_cost: 1.2,
  banners_enabled: false,
  new_template_weight: 4,
  card_weights: [
    { until: 3, common: 70, rare: 27, epic: 3, legendary: 0 },
    { until: 8, common: 50, rare: 38, epic: 11, legendary: 1 },
    { until: null, common: 35, rare: 40, epic: 20, legendary: 5 },
  ],
  card_guarantee_dry: 5,
  card_stacks: { common: 3, rare: 2, epic: 1, legendary: 1 },
  base_weights: [
    { until: 1, common: 60, rare: 35, epic: 5, legendary: 0 },
    { until: 3, common: 40, rare: 40, epic: 18, legendary: 2 },
    { until: null, common: 25, rare: 40, epic: 28, legendary: 7 },
  ],
};

const meta = [
  ['meta_start_credits', 'Выходное пособие', '+1 000 стартовых кредитов', 1000],
  ['meta_extra_roll', 'Связи в HR', '+1 бесплатный ролл на первом перерождении', 1],
  ['meta_card_reroll', 'Хороший нюх', '+1 бесплатный реролл карточек за базу', 1],
  ['meta_base_choice', 'Рынок недвижимости', '+5% шанс эпической базы', 0.05],
  ['meta_cheaper_expand', 'Знакомый прораб', 'Расширения −3%', 0.03],
  ['meta_offline', 'Дежурный диспетчер', 'Оффлайн-прогресс +5%', 0.05],
  ['meta_crew_slots', 'Тесные нары', '+1 резервное место', 1],
  ['meta_xp', 'Школа жизни', '+4% опыта', 0.04],
  ['meta_pity', 'Счастливая звезда', 'Гарантия редкой на ролл раньше', 1],
  ['meta_story', 'Мемуары', 'Дополнительные сюжетные реплики', 1],
].map(([id, name_ru, effect_ru, per_level]) => ({ id, name_ru, effect_ru, per_level, max_level: 5, costs: [1, 2, 3, 5, 8] }));

const contracts = [
  { id: 'first_client', name_ru: 'Пьяный курьер', seconds: 20, credits: 80, stars: 5, starter: true },
  { id: 'flour', name_ru: 'Мука без документов', seconds: 60, credits: 140, stars: 8, starter: false },
  { id: 'piano', name_ru: 'Пианино на бок', seconds: 90, credits: 220, stars: 12, starter: false },
  { id: 'fridge', name_ru: 'Холодильник вверх ногами', seconds: 75, credits: 180, stars: 10, starter: false },
  { id: 'crates', name_ru: 'Ящики с ящиками', seconds: 45, credits: 110, stars: 6, starter: false },
  { id: 'mail', name_ru: 'Почта сектора', seconds: 50, credits: 130, stars: 7, starter: false },
];

const jobs = ['loader', 'forklift', 'crane', 'stocker', 'dispatcher', 'mechanic', 'guard', 'medic_cook'];
const bios = [];
const bits = [
  '{first_name} по прозвищу {nickname} держит смену так, будто док ей должен лично.',
  'До Тупика-9 {first_name} уже увольнялась из места, где начальство путало тонны с настроением.',
  '{nickname} — так её зовут в очереди за кофе, и кран от этого не становится легче.',
  '{first_name} не спорит с накладной. Она спорит с тем, кто её написал стоя.',
  'В резюме {first_name} указала характер. Склад это уже проверил.',
];
for (const job of jobs) {
  for (let i = 0; i < 25; i++) {
    const core = bits[i % bits.length];
    const text = `${core} Класс смены ей знакомый, раса в документах не спорит с лицом. История короткая: долг, док, и привычка не ронять чужое. Заготовка ${i + 1}.`;
    bios.push({ class_id: job, tags: i % 2 ? ['work'] : ['social'], text });
  }
}
const nickA = ['Ржавая', 'Тихая', 'Гром', 'Смена', 'Пломба', 'Кран', 'Ночь', 'Касса', 'Ящик', 'Пыль', 'Искра', 'Док', 'Чай', 'Болт', 'Лента'];
const nickB = ['', ' два', ' три', ' старшая', ' младшая', ' с пирса', ' из бункера', ' без каски', ' на кофе', ' в долг'];
const nicknames = [];
for (const a of nickA) for (const b of nickB) {
  const n = `${a}${b}`.trim();
  if (n.length >= 3 && n.length <= 14) nicknames.push(n);
}
while (nicknames.length < 300) nicknames.push(`Кличка${nicknames.length}`);

const migration = {
  shard_to_star: 1,
  rarity: { N: 'common', R: 'uncommon', SR: 'rare', SSR: 'epic', UR: 'legendary' },
  archetype_class: {
    fridge_quiet: 'stocker',
    goth_packer: 'stocker',
    gymnast_rigger: 'loader',
    gym_philosopher: 'loader',
    sleepy_piano: 'medic_cook',
    retired_waitress: 'medic_cook',
    shout_commander: 'dispatcher',
    dreamy_courier: 'forklift',
    forklift_accountant: 'forklift',
    tape_maniac: 'mechanic',
  },
  default_race: 'terran',
};

dump('races.json', races);
dump('classes.json', classesFixed);
dump('traits.json', traits);
dump('buildings.json', buildings);
dump('cards_expansion.json', cards);
dump('cards_base.json', basesCards);
dump('milestones.json', milestones);
dump('economy.json', economy);
dump('gacha.json', gacha);
dump('meta.json', meta);
dump('contracts.json', contracts);
dump('bio_fallback.json', { bios, nicknames });
dump('migration.json', migration);
dump('ui.json', { tabs: [
  { id: 'terminal', name_ru: 'Терминал' },
  { id: 'crew', name_ru: 'Бригада' },
  { id: 'hire', name_ru: 'Найм' },
  { id: 'contracts', name_ru: 'Контракты' },
  { id: 'world', name_ru: 'Мир' },
  { id: 'menu', name_ru: 'Меню' },
] });
dump('story.json', {
  hero_default: 'Аркадий Выслугин',
  hero_age: 54,
  corp: 'Омникон Интегрейтед',
  planet: 'Тупик-9',
  company_default: 'ТупикЛогистик',
  rival: 'БыстроГруз',
  rival_boss: 'Эдуард Лоск',
});
dump('locale.ru.json', locale);
console.log('cards', cards.length, 'bases', basesCards.length, 'traits', traits.length, 'bios', bios.length, 'nicks', nicknames.length);
