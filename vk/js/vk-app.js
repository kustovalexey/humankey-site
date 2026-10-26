/* HumanKey VK Mini App — интерфейс (ТЗ TZ_VK_MINI_APP 24.10, путь Б).
 *
 * Расчёт — калькулятор сайта (HDCalc/HDCore), бодиграф — HDRender (порт
 * приложения), тексты — data/content.json (из ассетов приложения). Карты
 * хранятся только в localStorage этого устройства. VK Bridge — ровно
 * VKWebAppInit, без авторизации.
 */
(function () {
  'use strict';

  var A = window.Astronomy, HDCore = window.HDCore, HDCalc = window.HDCalc, HDRender = window.HDRender;
  var STORE_KEY = 'hk_vk_charts';
  var RUSTORE = 'https://www.rustore.ru/catalog/app/tech.humankey.app' +
    '?utm_source=vk&utm_medium=miniapp&utm_campaign=rustore_download';
  var DEFINITION_RU = {
    none: 'Нет определённости', single: 'Одиночная определённость',
    split: 'Двойная определённость', triple: 'Тройная определённость',
    quadruple: 'Четверная определённость',
  };
  var CENTER_ORDER = ['head', 'ajna', 'throat', 'g', 'heart', 'solar-plexus', 'sacral', 'spleen', 'root'];

  // ── VK Bridge: обязательная инициализация внутри ВК; вне ВК — тихо. ──
  // UMD-сборка кладёт объект в vkBridge.default. Сбой моста не должен ронять
  // приложение: без ВК (сайт, превью) оно работает так же.
  try {
    var bridge = window.vkBridge && (window.vkBridge.default || window.vkBridge);
    if (bridge && typeof bridge.send === 'function') {
      bridge.send('VKWebAppInit').catch(function () {});
    }
  } catch (e) { /* вне ВК — тихо */ }

  var content = null, bodygraphRaw = null, cities = [];
  var ready = Promise.all([
    fetch('data/content.json').then(function (r) { return r.json(); }).then(function (d) { content = d; }),
    fetch('data/bodygraph.svg').then(function (r) { return r.text(); }).then(function (t) { bodygraphRaw = t; }),
  ]);
  fetch('../data/cities.json').then(function (r) { return r.json(); })
    .then(function (d) { cities = d; })
    .catch(function () { $('cityHint').textContent = 'Не удалось загрузить список городов.'; });

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** Тексты приложения: абзацы через пустую строку, **жирный**. */
  function prose(t) {
    return t.split(/\n\s*\n/).map(function (p) {
      return '<p>' + esc(p.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  // ── Хранилище (только это устройство) ──
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; }
  }
  function saveAll(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* приватный режим */ }
  }

  // ── Город: автокомплит по базе сайта ──
  var chosen = null;
  var input = $('cityInput'), list = $('cityList');
  input.addEventListener('input', function () {
    chosen = null;
    var q = input.value.trim().toLowerCase();
    if (q.length < 2 || !cities.length) { list.hidden = true; return; }
    var res = [];
    for (var i = 0; i < cities.length && res.length < 8; i++) {
      var c = cities[i];
      if ((c.ru || '').toLowerCase().indexOf(q) === 0 || (c.en || '').toLowerCase().indexOf(q) === 0) res.push(c);
    }
    list.innerHTML = res.map(function (c, i) {
      return '<div data-i="' + i + '">' + esc((c.ru || c.en) + (c.region ? ', ' + c.region : '') + ' · ' + (c.country || '')) + '</div>';
    }).join('');
    list._res = res;
    list.hidden = res.length === 0;
  });
  list.addEventListener('click', function (e) {
    var el = e.target.closest('div[data-i]'); if (!el) return;
    chosen = list._res[+el.dataset.i];
    input.value = chosen.ru || chosen.en;
    list.hidden = true;
  });

  // Местное время + IANA-пояс → UTC (исторический DST через Intl; как на сайте).
  function localToUtc(y, mo, d, h, mi, tz) {
    var dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    function off(ms) {
      var p = dtf.formatToParts(new Date(ms)), o = {};
      for (var i = 0; i < p.length; i++) o[p[i].type] = p[i].value;
      return Date.UTC(+o.year, +o.month - 1, +o.day, (+o.hour) % 24, +o.minute, +o.second) - ms;
    }
    var guess = Date.UTC(y, mo - 1, d, h, mi);
    var ms = guess - off(guess);
    ms = guess - off(ms);
    return new Date(ms);
  }

  $('calcForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!chosen) { $('cityHint').textContent = 'Выберите город из списка — он нужен для часового пояса.'; input.focus(); return; }
    var f = e.target;
    var dp = f.date.value.split('-'), tp = f.time.value.split(':');
    var rec = {
      id: String(Date.now()),
      name: f.name.value.trim(),
      date: f.date.value, time: f.time.value,
      city: chosen.ru || chosen.en, tz: chosen.tz,
      utc: localToUtc(+dp[0], +dp[1], +dp[2], +tp[0], +tp[1], chosen.tz).toISOString(),
    };
    var all = loadSaved();
    all.unshift(rec);
    saveAll(all.slice(0, 50));
    show(rec);
  });

  function renderSaved() {
    var all = loadSaved();
    $('saved').hidden = all.length === 0;
    $('savedList').innerHTML = all.map(function (r) {
      var d = r.date.split('-').reverse().join('.');
      return '<li><button class="open" data-id="' + esc(r.id) + '">' + esc(r.name || 'Без имени') +
        '<small>' + esc(d + ', ' + r.time + ' · ' + r.city) + '</small></button>' +
        '<button class="del" data-del="' + esc(r.id) + '" aria-label="Удалить">×</button></li>';
    }).join('');
  }
  $('savedList').addEventListener('click', function (e) {
    var open = e.target.closest('[data-id]'), del = e.target.closest('[data-del]');
    var all = loadSaved();
    if (del) {
      saveAll(all.filter(function (r) { return r.id !== del.dataset.del; }));
      renderSaved();
    } else if (open) {
      var rec = all.find(function (r) { return r.id === open.dataset.id; });
      if (rec) show(rec);
    }
  });

  $('backBtn').addEventListener('click', function () {
    $('screenResult').hidden = true;
    $('screenForm').hidden = false;
    renderSaved();
    window.scrollTo(0, 0);
  });

  // ── Результат ──
  function show(rec) {
    ready.then(function () {
      var c = HDCalc.computeChart(A, HDCore, new Date(rec.utc));
      var t = content.types[c.type];
      var pGates = new Set(), dGates = new Set();
      for (var k in c.personality) pGates.add(c.personality[k].gate);
      for (var k2 in c.design) dGates.add(c.design[k2].gate);
      var defined = new Set(c.definedCenters);
      var svg = HDRender.activateChartSvg(bodygraphRaw, pGates, dGates, defined);
      var profileKey = c.profile.personality + '/' + c.profile.design;
      var defs = HDRender.definition(HDCore, c.activeGates, c.definedCenters);
      var centersDef = CENTER_ORDER.filter(function (x) { return defined.has(x); }).map(function (x) { return content.centers[x]; });
      var centersOpen = CENTER_ORDER.filter(function (x) { return !defined.has(x); }).map(function (x) { return content.centers[x]; });

      function fact(label, value) {
        return '<div class="fact"><span>' + label + '</span><strong>' + esc(value) + '</strong></div>';
      }

      $('result').innerHTML =
        '<div class="card">' +
          (rec.name ? '<div class="res-name">' + esc(rec.name) + '</div>' : '') +
          '<h1 class="res-type">' + esc(t.title) + '</h1>' +
          '<div class="res-pop">' + esc(t.population || '') + '</div>' +
          '<div class="facts">' +
            fact('Стратегия', t.strategy || c.strategyRu) +
            fact('Авторитет', content.authorities[c.authority] || c.authorityRu) +
            fact('Профиль', content.profiles[profileKey] || profileKey) +
            fact('Определённость', DEFINITION_RU[defs]) +
            fact('Инкарнационный крест', c.cross.personalitySun + '/' + c.cross.personalityEarth + ' · ' +
              c.cross.designSun + '/' + c.cross.designEarth) +
          '</div>' +
        '</div>' +
        '<div class="card bodygraph">' + svg.replace(/^<\?xml[^>]*>\s*/, '') + '</div>' +
        '<div class="card centers">' +
          '<p><span>Определённые центры</span>' + esc(centersDef.join(', ') || '—') + '</p>' +
          '<p><span>Открытые центры</span>' + esc(centersOpen.join(', ') || '—') + '</p>' +
        '</div>' +
        '<div class="card text"><h2>Легенда карты</h2>' + prose(content.legend) + '</div>' +
        '<div class="card text"><h2>Твой тип</h2>' + prose(t.you) + '</div>' +
        // ТЗ 24.10: демо-воронка — платного здесь нет и не будет; за большим —
        // в полное приложение. Формулировка — по CTA калькулятора сайта.
        '<div class="card cta">' +
          '<h2>Хочешь больше — скачай полное приложение HumanKey</h2>' +
          '<p>Полный разбор — как принимать решения, профиль, центры, каналы и ворота ' +
          'с интерпретациями, крест — плюс карта дня и транзит — в приложении HumanKey.</p>' +
          '<a class="btn btn-primary" href="' + RUSTORE + '" target="_blank" rel="noopener noreferrer">Скачать в RuStore</a>' +
        '</div>';

      $('screenForm').hidden = true;
      $('screenResult').hidden = false;
      window.scrollTo(0, 0);
    });
  }

  renderSaved();
})();
