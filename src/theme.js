// Before first paint: the theme from localStorage.theme ("light" or "dark"),
// else the system setting. PatternFly's dark theme is the class
// pf-v6-theme-dark on <html>.
(function () {
  var t = null;
  try { t = localStorage.getItem('theme'); } catch (e) { /* no storage */ }
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    document.documentElement.classList.toggle('pf-v6-theme-dark', t === 'dark' || (t !== 'light' && media.matches));
  }
  apply();
  media.addEventListener('change', apply);
})();
