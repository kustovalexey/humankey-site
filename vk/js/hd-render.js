/* HumanKey — раскраска бодиграфа Светланы для веба (VK Mini App).
 *
 * Порт 1:1 `activateChartSvg` из приложения (lib/services/chart_rendering.dart),
 * режим рейв-карты (цвет, monochrome = null): Личность — чёрный, Дизайн —
 * красный, оба — пополам; неактивный канал — белая линия; определённый центр —
 * классическая палитра ДЧ, открытый — тонкий серый контур.
 *
 * ⚠️ Держать в синхроне с приложением — источник истины там (Dart).
 *
 * Плюс определённость (ChartAnalyzer.determineDefinition): число групп
 * связанных определённых центров.
 */
(function (global) {
  'use strict';

  const COLOR = { personality: '#000000', design: '#C0392B' };
  const CENTER_COLOR = {
    head: '#F4D03F', g: '#F4D03F', ajna: '#6AA84F',
    throat: '#9C6B3F', spleen: '#9C6B3F', 'solar-plexus': '#9C6B3F', root: '#9C6B3F',
    heart: '#C0392B', sacral: '#C0392B',
  };
  const DEFINED_OPACITY = '0.92';
  const BAND_STROKE = '3.5';
  const STRIP = /\s(style|class|fill|fill-opacity|stroke|stroke-width|stroke-opacity)="[^"]*"/g;

  function inject(tag, attrs) {
    const selfClose = tag.endsWith('/>');
    const closer = selfClose ? '/>' : '>';
    const body = tag.slice(0, tag.length - closer.length).replace(STRIP, '').trimEnd();
    return body + attrs + ' ' + closer;
  }

  /** svg — сырой bodygraph.svg; personality/design — Set номеров ворот;
   *  defined — Set ключей центров (head…root, 'solar-plexus'). */
  function activateChartSvg(svg, personality, design, defined) {
    const grad = '<defs><linearGradient id="hkBothHalf" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#C0392B"/><stop offset="0.5" stop-color="#C0392B"/>' +
      '<stop offset="0.5" stop-color="#000000"/><stop offset="1" stop-color="#000000"/>' +
      '</linearGradient></defs>';
    let r = svg.replace(/<svg[^>]*>/, (m) => m + grad);

    // Ворота: активные по статусу, неактивные — пусто (как в рейв-карте).
    for (let g = 1; g <= 64; g++) {
      const isP = personality.has(g), isD = design.has(g);
      let fill, op, stroke, style;
      if (isP && isD) {
        fill = 'url(#hkBothHalf)'; op = '1'; stroke = 'none';
        style = 'stroke:none;fill:url(#hkBothHalf);fill-opacity:1';
      } else if (isP || isD) {
        const c = isP ? COLOR.personality : COLOR.design;
        fill = c; op = '1'; stroke = c;
        style = `stroke:${c};fill:${c};fill-opacity:1`;
      } else {
        fill = 'none'; op = '0'; stroke = 'none';
        style = 'fill:none;stroke:none';
      }
      const re = new RegExp('<path\\s+id="gate-' + g + '"[\\s\\S]*?/?>');
      r = r.replace(re, (tag) => inject(tag,
        ` style="${style}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="0"`));
    }

    // Половинки каналов: цвет по СВОИМ воротам половинки; пара half-N / half-N-M
    // у «оба» — база Дизайн, суффикс Личность (две параллельные полосы).
    r = r.replace(/<path\s+id="channel-(\d+)-(\d+)-half-(\d+)(-\d+)?"[\s\S]*?\/?>/g,
      (tag, a, b, gate, suffix) => {
        const n = +gate, isP = personality.has(n), isD = design.has(n);
        let color, op;
        if (isP && isD) { color = suffix ? COLOR.personality : COLOR.design; op = '1.0'; }
        else if (isP) { color = COLOR.personality; op = '1.0'; }
        else if (isD) { color = COLOR.design; op = '1.0'; }
        else { color = '#FFFFFF'; op = '0.55'; }
        const style = `fill:${color};fill-opacity:${op};stroke:${color};` +
          `stroke-width:${BAND_STROKE};stroke-opacity:${op};stroke-linejoin:round;stroke-linecap:round`;
        return inject(tag, ` style="${style}" fill="${color}" fill-opacity="${op}"` +
          ` stroke="${color}" stroke-width="${BAND_STROKE}" stroke-opacity="${op}" stroke-linecap="round"`);
      });

    // Центры.
    for (const name of Object.keys(CENTER_COLOR)) {
      let fill, op, stroke = 'none', sw = '0', style;
      if (defined.has(name)) {
        fill = CENTER_COLOR[name]; op = DEFINED_OPACITY;
        style = `fill:${fill};fill-opacity:${op}`;
      } else {
        fill = 'none'; op = '1'; stroke = '#9CA3AF'; sw = '2';
        style = 'fill:none;stroke:#9CA3AF;stroke-width:2;stroke-opacity:0.6';
      }
      const aliases = name === 'solar-plexus' ? ['solar-plexus', 'solar'] : [name];
      for (const alias of aliases) {
        const re = new RegExp('<path\\s+id="center-' + alias + '"[\\s\\S]*?/?>');
        r = r.replace(re, (tag) => inject(tag,
          ` style="${style}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="${sw}"`));
      }
    }
    return r;
  }

  /** Определённость: 0 → 'none', 1 → 'single', 2 → 'split', 3 → 'triple', 4+ → 'quadruple'. */
  function definition(HDCore, activeGates, defined) {
    const gates = new Set(activeGates);
    const adj = {};
    for (const [a, b] of HDCore.CHANNELS) {
      if (gates.has(a) && gates.has(b)) {
        const ca = HDCore.GATE_TO_CENTER[a], cb = HDCore.GATE_TO_CENTER[b];
        (adj[ca] = adj[ca] || new Set()).add(cb);
        (adj[cb] = adj[cb] || new Set()).add(ca);
      }
    }
    const seen = new Set();
    let groups = 0;
    for (const start of defined) {
      if (seen.has(start)) continue;
      groups++;
      const stack = [start]; seen.add(start);
      while (stack.length) {
        for (const n of adj[stack.pop()] || []) if (!seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    return ['none', 'single', 'split', 'triple', 'quadruple'][Math.min(groups, 4)];
  }

  global.HDRender = { activateChartSvg, definition };
})(typeof window !== 'undefined' ? window : globalThis);
