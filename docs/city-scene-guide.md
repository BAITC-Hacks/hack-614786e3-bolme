# 3D-город: как устроено и как подключить симулятор

Гайд для агента и разработчика, который строит поверх сцены рабочий симулятор «Аким на 5 часов». Состояние на 23 сентября 2026.

**Коротко.** Готова визуальная основа: Астана 1:1 из OpenStreetMap в браузере, главный экран «карта сверху», маркеры-«круги на воде» и кинематографичные 3D-пролёты. Игровой логики нет: расчёта Score, плана из пяти мер, AI и голоса. Их добавляешь ты. Вся связь со сценой идёт через один zustand-стор `src/city/store.ts`.

## Запуск

```bash
npm install
npm run dev                 # http://localhost:3000
open "http://localhost:3000/?debug"   # FPS, draw calls, window.__akim, пикер координат
npm run typecheck && npm run lint
```

Next.js 16 (App Router, Turbopack), React 19, three r186, @react-three/fiber 9, drei 10, postprocessing, camera-controls 3, zustand 5. Next 16 отличается от старых версий: перед правками маршрутов и конфигурации читай `node_modules/next/dist/docs/`.

## Что уже есть на экране

| Режим (`mode`) | Что это | Клавиша |
| --- | --- | --- |
| `map` | Главный экран: камера строго сверху, север вверху, видны все 5 районов | `M`, `Esc` |
| `orbit` | Объёмный 3D-вид: вращение, сдвиг, зум к курсору | `3` |
| `drone` | Свободный полёт: WASD, E/Space выше, Q/C ниже, зажатая ЛКМ смотрит | `F` |
| `tour` | Автоматический облёт ориентиров с подписями | `T` |

- **«Круги на воде» (hotspots).** Расходящиеся кольца в зоне события. Клик по кольцу или подписи запускает пролёт в 3D над этой зоной и подсвечивает район. Сейчас в каждом районе стоит демо-событие из датасета кейса: `src/city/demoHotspots.ts`.
- **Районы.** Реальные границы OSM (admin_level=6) для Есиль, Алматы, Сарыарка, Байконур, Нура. На карте они нарисованы пунктиром, здания района можно подсветить.
- **Город.** 42 314 зданий на реальных местах. У 46% высота или этажность из OSM, у остальных оценка по типу и площади с флагом `EstimatedHeight`. Ещё 33 768 дорог, вода, парки, 560 тыс. деревьев с LOD, эстакада LRT и 7 ориентиров ручной работы: Байтерек, Хан Шатыр, Пирамида, Нұр Әлем, купол Акорды, Хазрет Султан, Қазақ Елі.

## Карта файлов

```text
scripts/city/            офлайн-пайплайн OSM → public/city (Node, tsx)
  fetch-osm.ts           Overpass → data/osm/*.json (в .gitignore)
  build-city.ts          сборка: здания, земля, дороги, деревья, районы, ориентиры
public/city/             готовые данные сцены (коммитятся, ~9 МБ, gzip ~5 МБ)
src/city/                данные и состояние, без three.js-рендера
  schema.ts              контракт данных (типы, коды, формат файлов)
  store.ts               ★ zustand-стор: режим камеры, фокус, события, подсветка
  geo.ts                 lat/lon ↔ координаты сцены
  demoHotspots.ts        демо-события (заменить на события симулятора)
  landmarks.ts           ориентиры (id, OSM-элементы, режим модели)
  prepare.ts             загрузка + сборка геометрии (кеш на страницу)
  geometry/*.ts          выдавливание зданий, ленты дорог, деревья
src/scene/               всё, что внутри <Canvas>
  CityCanvas.tsx         ★ корень сцены: сюда монтируется слой симулятора
  CityExperience.tsx     страница: загрузка, хоткеи, Canvas + HUD
  camera/CameraRig.tsx   режимы камеры и перелёты
  camera/poses.ts        ракурсы: обзор, ориентир, событие, район, точка
  world/*.tsx            земля, здания, деревья, ориентиры, небо и свет
  markers/*.tsx          «круги на воде», границы районов
  labels/*               проекция DOM-подписей из мира на экран
src/ui/                  DOM-интерфейс поверх Canvas (HUD, подписи)
```

## Координаты

Сцена задана в метрах: **+x на восток, +z на юг, +y вверх**, начало в Байтереке (`manifest.origin`). Земля лежит на `y = 0`.

```ts
import { lonLatToScene, sceneToLonLat } from "@/city/geo";
const manifest = useCityStore.getState().manifest!;
const { x, z } = lonLatToScene(manifest, 51.0911, 71.4186); // точка по координатам с openstreetmap.org
```

В `?debug` можно зажать **Alt/Option и кликнуть по карте**: в консоль выведутся `{ x, z, lat, lon }`, а результат запишется в `window.__akim.lastPick`. Так удобно выбирать площадки для поликлиники, школы или парка.

Центры районов (по массе застройки) лежат в `manifest.districts[i].center` как `[x, z]`, `id` совпадают с районами кейса: `esil`, `almaty`, `saryarka`, `baikonur`, `nura`.

## API сцены: стор `useCityStore`

Читай в компонентах через селекторы, вызывай вне React через `useCityStore.getState()`.

| Поле / действие | Назначение |
| --- | --- |
| `status`, `manifest` | `ready` после загрузки; `manifest` содержит районы, ориентиры, границы и счётчики |
| `mode`, `setMode(mode)` | `map` / `orbit` / `drone` / `tour` |
| `hotspots`, `setHotspots(list)` | события на карте, **главная точка интеграции** |
| `selectHotspot(id)` | пролёт к событию и подсветка его района (то же, что клик по кругу) |
| `focusDistrict(id)` | пролёт к району и подсветка его зданий |
| `focusPoint(x, z, { distance?, title? })` | пролёт к любой точке, например к площадке будущей поликлиники |
| `focusLandmark(id)` | пролёт к ориентиру (`LandmarkId` в `landmarks.ts`) |
| `backToMap()` | вернуться на главный экран в прежний ракурс карты |
| `focus`, `highlightedDistrict` | текущий фокус и индекс подсвеченного района (`-1` = нет) |
| `hoveredHotspotId`, `caption` | наведение и кинематографичная подпись |

Тип события:

```ts
type Hotspot = {
  id: string;
  title: string;         // «Нура»
  caption: string;       // «Медпомощь 35 · школы 38 — ниже 40»
  x: number; z: number;  // центр зоны, метры сцены
  radius: number;        // радиус зоны, метры (900–1000 для района)
  tone: "critical" | "warning" | "info" | "positive"; // цвет колец
  districtId?: string;   // какой район подсветить при выборе
};
```

### Пример: события из расчёта симулятора

```ts
// после каждого пересчёта движка
const { manifest, setHotspots } = useCityStore.getState();
setHotspots(
  result.criticalPairs.map(({ district, indicator, value }) => {
    const d = manifest!.districts.find((x) => x.id === district)!;
    return {
      id: `${district}:${indicator}`,
      title: d.name,
      caption: `${indicatorLabel(indicator)} ${value.toFixed(1)} — ниже 40`,
      x: d.center[0], z: d.center[1], radius: 950,
      tone: "critical",
      districtId: district,
    };
  }),
);
```

Демо-события выставляются в `CityExperience.tsx` через `setHotspots(demoHotspots(...))`. Замени этот вызов на свои события или вызови `setHotspots` позже, стор перезапишет список.

## Как добавить 3D-объекты инициатив

Создай свой слой, например `src/sim/scene/SimLayer.tsx`, и подключи его **одной строкой** в `src/scene/CityCanvas.tsx` на месте комментария. Так твои объекты не пересекутся с моими правками визуала.

```tsx
"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { MeshStandardMaterial } from "three";

/** Полупрозрачное «здание-призрак» предложенной инициативы. */
export function GhostBuilding({ x, z, width = 60, depth = 40, height = 18, rotation = 0 }: {
  x: number; z: number; width?: number; depth?: number; height?: number; rotation?: number;
}) {
  const material = useMemo(
    () => new MeshStandardMaterial({ color: "#2dd4bf", emissive: "#0f766e", emissiveIntensity: 0.5, transparent: true, opacity: 0.45, depthWrite: false }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.opacity = 0.35 + 0.15 * Math.sin(clock.elapsedTime * 2.5);
  });
  return (
    <mesh position={[x, height / 2, z]} rotation-y={rotation} material={material} renderOrder={50}>
      <boxGeometry args={[width, height, depth]} />
    </mesh>
  );
}
```

После подтверждения меры замени призрак на непрозрачный объект: `MeshStandardMaterial` белого цвета `#f3f4f6`, `castShadow`, `receiveShadow`, тот же стиль, что у города. Для списка мер M1–M14 с предложенной реакцией карты смотри таблицу в `docs/planning/city-simulator-concept.md`.

Правила, чтобы не сломать сцену:

- **Земля рисуется слоями без depth-теста** в фиксированном порядке `renderOrder`, так нет мерцания на любом зуме. Плоскую метку на земле (полосу автобуса, зону) делай мешем с `depthTest: false` и `renderOrder` между `-60` и `-40` (см. `LAYER_ORDER` в `src/scene/palette.ts`). Объёмные объекты делай обычными мешами с `y ≥ 0`.
- **Объекты создавай в `useMemo`** и освобождай в `useEffect` cleanup. Не создавай `new Material()` и `new Geometry()` на каждый рендер.
- **Анимацию делай в `useFrame`** через мутацию объектов. Правило `react-hooks/immutability` для `src/scene/**` уже отключено в `eslint.config.mjs`. Если заводишь `src/sim/scene`, добавь туда такое же исключение.
- **Клики по 3D-объектам** обрабатывай через `onClick` / `onPointerOver` на меше. Raycast проверяет только меши с обработчиками, поэтому здания города его не тормозят.
- **DOM-подписи к точкам мира** делай через `bindLabel(id, element, x, y, z)` из `src/scene/labels/anchors.ts`: проектор сам двигает элемент каждый кадр. Пример в `src/ui/labels/MapLabels.tsx`. drei `<Html>` не используй: в dev он даёт ошибки React про вложенные корни.
- **Интерфейс** (бюджет, пять слотов плана, карточки мер, голосовой бар) делай DOM-компонентами в `src/ui/`, без привязки к Canvas. Контейнер `.hud` пропускает клики на карту (`pointer-events: none`), интерактивные дети получают `pointer-events: auto`.
- **Хоткеи** `M`, `3`, `F`, `T`, `Esc`, WASD, Q/E, Z/X и Shift заняты камерой (`CityExperience.tsx`, `CameraRig.tsx`). Ввод в `input` и `textarea` игнорируется.

## Данные зданий для механик

- `public/city/buildings.json`: по индексу здания лежат `id` (OSM way id, у relation отрицательный), `height`, `minHeight` (дм), `kind` (`BuildingKind`: жилые, школы, больницы…), `flags` (`EstimatedHeight`, `Part`, `LandmarkBase`) и `district` (индекс района или `255`).
- Геометрия разбита на чанки 1200 м. В `mesh.userData.buildingIds` и `BuildingChunk.triangleStart` (`src/city/geometry/buildings.ts`) хранится соответствие треугольника и здания для будущего выбора здания кликом.
- Подсветка района уже реализована в шейдере зданий через `highlightedDistrict`.

## Пересборка данных OSM

```bash
npm run city:fetch   # ~2 мин, Overpass; сырые файлы → data/osm/ (не коммитятся)
npm run city:build   # ~2 с → public/city/*.json, trees.bin, manifest.json
```

Охват сцены `SCENE_BBOX` и id районов задаются в `scripts/city/config.ts`. Текущая выгрузка сделана 23.09.2026 10:10 UTC, bbox 51.055–51.23 N, 71.32–71.57 E, примерно 19.5 × 17.5 км. Атрибуция `© OpenStreetMap contributors, ODbL` обязательна и уже показана в интерфейсе, не убирай её.

## Производительность

Замерено в headed Chromium через gstack browse, окно 1440×783, DPR ≈ 1.4. Это не замер на целевом ноутбуке:

| Вид | FPS | Draw calls | Треугольники |
| --- | ---: | ---: | ---: |
| Карта сверху, весь город | ~38 | ~690 | ~3.0 M |
| 3D у Байтерека | ~45 | ~180 | ~2.5 M |

Добавляй объекты экономно: повторяющееся делай через `InstancedMesh`, статичное объединяй.

## Что ещё в работе (визуал, не трогай эти файлы без синхронизации)

Визуал дорабатывается параллельно в `src/scene/world/*`, `src/scene/fx/*`, `src/scene/palette.ts`, `src/scene/markers/*` и `src/scene/camera/*`. Уже сделано: тени от солнца, дороги с минимальной экранной шириной на карте, затухание дальних колец в 3D. Твоя зона: `src/sim/`, `src/domain/`, `src/ui/`, `src/app/api/` и одна строка подключения слоя в `CityCanvas.tsx`. Правки `src/city/store.ts` согласуй: это общий контракт.
