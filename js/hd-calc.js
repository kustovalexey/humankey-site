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

  // Долгота ВОСХОДЯЩЕГО узла Луны — TRUE (оскулирующий), как в приложении.
  // Считаем из мгновенной орбиты: h = r × v (эклиптика даты) → Ω = atan2(hx,-hy).
  function trueNodeLon(A, date) {
    const dt = 1 / 1440; // 1 минута в днях
    const t0 = A.MakeTime(date);
    const rot = A.Rotation_EQJ_ECT(t0); // экв J2000 -> эклиптика даты
    const ecl = (t) => A.RotateVector(rot, A.GeoMoon(t));
    const p1 = ecl(t0.AddDays(-dt)), p2 = ecl(t0.AddDays(dt)), r = ecl(t0);
    const v = { x: (p2.x - p1.x) / (2 * dt), y: (p2.y - p1.y) / (2 * dt), z: (p2.z - p1.z) / (2 * dt) };
    const hx = r.y * v.z - r.z * v.y;
    const hy = r.z * v.x - r.x * v.z;
    let lon = Math.atan2(hx, -hy) * 180 / Math.PI;
    return (lon % 360 + 360) % 360;
  }

  // Активации всех тел на момент date -> { body: {gate,line,lon} }.
  function activationsAt(A, HDCore, date) {
    const out = {};
    const sun = geoEclLon(A, 'Sun', date);
    out.Sun = withGate(HDCore, sun);
    out.Earth = withGate(HDCore, (sun + 180) % 360);
    for (const p of PLANETS) out[p] = withGate(HDCore, geoEclLon(A, p, date));
    const node = trueNodeLon(A, date);
    out.NorthNode = withGate(HDCore, node);
    out.SouthNode = withGate(HDCore, (node + 180) % 360);
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

  const MOTORS = ['sacral', 'solar-plexus', 'heart', 'root'];
  const TYPE_RU = {
    'generator': 'Генератор', 'manifesting-generator': 'Манифестирующий Генератор',
    'manifestor': 'Манифестор', 'projector': 'Проектор', 'reflector': 'Рефлектор',
  };
  const STRATEGY_RU = {
    'generator': 'Ждать отклика', 'manifesting-generator': 'Ждать отклика, затем информировать',
    'manifestor': 'Информировать перед действием', 'projector': 'Ждать приглашения',
    'reflector': 'Ждать лунный цикл (28 дней)',
  };
  const AUTH_RU = {
    'emotional': 'Эмоциональный (Солнечное сплетение)', 'sacral': 'Сакральный',
    'splenic': 'Селезёночный', 'ego': 'Эго (Сердце)',
    'self-projected': 'Само-проецируемый (G-центр)', 'mental': 'Ментальный (звуковой)',
    'lunar': 'Лунный (Рефлектор)',
  };

  // Тип/авторитет из определённых центров и связности мотор→горло по каналам.
  function derive(HDCore, gatesSet, definedArr) {
    const defined = new Set(definedArr);
    const adj = {};
    const edge = (a, b) => { (adj[a] = adj[a] || new Set()).add(b); (adj[b] = adj[b] || new Set()).add(a); };
    for (const [g1, g2] of HDCore.CHANNELS) {
      if (gatesSet.has(g1) && gatesSet.has(g2)) {
        edge(HDCore.GATE_TO_CENTER[g1], HDCore.GATE_TO_CENTER[g2]);
      }
    }
    // Компонента связности, содержащая горло.
    const reach = new Set();
    if (defined.has('throat')) {
      const st = ['throat']; reach.add('throat');
      while (st.length) { const c = st.pop(); for (const n of (adj[c] || [])) if (!reach.has(n)) { reach.add(n); st.push(n); } }
    }
    const motorToThroat = MOTORS.some((m) => reach.has(m));

    let type;
    if (defined.size === 0) type = 'reflector';
    else if (defined.has('sacral')) type = motorToThroat ? 'manifesting-generator' : 'generator';
    else if (motorToThroat) type = 'manifestor';
    else type = 'projector';

    let authority;
    if (defined.has('solar-plexus')) authority = 'emotional';
    else if (defined.has('sacral')) authority = 'sacral';
    else if (defined.has('spleen')) authority = 'splenic';
    else if (defined.has('heart')) authority = 'ego';
    else if (defined.has('g')) authority = 'self-projected';
    else authority = type === 'reflector' ? 'lunar' : 'mental';

    return {
      type, authority, strategy: type,
      typeRu: TYPE_RU[type], authorityRu: AUTH_RU[authority], strategyRu: STRATEGY_RU[type],
    };
  }

  /** Полный расчёт по моменту рождения (UTC Date). */
  function computeChart(A, HDCore, birthUtc) {
    const pers = activationsAt(A, HDCore, birthUtc);
    const dDate = designDate(A, birthUtc, pers.Sun.lon);
    const des = dDate ? activationsAt(A, HDCore, dDate) : {};

    const gates = new Set();
    for (const k in pers) gates.add(pers[k].gate);
    for (const k in des) gates.add(des[k].gate);
    const defined = HDCore.definedCenters([...gates]);
    const d = derive(HDCore, gates, [...defined]);

    return {
      personality: pers,
      design: des,
      designDate: dDate,
      type: d.type, typeRu: d.typeRu,
      authority: d.authority, authorityRu: d.authorityRu,
      strategyRu: d.strategyRu,
      profile: { personality: pers.Sun.line, design: des.Sun ? des.Sun.line : null },
      cross: {
        personalitySun: pers.Sun.gate, personalityEarth: pers.Earth.gate,
        designSun: des.Sun ? des.Sun.gate : null,
        designEarth: des.Earth ? des.Earth.gate : null,
      },
      activeGates: [...gates].sort((a, b) => a - b),
      definedCenters: [...defined],
    };
  }

  return { computeChart, activationsAt, designDate, geoEclLon, trueNodeLon };
});
