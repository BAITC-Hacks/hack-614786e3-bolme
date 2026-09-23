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

export const GUIDE_STEPS: GuideStep[] = [
  {
    target: "hotspot-nura",
    icon: "alert",
    grow: { top: 150, x: 30 },
    title: "Красное кольцо — провал в районе",
    body: "Пульсирующие кольца отмечают районы. Красное — показатель упал ниже критической черты 40: в Нуре это школы (38) и медпомощь (35). Каждый такой провал отнимает балл от итогового Score. Оранжевое — слабые места без провала. Клик по метке — пролёт к району в 3D.",
    before: toMap,
  },
  {
    target: "events",
    icon: "bolt",
    title: "События города",
    body: "Всё, что требует внимания: провалы показателей и ЧС, которые случатся за два года — паводок, порыв теплотрассы, смог. Нажмите на событие, и камера покажет место.",
    before: toMap,
  },
  {
    target: "score",
    icon: "chart",
    title: "Astana Quality of Life Score",
    body: "Главная цифра. Считается по формуле кейса: 0,7 × средний балл районов + 0,3 × балл самого слабого − 1 за каждый показатель ниже 40. Ваша задача — поднять её за два года.",
  },
  {
    target: "district",
    icon: "pin",
    title: "Район под микроскопом",
    body: "Десять показателей выбранного района, черта 40 и шкала недовольства жителей. Переключайте районы здесь или кликайте по ним на карте.",
    before: () => useSimStore.getState().setDistrict("nura"),
  },
  {
    target: "budget",
    icon: "wallet",
    title: "Бюджет 100 и ровно 5 решений",
    body: "Сколько потрачено, сколько осталось и сколько решений уже принято. Превысить бюджет нельзя — система просто не примет карточку. Неиспользованный остаток станет резервом на ЧС.",
  },
  {
    target: "mode",
    icon: "user",
    title: "Аким или Аналитик",
    body: "«Аким» — последствия скрыты до подписи бюджета, как в жизни. «Аналитик» — видны величины эффектов и живой прогноз Score.",
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
    target: "mods",
    icon: "flame",
    title: "Моды города",
    body: "ЧС, шкала недовольства и публичные обещания делают два года живыми. Официальный Score они не меняют — у них свой, отдельно подписанный результат.",
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
