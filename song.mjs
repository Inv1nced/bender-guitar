export const cover = 'https://www.youtube.com/watch?v=4pqW8o3jWDQ';
export const referenceTempo = 198;
export const strings = [
  { number: 1, label: 'e', midi: 64 },
  { number: 2, label: 'B', midi: 59 },
  { number: 3, label: 'G', midi: 55 },
  { number: 4, label: 'D', midi: 50 },
  { number: 5, label: 'A', midi: 45 },
  { number: 6, label: 'E', midi: 40 }
];

const pitch = (string, fret, finger) => ({ string, fret, finger });
const shape = (label, ...notes) => ({ label, notes });
const eHigh = shape('E5 · 7-й лад', pitch(5, 7, 1), pitch(4, 9, 3), pitch(3, 9, 4));
const eOpen = shape('E5 · открытая E', pitch(6, 0, 0), pitch(5, 2, 1), pitch(4, 2, 2));
const cHigh = shape('C♯5 · 9-й лад', pitch(6, 9, 1), pitch(5, 11, 3), pitch(4, 11, 4));
const cLow = shape('C♯5 · 4-й лад', pitch(5, 4, 1), pitch(4, 6, 3));
const a = shape('A5 · 5-й лад', pitch(6, 5, 1), pitch(5, 7, 3), pitch(4, 7, 4));
const b = shape('B5 · 7-й лад', pitch(6, 7, 1), pitch(5, 9, 3), pitch(4, 9, 4));
const g = shape('G♯5 · 4-й лад', pitch(6, 4, 1), pitch(5, 6, 3), pitch(4, 6, 4));

const hit = (position, technique = 'chord') => ({ ...position, technique });
const single = (position, technique) => hit(shape(position.label, position.notes[0]), technique);
const hold = (event) => ({ ...event, technique: 'hold' });
const repeat = (event, count) => Array(count).fill(event);
const bar = (name, events) => ({ name, events });
const phrase = (name, ...bars) => ({ name, bars });

function muted(position) {
  const accent = hit(position);
  return bar(position.label, [accent, hold(accent), ...repeat(single(position, 'pm'), 6)]);
}

function straight(position, technique = 'chord') {
  return bar(position.label, repeat(hit(position, technique), 8));
}

function bass(position) {
  return bar(position.label, repeat(single(position, 'pm'), 8));
}

function tail(position) {
  const accent = hit(position);
  return bar(position.label, [accent, ...repeat(hold(accent), 7)]);
}

function twoPasses(makeBar, first) {
  return [phrase('Круг 1', ...first.map(makeBar)), phrase('Круг 2', ...first.map(makeBar))];
}

const top = [eHigh, cHigh, a, b];
const bottom = [g, cLow, a, b];
const introEnd = phrase('Выход', ...[g, cLow, a].map(muted), tail(a));
const verseMiddle = phrase('Продолжение', muted(g), bass(cLow), bass(a), bass(b));
const verseEnd = phrase('Выход', muted(g), bass(cLow), bass(a), straight(shape('A5 · две струны', ...a.notes.slice(0, 2))));
const chorusMiddle = phrase('Продолжение', ...bottom.map((position) => straight(position)));
const cRiff = hit(shape('Рифф · 5-я, лад 4', pitch(5, 4, 1)), 'single');
const bRiff = hit(shape('Рифф · 6-я, лад 7', pitch(6, 7, 4)), 'single');
const aRiff = hit(shape('Рифф · 6-я, лад 5', pitch(6, 5, 2)), 'single');
const gRiff = hit(shape('Рифф · 6-я, лад 4', pitch(6, 4, 1)), 'single');
const openRiff = hit(shape('Рифф · открытая E', pitch(6, 0, 0)), 'single');
const hammer = hit(shape('Легато · лад 5', pitch(6, 5, 2)), 'hammer');
const pull = hit(shape('Легато · лад 4', pitch(6, 4, 1)), 'pull');

const riffStart = bar('Начало риффа', [cRiff, hold(cRiff), cRiff, hold(cRiff), bRiff, hold(bRiff), aRiff, hold(aRiff)]);
const riffEnd = bar('Легато и открытая E', [gRiff, hammer, pull, hold(pull), openRiff, hold(openRiff), hold(openRiff), hold(openRiff)]);
const dead = hit(shape('Приглушённый удар', pitch(6, null, 0), pitch(5, null, 0), pitch(4, null, 0)), 'dead');

function quarterNotes(position, mutedEnd = false) {
  const root = single(position, 'single');
  const events = repeat([root, hold(root)], mutedEnd ? 2 : 4).flat();
  return bar(position.label, mutedEnd ? [...events, ...repeat(dead, 4)] : events);
}

const aColor = shape('A · с добавленной B', pitch(6, 5, 1), pitch(5, 7, 3), pitch(4, 9, 4));
const eTwo = shape('E5 · две струны', pitch(5, 7, 1), pitch(4, 9, 3));
const dSharp = shape('D♯ + B', pitch(5, 6, 1), pitch(4, 9, 4));
const cColor = shape('C + C♯', pitch(6, 8, 1), pitch(4, 11, 4));

function quarterChords(position) {
  const accent = hit(position);
  return bar(position.label, repeat([accent, hold(accent)], 4).flat());
}

const bridgeChords = [cHigh, aColor, eTwo].flatMap((position) => repeat(quarterChords(position), 2));
const bridgeEnd = bar('D♯ + B → C + C♯', [
  ...repeat([hit(dSharp), hold(hit(dSharp))], 2).flat(),
  ...repeat([hit(cColor), hold(hit(cColor))], 2).flat()
]);

export const parts = [
  {
    title: 'Вступление', time: 0.79,
    lead: 'Один яркий акцент и короткие удары по басовой струне. Сохраняй пульс, когда переносишь руку на соседнюю струну.',
    phrases: [...twoPasses(muted, top), phrase('Продолжение', ...bottom.map(muted)), introEnd],
    steps: [
      'Поставь указательный на 5-ю струну, лад 7. Безымянный и мизинец — на 4-ю и 3-ю, лад 9. Ударь вниз по этим трём струнам вместе.',
      'Оставь указательный на месте. После акцента слегка положи ладонь на струны у бриджа и сыграй шесть коротких ударов только по 5-й струне.',
      'Для C♯5 перенеси ту же форму на комплект 6–5–4 и сдвинь указательный на лад 9. Затем перенеси форму на 5-й лад (A5) и 7-й (B5). Повтори этот круг дважды.',
      'В продолжении начинай с 6-й струны на ладу 4 (G♯5), затем перейди на 5-ю струну, лад 4 (C♯5). Во втором проходе этой связки закончи одиночным акцентом A5.'
    ],
    tip: 'Зацикли первый круг на 60–80 BPM. Сначала играй только акценты на «раз». Когда смены стали чистыми, добавь короткие удары.'
  },
  {
    title: 'Куплет 1', time: 20.19,
    lead: 'Открытая шестая струна начинает куплет. Форма C♯5 здесь перемещается на 5-ю струну, лад 4.',
    phrases: [...twoPasses(muted, [eOpen, cLow, a, b]), verseMiddle, verseEnd],
    steps: [
      'Ударь по открытой 6-й и по 5-й и 4-й на втором ладу. Для двух прижатых струн удобно взять указательный и средний.',
      'Под приглушение остаётся только открытая 6-я. На следующем «раз» перейди к C♯5 на 5-й струне, затем к A5 и B5 на шестой. Повтори круг.',
      'В продолжении начни с акцента G♯5. В тактах C♯, A и B играй по одной приглушённой ноте на каждую восьмую.',
      'В последнем такте добавь к A на шестой струне ноту на 5-й струне, лад 7. В тренажёре этот выход показан двумя струнами.'
    ],
    tip: 'Сначала выучи прыжок с открытой E на 4-й лад 5-й струны. Подведи медиатор к новой струне ещё до следующего акцента.'
  },
  {
    title: 'Припев 1', time: 39.59,
    lead: 'Вернись к позициям вступления. Подними ладонь, чтобы квинты звучали полнее, и удерживай одинаковый пульс.',
    phrases: [...twoPasses((position) => straight(position), top), chorusMiddle,
      phrase('Выход', ...[g, cLow, a].map((position) => straight(position)), tail(a))],
    steps: [
      'Сыграй два круга E5 → C♯5 → A5 → B5. Бери E5 с 7-го лада 5-й струны, как во вступлении.',
      'Держи выбранную форму до следующего такта и играй восемь ровных ударов. Для начала попробуй чередовать вниз и вверх.',
      'Затем сыграй G♯5 → C♯5 с 4-го лада 5-й струны → A5 → B5. Повтори эту связку и в конце вместо B5 задержись на A5.'
    ],
    tip: 'Медиатору достаточно пройти по двум или трём нужным струнам. Если звенит открытая струна, замедлись и уменьши размах.'
  },
  {
    title: 'Куплет 2', time: 58.98,
    lead: 'Первые два круга строятся на одной шестой струне. Это удобное место, чтобы закрепить ровные восьмые.',
    phrases: [...twoPasses(bass, [eOpen, cHigh, a, b]), verseMiddle, verseEnd],
    steps: [
      'Держи ладонь у бриджа. На 6-й струне сыграй 0 → 9 → 5 → 7, по восемь ударов на каждой позиции.',
      'Повтори ещё раз. Перед скачком с открытой струны уже подведи указательный палец к 9-му ладу.',
      'В продолжении верни акцент G♯5. Дальше сыграй одиночные C♯, A и B, как в первом куплете. В конце останься на A и добавь 5-ю струну на ладу 7.'
    ],
    tip: 'Отдельно повтори переход 9 → 5. Ослабь прижим во время переноса и прижми новый лад к моменту удара.'
  },
  {
    title: 'Припев 2', time: 78.38,
    lead: 'Начало повторяет первый припев. Отличие слышно в конце, где A занимает два такта подряд.',
    phrases: [...twoPasses((position) => straight(position), top), chorusMiddle,
      phrase('Выход в бридж', straight(g), straight(cLow), straight(a), straight(a))],
    steps: [
      'Сыграй два круга E5 → C♯5 → A5 → B5. На каждой форме восемь ударов.',
      'Потом сыграй G♯5 → C♯5 в 4-й позиции → A5 → B5. Повтори начало этой связки.',
      'Во втором проходе оставь A5 на два такта. Досчитай все 16 ударов и приготовь 5-ю струну, лад 4, для риффа бриджа.'
    ],
    tip: 'Повтори только «Выход в бридж», затем попробуй сразу сыграть первые два удара риффа.'
  },
  {
    title: 'Бридж', time: 97.77,
    videoNotes: [{ time: 117, label: 'Переход к аккордам' }, { time: 119, label: 'Аккордовая связка' }, { time: 139, label: 'Пауза и подводка к финалу' }],
    lead: 'Начни с одиночного риффа с легато. В следующем проходе заканчивай приглушёнными ударами, затем разучи аккордовую связку из табов автора.',
    phrases: [
      phrase('Рифф', riffStart, riffEnd),
      phrase('Круг 1 целиком', riffStart, riffEnd, riffStart, riffEnd, riffStart, riffEnd, quarterNotes(a), quarterNotes(b)),
      phrase('Круг 2 целиком', riffStart, riffEnd, riffStart, riffEnd, riffStart, riffEnd, quarterNotes(a), quarterNotes(b, true)),
      phrase('Аккордовая связка', ...bridgeChords, ...repeat(quarterChords(dSharp), 2)),
      phrase('Связка с выходом', ...bridgeChords, quarterChords(dSharp), bridgeEnd)
    ],
    steps: [
      'Дважды ударь по 5-й струне на ладу 4. Перейди на 6-ю и сыграй лад 7 мизинцем, потом лад 5 средним.',
      'Поставь указательный на лад 4 и ударь по струне один раз. Средним быстро ударь по ладу 5, затем сними его с лёгким зацепом струны. Получится 4–5–4 с одной атакой медиатора. После этого сыграй открытую шестую.',
      'Повтори рифф три раза, затем сыграй четыре удара на ладу 5 и четыре на ладу 7. Во втором круге сыграй на ладу 7 только первые два удара. Дальше ослабь пальцы левой руки и сделай четыре коротких «чк» по струнам 6–5–4.',
      'Отдельно разучи аккордовую связку. В форме A прижми 6-ю на ладу 5, 5-ю на ладу 7 и 4-ю на ладу 9. В последнем выходе на лады 8 и 11 приглуши 5-ю струну касанием указательного.'
    ],
    tip: 'Ритм легато и аккордовой связки здесь дан как упражнение. Переход около 1:57 и подводку перед финалом с 2:19 разбери по видео: для них в описании нет отдельных табов.'
  },
  {
    title: 'Припев 3', time: 149.56,
    lead: 'Финал начинается с G♯5. Два круга с этой позиции, затем два круга с E5.',
    phrases: [...twoPasses((position) => straight(position), bottom), phrase('Круг с E5', ...top.map((position) => straight(position))),
      phrase('Финал', ...top.slice(0, 3).map((position) => straight(position)), tail(a))],
    steps: [
      'Дважды сыграй G♯5 → C♯5 с 4-го лада 5-й струны → A5 → B5.',
      'Перейди на E5 с 7-го лада 5-й струны. Дальше идут C♯5 с 9-го лада шестой, A5 и B5.',
      'Начни с E5 ещё раз. На последней смене останься на A5 и дай финальному акценту прозвучать.'
    ],
    tip: 'Зацикли «Финал», затем выключи повтор и сыграй выход один раз с чистой остановкой.'
  }
];

export function midiFor(note) {
  return strings.find((string) => string.number === note.string).midi + note.fret;
}
