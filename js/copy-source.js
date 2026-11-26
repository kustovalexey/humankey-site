/* HumanKey: при копировании заметного куска текста добавляем ссылку на
   источник. Читать не мешает; поля ввода (коды, почта) не трогаем. */
(function () {
  document.addEventListener('copy', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, [contenteditable]')) return;
    var sel = window.getSelection && window.getSelection();
    if (!sel) return;
    var text = sel.toString();
    if (text.replace(/\s+/g, '').length < 100) return;
    var url = location.origin + location.pathname;
    var tail = '\n\n— Источник: HumanKey, ' + url +
      '\n© HumanKey. Перепечатка — только со ссылкой на источник.';
    if (!e.clipboardData) return;
    e.clipboardData.setData('text/plain', text + tail);
    e.preventDefault();
  });
})();
