/* Marbella Maintenance — vídeo de portada y contadores (vanilla JS, sin build) */
(function () {
  'use strict';

  function initHeroVideo() {
    var video = document.querySelector('[data-hero-video]');
    if (!video) return;
    var toggle = document.querySelector('[data-hero-toggle]');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var saveData = navigator.connection && navigator.connection.saveData;

    // con ahorro de datos se queda la imagen fija; sin animación, el vídeo espera a que lo pidan
    if (saveData) {
      toggle.hidden = true;
      return;
    }

    var small = window.innerWidth <= 860;
    var pausedByUser = reduced;
    var loaded = false;

    function setState() {
      toggle.classList.toggle('is-paused', video.paused);
      toggle.setAttribute('aria-pressed', video.paused ? 'true' : 'false');
    }

    function play() {
      if (!loaded) {
        video.src = video.getAttribute(small ? 'data-src-small' : 'data-src');
        loaded = true;
      }
      var attempt = video.play();
      if (attempt && attempt.catch) attempt.catch(setState);
    }

    video.addEventListener('play', setState);
    video.addEventListener('pause', setState);
    toggle.addEventListener('click', function () {
      pausedByUser = !video.paused;
      if (pausedByUser) video.pause();
      else play();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          if (!pausedByUser) play();
        } else if (!video.paused) {
          video.pause();
        }
      }).observe(video);
    } else if (!pausedByUser) {
      play();
    }
    setState();
  }

  function initCounters() {
    var nums = [].slice.call(document.querySelectorAll('[data-count]'));
    if (!nums.length || !('IntersectionObserver' in window)) return;

    function countUp(el) {
      var end = parseFloat(el.getAttribute('data-count'));
      var suffix = el.getAttribute('data-suffix') || '';
      var t0 = performance.now();
      (function step(t) {
        var k = Math.min(1, (t - t0) / 1600);
        k = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(end * k) + suffix;
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        countUp(en.target);
      });
    }, { threshold: 0.4 });
    nums.forEach(function (n) { io.observe(n); });
  }

  function boot() {
    initHeroVideo();
    initCounters();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
