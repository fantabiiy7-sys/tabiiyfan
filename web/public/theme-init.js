// Sahifa chizilishidan oldin tema o'rnatiladi (yonib ketishning oldini olish). CSP: script-src 'self' — alohida fayl.
(function () {
  try {
    var t = localStorage.getItem('tf.theme');
    if (t !== 'light' && t !== 'dark') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    var l = localStorage.getItem('tf.lang'); if (l === 'uz' || l === 'ru' || l === 'en') document.documentElement.setAttribute('lang', l);
  } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
})();
