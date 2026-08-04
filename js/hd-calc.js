/* HumanKey — расчёт рейв-карты в браузере (этап 2, WIP).
 *
 * Эфемериды: astronomy-engine (geo, эклиптика НА ДАТУ — тропик, как swisseph).
 * Маппинг ворот: HDCore (hd-core.js). Валидировано против эталона приложения
 * (Алексей 1987-07-27 10:15 UTC → Sun 31/2, Earth 41, designSun 27/5, Earth 28,
 * профиль 2/5 — совпало 1-в-1).
 *
 * ⚠️ TODO этап 2: Северный/Южный узел — приложение использует TRUE NODE
 * (оскулирующий), его нет прямо в astronomy-engine (считать из мгновенной
 * орбиты Луны). Без узлов набор определённых центров может быть неполным.
 * Также TODO: вывод Типа/Авторитета/Стратегии из центров и каналов.
 *
 * UMD: работает в браузере (window.HDCalc) и в Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HDCalc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Планеты HD (Солнце и Земля — отдельно; узлы — TODO).
  const PLANETS = [
    'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
    'Saturn', 'Uranus', 'Neptune', 'Pluto',
  ];

  // Геоцентрическая эклиптическая долгота НА ДАТУ (градусы).
  function geoEclLon(A, body, date) {
    if (body === 'Sun') return A.SunPosition(date).elon; // видимая, на дату
    const gv = A.GeoVector(A.Body[body], date, true);       // экв. J2000, с аберрацией
    const rot = A.Rotation_EQJ_ECT(date);                   // J2000 -> эклиптика даты
    const ev = A.RotateVector(rot, gv);
    let lon = Math.atan2(ev.y, ev.x) * 180 / Math.PI;
    return (lon % 360 + 360) % 360;
  }

  // Активации всех тел на момент date -> { body: {gate,line,lon} }.
  function activationsAt(A, HDCore, date) {
    const out = {};
    const sun = geoEclLon(A, 'Sun', date);
    out.Sun = withGate(HDCore, sun);
    out.Earth = withGate(HDCore, (sun + 180) % 360);
    for (const p of PLANETS) out[p] = withGate(HDCore, geoEclLon(A, p, date));
    // TODO: North/South Node (TRUE node).
    return out;
  }

  function withGate(HDCore, lon) {
    const gl = HDCore.longitudeToGateLine(lon);
    return { gate: gl.gate, line: gl.line, lon: lon };
  }

  // Момент дизайна: Солнце на 88° дуги РАНЬШЕ рождения (~88–89 дней назад).
  function designDate(A, birth, sunLon) {
    const target = ((sunLon - 88) % 360 + 360) % 360;
    const t = A.SearchSunLongitude(target,
      new Date(birth.getTime() - 95 * 86400000), 20);
    return t ? t.date : null;
  }

  /** Полный расчёт по моменту рождения (UTC Date). */
  function computeChart(A, HDCore, birthUtc) {
    const pers = activationsAt(A, HDCore, birthUtc);
    const dDate = designDate(A, birthUtc, pers.Sun.lon);
    const des = dDate ? activationsAt(A, HDCore, dDate) : {};

    const gates = new Set();
    for (const k in pers) gates.add(pers[k].gate);
    for (const k in des) gates.add(des[k].gate);
    const defined = HDCore.definedCenters([...gates]); // Set имён центров

    return {
      personality: pers,
      design: des,
      designDate: dDate,
      profile: { personality: pers.Sun.line, design: des.Sun ? des.Sun.line : null },
      cross: {
        personalitySun: pers.Sun.gate, personalityEarth: pers.Earth.gate,
        designSun: des.Sun ? des.Sun.gate : null,
        designEarth: des.Earth ? des.Earth.gate : null,
      },
      activeGates: [...gates].sort((a, b) => a - b),
      definedCenters: [...defined],
      // TODO: type, authority, strategy — производные от центров/каналов.
    };
  }

  return { computeChart, activationsAt, designDate, geoEclLon };
});
