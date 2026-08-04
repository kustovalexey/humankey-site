/* HumanKey — ядро расчёта Human Design (веб-калькулятор, фундамент).
 *
 * Портировано 1:1 из приложения (lib/services/human_design_service.dart,
 * lib/services/chart_rendering.dart). ЭТАП 1: детерминированные таблицы и
 * маппинг долгота→ворота+линия. Астрономию (положения планет, design-арку 88°,
 * узлы) и тип/авторитет добавляем следующим этапом через astronomy-engine.
 *
 * ⚠️ Держать в синхроне с приложением — источник истины там (Dart). При правках
 * gateOrder/wheelStart/gateArc сверять с human_design_service.dart.
 */
(function (global) {
  'use strict';

  // Порядок 64 ворот на колесе (Rave mandala). Ворота 41 стартуют колесо
  // в 2° Водолея (302°, тропик). Дуга ворот 5°37'30" = 5.625°, линия = дуга/6.
  const GATE_ORDER = [
    41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
    27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
    31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
    28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
  ];
  const GATE_ARC = 360 / 64;     // 5.625°
  const LINE_ARC = GATE_ARC / 6; // 56'15"
  const WHEEL_START = 302.0;     // 2° Aquarius, tropical

  /** Ecliptic longitude (deg) → { gate, line }. Портирование longitudeToGateLine. */
  function longitudeToGateLine(lonDeg) {
    let shifted = (lonDeg - WHEEL_START) % 360;
    if (shifted < 0) shifted += 360;
    const gateIndex = Math.floor(shifted / GATE_ARC) % 64;
    const within = shifted - gateIndex * GATE_ARC;
    let line = Math.floor(within / LINE_ARC) + 1;
    if (line < 1) line = 1; else if (line > 6) line = 6;
    return { gate: GATE_ORDER[gateIndex], line: line };
  }

  // Ворота каждого из 9 центров (из chart_rendering.dart hdCenterGates).
  const CENTER_GATES = {
    head: [64, 61, 63],
    ajna: [47, 24, 4, 17, 43, 11],
    throat: [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16],
    g: [7, 1, 13, 25, 10, 15, 46, 2],
    heart: [21, 40, 26, 51],
    'solar-plexus': [6, 37, 22, 36, 30, 55, 49],
    sacral: [5, 14, 29, 59, 9, 3, 42, 27, 34],
    spleen: [48, 57, 44, 50, 32, 28, 18],
    root: [53, 60, 52, 19, 39, 41, 58, 38, 54],
  };

  // gate → center (обратный индекс).
  const GATE_TO_CENTER = {};
  for (const c in CENTER_GATES) {
    for (const g of CENTER_GATES[c]) GATE_TO_CENTER[g] = c;
  }

  // 36 каналов HD (пары ворот). Канал определён, если активны ОБА его ворот.
  const CHANNELS = [
    [1, 8], [2, 14], [3, 60], [4, 63], [5, 15], [6, 59], [7, 31], [9, 52],
    [10, 20], [10, 34], [10, 57], [11, 56], [12, 22], [13, 33], [16, 48],
    [17, 62], [18, 58], [19, 49], [20, 34], [20, 57], [21, 45], [23, 43],
    [24, 61], [25, 51], [26, 44], [27, 50], [28, 38], [29, 46], [30, 41],
    [32, 54], [34, 57], [35, 36], [37, 40], [39, 55], [42, 53], [47, 64],
  ];

  /** Определённые центры из набора активных ворот. */
  function definedCenters(activeGates) {
    const set = new Set(activeGates);
    const defined = new Set();
    for (const [a, b] of CHANNELS) {
      if (set.has(a) && set.has(b)) {
        defined.add(GATE_TO_CENTER[a]);
        defined.add(GATE_TO_CENTER[b]);
      }
    }
    return defined;
  }

  global.HDCore = {
    GATE_ORDER, GATE_ARC, LINE_ARC, WHEEL_START,
    CENTER_GATES, GATE_TO_CENTER, CHANNELS,
    longitudeToGateLine, definedCenters,
  };
})(typeof window !== 'undefined' ? window : globalThis);
