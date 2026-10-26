// Сверка веб-калькулятора (сайт и VK Mini App) с эталонами humdes — 6 карт,
// источник: memory bodygraph_etalon_6charts приложения. Прогонять после любых
// правок js/hd-core.js, js/hd-calc.js, data/cities.json.
// node tools/check-etalons.js  (из корня сайта; код выхода 1 при расхождении)
const path = require('path');
const fs = require('fs');
const site = path.resolve(__dirname, '..');
const A = require(path.join(site, 'js/astronomy.min.js'));
require(path.join(site, 'js/hd-core.js'));
const HDCore = globalThis.HDCore;
const HDCalc = require(path.join(site, 'js/hd-calc.js'));
const cities = JSON.parse(fs.readFileSync(path.join(site, 'data/cities.json'), 'utf8'));

function city(name) {
  const c = cities.find((c) => (c.ru || '') === name);
  if (!c) throw new Error('city not found: ' + name);
  return c;
}

// Копия localToUtc из calculator.html.
function localToUtc(y, mo, d, h, mi, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  function off(ms) {
    const p = dtf.formatToParts(new Date(ms)), o = {};
    for (const x of p) o[x.type] = x.value;
    const asLocal = Date.UTC(+o.year, +o.month - 1, +o.day, (+o.hour) % 24, +o.minute, +o.second);
    return asLocal - ms;
  }
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let ms = guess - off(guess);
  ms = guess - off(ms);
  return new Date(ms);
}

const charts = [
  { name: 'Марк', d: [2013, 4, 4, 23, 20], city: 'Чайковский', type: 'manifesting-generator', profile: '6/3',
    centers: ['g', 'throat', 'sacral', 'spleen'], channels: ['1-8', '2-14', '16-48'] },
  { name: 'Максим', d: [1987, 3, 13, 1, 10], city: 'Воткинск', type: 'manifestor', profile: '6/2',
    centers: ['head', 'ajna', 'throat', 'g', 'heart', 'spleen', 'solar-plexus'], channels: ['4-63', '12-22', '25-51', '26-44', '21-45'] },
  { name: 'Алексей мл', d: [2014, 8, 10, 11, 45], city: 'Чайковский', type: 'generator', profile: '5/1',
    centers: ['ajna', 'throat', 'g', 'sacral', 'root'], channels: ['23-43', '7-31', '42-53'] },
  { name: 'Макар', d: [2006, 4, 14, 2, 20], city: 'Чайковский', type: 'projector', profile: '4/6',
    centers: ['ajna', 'throat', 'g', 'spleen', 'root'], channels: ['17-62', '7-31', '13-33', '32-54'] },
  { name: 'Алексей ст', d: [1987, 7, 27, 15, 15], city: 'Чайковский', type: 'projector', profile: '2/5',
    centers: ['ajna', 'throat', 'heart', 'spleen', 'root'], channels: ['11-56', '26-44', '18-58'] },
  { name: 'Евгения', d: [1976, 8, 21, 14, 25], city: 'Сарапул', type: 'manifesting-generator', profile: '5/1',
    centers: null, channels: ['20-34', '9-52'] },
];

const out = [];
for (const c of charts) {
  const ci = city(c.city);
  const utc = localToUtc(...c.d, ci.tz);
  const r = HDCalc.computeChart(A, HDCore, utc);
  const gates = new Set(r.activeGates);
  const chans = HDCore.CHANNELS.filter(([a, b]) => gates.has(a) && gates.has(b))
    .map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`).sort();
  const want = c.channels.map((k) => k.split('-').map(Number).sort((x, y) => x - y).join('-')).sort();
  out.push({
    name: c.name, tz: ci.tz, utc: utc.toISOString(),
    type: [r.type, c.type, r.type === c.type],
    profile: [`${r.profile.personality}/${r.profile.design}`, c.profile],
    channels: { got: chans, want, missing: want.filter((k) => !chans.includes(k)), extra: chans.filter((k) => !want.includes(k)) },
    centers: c.centers ? { got: [...r.definedCenters].sort(), want: [...c.centers].sort() } : null,
    authority: r.authority,
  });
}
let bad = 0;
for (const r of out) {
  const ok = r.type[2] && r.profile[0] === r.profile[1] &&
    !r.channels.missing.length && !r.channels.extra.length &&
    (!r.centers || r.centers.got.join() === r.centers.want.join());
  if (!ok) bad++;
  console.log((ok ? 'OK  ' : 'FAIL') + ' ' + r.name + ' — ' + r.type[0] + ' ' + r.profile[0] +
    (ok ? '' : ' ' + JSON.stringify(r)));
}
process.exit(bad ? 1 : 0);
