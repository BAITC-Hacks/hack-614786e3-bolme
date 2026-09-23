/**
 * Walkthrough steps. Each step spotlights the element marked with
 * `data-tour="<target>"`; a missing target shows the card centred instead.
 * To explain a new feature: mark its root with data-tour and add a step here.
 */
import { useCityStore } from "@/city/store";
import { useSimStore } from "@/sim/store";
import type { IconName } from "@/ui/icons";

export type GuideStep = {
  target: string | null;
  icon: IconName;
  title: string;
  body: string;
  /** Extra room around the target, px (e.g. include the ring above a map label). */
  grow?: { top?: number; x?: number };
  /** Runs when the step opens (switch district, go back to the map, …). */
  before?: () => void;
};

const toMap = () => {
  const city = useCityStore.getState();
  if (city.mode !== "map") city.backToMap();
};

/** Right-panel steps need the panel expanded. */
const openInfo = () => {
  toMap();
  useSimStore.getState().setInfoOpen(true);
};

export const GUIDE_STEPS: GuideStep[] = [
  {
    target: "hotspot-nura",
    icon: "alert",
    grow: { top: 150, x: 30 },
    title: "Красное кольцо — провал в районе",
    body: "Пульсирующие кольца отмечают районы. Красное — показатель упал ниже критической черты 40: в Нуре это школы (38) и медпомощь (35). Каждый такой провал отнимает балл от итогового Score. Оранжевое — слабые места без провала, молния — ЧС. Нажмите на метку, затем «Смотреть в 3D»: там можно сразу добавить в план меры, которые закрывают слабые места района.",
    before: toMap,
  },
  {
    target: "events",
    icon: "bolt",
    title: "События города",
    body: "Всё, что требует внимания: провалы показателей и ЧС, которые случатся за два года — паводок, порыв теплотрассы, смог. Нажмите на событие, и камера покажет место.",
    before: openInfo,
  },
  {
    target: "events-bell",
    icon: "bell",
    title: "Свернуть панель",
    body: "Колокольчик прячет правую панель, чтобы видеть город целиком. События продолжат прилетать в него — счётчик покажет, сколько из них ждут решения.",
    before: openInfo,
  },
  {
    target: "score",
    icon: "chart",
    title: "Astana Quality of Life Score",
    before: openInfo,
    body: "Главная цифра. Считается по формуле кейса: 0,7 × средний балл районов + 0,3 × балл самого слабого − 1 за каждый показатель ниже 40. Ваша задача — поднять её за два года.",
  },
  {
    target: "district",
    icon: "pin",
    title: "Район под микроскопом",
    body: "Десять показателей выбранного района, черта 40 и шкала недовольства жителей. Переключайте районы здесь или кликайте по ним на карте.",
    before: () => {
      openInfo();
      useSimStore.getState().setDistrict("nura");
    },
  },
  {
    target: "budget",
    icon: "wallet",
    title: "Бюджет 100 и ровно 5 решений",
    body: "Сколько потрачено, сколько осталось и сколько решений уже принято. Превысить бюджет нельзя — система просто не примет карточку. Неиспользованный остаток станет резервом на ЧС.",
  },
  {
    target: "mods",
    icon: "user",
    title: "Правила мира",
    body: "Режим и моды вы выбрали при создании мира, до конца игры они не меняются. «Аким» — последствия скрыты до подписи. «Аналитик» — живой прогноз Score, «+X к Score» на карточках и кольца на карте по прогнозу. Поменять правила — «Новая игра» после подписи.",
  },
  {
    target: "catalog",
    icon: "school",
    title: "14 мер в 5 направлениях",
    body: "Выберите район, затем меру. На карточке — цена, с какого квартала она заработает, какие показатели поднимет ↑ или опустит ↓, синергии ⚡ и конфликты ⛔. Карточку, нарушающую правила, система заблокирует и объяснит почему.",
  },
  {
    target: "presets",
    icon: "play",
    title: "Быстрый старт",
    body: "Загрузите пример из кейса или «Ловушку M11», чтобы за секунду увидеть, как работает расчёт.",
  },
  {
    target: "promises",
    icon: "chat",
    title: "Ваши обещания",
    body: "Три обещания, которые вы дали жителям, висят над планом — подбирайте меры так, чтобы их сдержать. В режиме «Аналитик» ✓/✗ показывает, выполняются ли они по прогнозу. Нарушенное обещание разозлит район.",
  },
  {
    target: "sign",
    icon: "check",
    title: "Подпишите бюджет",
    body: "Когда выбраны 5 решений, подпишите план — и город проживёт два года. До подписи последствия скрыты, как у настоящего акима.",
  },
  {
    target: null,
    icon: "sparkle",
    title: "Что будет после подписи",
    body: "Кинематографичный облёт «Прошло 2 года» по районам, которые изменились сильнее всего. Затем «Итоговый анализ»: ваш ранг акима, Score и место среди 694 395 допустимых планов, AI-выводы о рисках и компромиссах, сравнение с оптимумом и реакция жителей в соцсетях. Кольца на карте покажут балл районов «до → после».",
  },
  {
    target: "views",
    icon: "play",
    title: "Смотрите город по-разному",
    body: "Карта — вид сверху. 3D — объёмный вид. Полёт — свободная камера на WASD. Облёт — кинематографичный тур по Астане. Esc всегда возвращает к карте.",
  },
  {
    target: "help",
    icon: "help",
    title: "Обучение всегда под рукой",
    body: "Нажмите «?», чтобы пройти его снова. Удачи, аким!",
  },
];
