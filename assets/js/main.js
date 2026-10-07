/* Marbella Maintenance — site engine (vanilla JS, no build step) */
(function () {
  'use strict';

  function safe(fn, name) {
    try { fn(); } catch (err) {
      console.error('[mm] init failed: ' + name, err);
    }
  }

  /* ---------------------------------------------------------------------
     Language (ES default hardcoded in markup, EN swapped via class)
  --------------------------------------------------------------------- */
  function initLang() {
    var root = document.documentElement;
    var btns = document.querySelectorAll('[data-lang-toggle]');

    function apply(lang) {
      root.classList.toggle('lang-en', lang === 'en');
      root.setAttribute('lang', lang);
      try { localStorage.setItem('mm_lang', lang); } catch (e) {}
      btns.forEach(function (b) {
        b.textContent = lang === 'en' ? 'ES' : 'EN';
        b.setAttribute('aria-label', lang === 'en' ? 'Cambiar a espanol' : 'Switch to English');
      });

      // <option> elements don't respect CSS visibility, so translate them directly
      document.querySelectorAll('option[data-en]').forEach(function (opt) {
        if (!opt.dataset.es) opt.dataset.es = opt.textContent;
        opt.textContent = lang === 'en' ? opt.dataset.en : opt.dataset.es;
      });
    }

    var stored = null;
    try { stored = localStorage.getItem('mm_lang'); } catch (e) {}
    var initial = stored || (navigator.language && navigator.language.toLowerCase().indexOf('es') === 0 ? 'es' : 'es');
    apply(initial);

    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var next = root.classList.contains('lang-en') ? 'es' : 'en';
        apply(next);
      });
    });
  }

  /* ---------------------------------------------------------------------
     Nav: sticky shadow + mobile menu
  --------------------------------------------------------------------- */
  function initNav() {
    var header = document.querySelector('.site-header');
    var toggle = document.querySelector('.menu-toggle');
    var mobileNav = document.querySelector('.mobile-nav');

    if (header) {
      var onScroll = function () {
        header.classList.toggle('is-scrolled', window.scrollY > 40);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    if (toggle && mobileNav) {
      toggle.addEventListener('click', function () {
        var isOpen = mobileNav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
        document.body.style.overflow = isOpen ? 'hidden' : '';
      });
      mobileNav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () {
          mobileNav.classList.remove('is-open');
          document.body.style.overflow = '';
        });
      });
    }

    // active link
    var path = (location.pathname.split('/').pop() || 'index.html');
    document.querySelectorAll('[data-nav-link]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === path || (path === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
  }

  /* ---------------------------------------------------------------------
     Reveal on scroll
  --------------------------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -60px 0px' });

    items.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 70 + 'ms';
      io.observe(el);
    });

    // safety net: reveal everything after 6s regardless
    setTimeout(function () {
      items.forEach(function (el) { el.classList.add('is-visible'); });
    }, 6000);
  }

  /* ---------------------------------------------------------------------
     Footer year
  --------------------------------------------------------------------- */
  function initYear() {
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* ---------------------------------------------------------------------
     Generic "fake submit" forms (booking + contact): validate, store
     locally, show success panel + build a mailto fallback.
  --------------------------------------------------------------------- */
  function serializeForm(form) {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (!data[el.name]) data[el.name] = [];
        if (el.checked) data[el.name].push(el.value);
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
      } else {
        data[el.name] = el.value;
      }
    });
    return data;
  }

  function storeSubmission(bucket, payload) {
    try {
      var raw = localStorage.getItem(bucket);
      var list = raw ? JSON.parse(raw) : [];
      payload._at = new Date().toISOString();
      list.push(payload);
      localStorage.setItem(bucket, JSON.stringify(list));
    } catch (e) {}
  }

  function initSmartForms() {
    document.querySelectorAll('form[data-smart-form]').forEach(function (form) {
      var bucket = form.getAttribute('data-smart-form');
      var successEl = form.parentElement.querySelector('[data-form-success]');
      var mailLink = form.parentElement.querySelector('[data-mail-fallback]');

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        var data = serializeForm(form);
        storeSubmission(bucket, data);

        if (mailLink) {
          var lines = Object.keys(data).map(function (k) {
            var v = data[k];
            return k + ': ' + (Array.isArray(v) ? v.join(', ') : v);
          });
          var subject = encodeURIComponent('Nueva solicitud - Marbella Maintenance');
          var body = encodeURIComponent(lines.join('\n'));
          mailLink.setAttribute('href', 'mailto:info@marbellamaintenance.com?subject=' + subject + '&body=' + body);
        }

        form.style.display = 'none';
        if (successEl) successEl.classList.add('is-visible');
      });
    });
  }

  /* ---------------------------------------------------------------------
     Client area: localStorage-backed auth demo + maintenance dashboard
  --------------------------------------------------------------------- */
  var DEMO_SERVICES = [
    { es: 'Mantenimiento de piscina', en: 'Pool maintenance' },
    { es: 'Jardineria', en: 'Garden care' },
    { es: 'Revision de comunidad', en: 'Community check-up' },
    { es: 'Reforma - pintura interior', en: 'Renovation - interior paint' },
    { es: 'Chequeo de climatizacion', en: 'HVAC check' }
  ];

  function seedRecords() {
    var today = new Date();
    function addDays(n) {
      var d = new Date(today);
      d.setDate(d.getDate() + n);
      return d.toISOString();
    }
    return [
      { date: addDays(-18), service: DEMO_SERVICES[0], status: 'ok', tech: 'Javier R.', note: { es: 'Limpieza de filtros y control de PH completado.', en: 'Filter cleaning and pH check completed.' } },
      { date: addDays(-6), service: DEMO_SERVICES[1], status: 'ok', tech: 'Equipo verde', note: { es: 'Poda e inspeccion de riego completada.', en: 'Pruning and irrigation check completed.' } },
      { date: addDays(4), service: DEMO_SERVICES[2], status: 'progress', tech: 'Ana M.', note: { es: 'Inspeccion de zonas comunes en curso.', en: 'Common-area inspection in progress.' } },
      { date: addDays(12), service: DEMO_SERVICES[3], status: 'pending', tech: 'Por asignar', note: { es: 'Presupuesto aprobado, a la espera de materiales.', en: 'Quote approved, waiting on materials.' } },
      { date: addDays(21), service: DEMO_SERVICES[4], status: 'pending', tech: 'Por asignar', note: { es: 'Revision estacional programada.', en: 'Seasonal check-up scheduled.' } }
    ];
  }

  function getUsers() {
    try { return JSON.parse(localStorage.getItem('mm_users') || '{}'); } catch (e) { return {}; }
  }
  function saveUsers(users) {
    try { localStorage.setItem('mm_users', JSON.stringify(users)); } catch (e) {}
  }
  function getSession() {
    try { return localStorage.getItem('mm_session'); } catch (e) { return null; }
  }
  function setSession(email) {
    try {
      if (email) localStorage.setItem('mm_session', email);
      else localStorage.removeItem('mm_session');
    } catch (e) {}
  }

  function formatDate(iso, lang) {
    var d = new Date(iso);
    var months_es = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    var months_en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var m = lang === 'en' ? months_en : months_es;
    return { day: d.getDate(), month: m[d.getMonth()] };
  }

  function badgeLabel(status, lang) {
    var map = {
      ok: { es: 'Completado', en: 'Completed' },
      progress: { es: 'En curso', en: 'In progress' },
      pending: { es: 'Programado', en: 'Scheduled' }
    };
    return map[status][lang];
  }

  function initClientArea() {
    var root = document.querySelector('[data-client-area]');
    if (!root) return;

    var authWrap = root.querySelector('.auth-wrap');
    var dash = root.querySelector('.dash');
    var tabLogin = root.querySelector('[data-tab="login"]');
    var tabRegister = root.querySelector('[data-tab="register"]');
    var panelLogin = root.querySelector('[data-panel="login"]');
    var panelRegister = root.querySelector('[data-panel="register"]');
    var loginForm = root.querySelector('#login-form');
    var registerForm = root.querySelector('#register-form');
    var loginError = root.querySelector('#login-error');
    var registerError = root.querySelector('#register-error');
    var logoutBtn = root.querySelector('[data-logout]');
    var welcomeName = root.querySelector('[data-welcome-name]');
    var recordList = root.querySelector('[data-record-list]');
    var profileGrid = root.querySelector('[data-profile-grid]');
    var msgList = root.querySelector('[data-msg-list]');
    var msgForm = root.querySelector('#message-form');

    function switchTab(which) {
      tabLogin.classList.toggle('active', which === 'login');
      tabRegister.classList.toggle('active', which === 'register');
      panelLogin.classList.toggle('active', which === 'login');
      panelRegister.classList.toggle('active', which === 'register');
    }
    if (tabLogin && tabRegister) {
      tabLogin.addEventListener('click', function () { switchTab('login'); });
      tabRegister.addEventListener('click', function () { switchTab('register'); });
    }

    function lang() { return document.documentElement.classList.contains('lang-en') ? 'en' : 'es'; }

    function renderRecords(user) {
      if (!recordList) return;
      if (recordList.children.length > 0 && recordList.dataset.mounted === user.email) return; // idempotent
      recordList.innerHTML = '';
      recordList.dataset.mounted = user.email;
      var L = lang();
      user.records.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).forEach(function (r) {
        var d = formatDate(r.date, L);
        var div = document.createElement('div');
        div.className = 'record';
        div.innerHTML =
          '<div class="date"><strong>' + d.day + '</strong><span>' + d.month + '</span></div>' +
          '<div><h4>' + r.service[L] + '</h4><p>' + r.note[L] + ' &middot; ' + (L === 'en' ? 'Technician' : 'Tecnico') + ': ' + r.tech + '</p></div>' +
          '<span class="badge ' + r.status + '">' + badgeLabel(r.status, L) + '</span>';
        recordList.appendChild(div);
      });
    }

    function renderProfile(user) {
      if (!profileGrid) return;
      var L = lang();
      var rows = [
        [{ es: 'Titular', en: 'Account holder' }, user.name],
        [{ es: 'Email', en: 'Email' }, user.email],
        [{ es: 'Propiedad', en: 'Property' }, user.address || (L === 'en' ? 'Not specified' : 'No especificada')],
        [{ es: 'Cliente desde', en: 'Client since' }, new Date(user.createdAt).toLocaleDateString(L === 'en' ? 'en-GB' : 'es-ES')]
      ];
      profileGrid.innerHTML = rows.map(function (r) {
        return '<div class="profile-item"><span>' + r[0][L] + '</span><strong>' + r[1] + '</strong></div>';
      }).join('');
    }

    function renderMessages(user) {
      if (!msgList) return;
      msgList.innerHTML = (user.messages || []).slice().reverse().map(function (m) {
        return '<div class="msg-item">' + m.text + '<time>' + new Date(m.at).toLocaleString(lang() === 'en' ? 'en-GB' : 'es-ES') + '</time></div>';
      }).join('') || '<p class="msg-empty i18n-es">Aun no has enviado mensajes.</p><p class="msg-empty i18n-en">You have not sent any messages yet.</p>';
    }

    function showDashboard(user) {
      authWrap.style.display = 'none';
      dash.classList.add('is-visible');
      if (welcomeName) welcomeName.textContent = user.name;
      renderRecords(user);
      renderProfile(user);
      renderMessages(user);
    }

    function showAuth() {
      authWrap.style.display = '';
      dash.classList.remove('is-visible');
    }

    function boot() {
      var email = getSession();
      var users = getUsers();
      if (email && users[email]) {
        showDashboard(users[email]);
      } else {
        showAuth();
      }
    }

    if (registerForm) {
      registerForm.addEventListener('submit', function (e) {
        e.preventDefault();
        registerError.classList.remove('is-visible');
        var data = serializeForm(registerForm);
        var users = getUsers();
        var email = (data.email || '').trim().toLowerCase();
        if (!email || !data.password || !data.name) return;
        if (users[email]) {
          registerError.textContent = lang() === 'en'
            ? 'An account with this email already exists. Try logging in.'
            : 'Ya existe una cuenta con este email. Prueba a iniciar sesion.';
          registerError.classList.add('is-visible');
          return;
        }
        users[email] = {
          name: data.name,
          email: email,
          password: data.password,
          address: data.address || '',
          createdAt: new Date().toISOString(),
          records: seedRecords(),
          messages: []
        };
        saveUsers(users);
        setSession(email);
        showDashboard(users[email]);
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        loginError.classList.remove('is-visible');
        var data = serializeForm(loginForm);
        var users = getUsers();
        var email = (data.email || '').trim().toLowerCase();
        var user = users[email];
        if (!user || user.password !== data.password) {
          loginError.textContent = lang() === 'en'
            ? 'Incorrect email or password.'
            : 'Email o contrasena incorrectos.';
          loginError.classList.add('is-visible');
          return;
        }
        setSession(email);
        showDashboard(user);
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        setSession(null);
        showAuth();
      });
    }

    if (msgForm) {
      msgForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = getSession();
        var users = getUsers();
        if (!email || !users[email]) return;
        var data = serializeForm(msgForm);
        if (!data.text) return;
        users[email].messages = users[email].messages || [];
        users[email].messages.push({ text: data.text, at: new Date().toISOString() });
        saveUsers(users);
        msgForm.reset();
        renderMessages(users[email]);
        var ack = msgForm.parentElement.querySelector('[data-msg-ack]');
        if (ack) {
          ack.classList.add('is-visible');
          setTimeout(function () { ack.classList.remove('is-visible'); }, 3200);
        }
      });
    }

    // dashboard inner tabs
    root.querySelectorAll('[data-dash-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-dash-tab');
        root.querySelectorAll('[data-dash-tab]').forEach(function (b) { b.classList.remove('active'); });
        root.querySelectorAll('[data-dash-panel]').forEach(function (p) { p.classList.remove('active'); });
        btn.classList.add('active');
        root.querySelector('[data-dash-panel="' + target + '"]').classList.add('active');
      });
    });

    boot();

    // re-render copy inside dashboard when language changes
    document.querySelectorAll('[data-lang-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var email = getSession();
        var users = getUsers();
        if (email && users[email]) {
          recordList.dataset.mounted = '';
          renderRecords(users[email]);
          renderProfile(users[email]);
          renderMessages(users[email]);
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     Boot
  --------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    safe(initLang, 'initLang');
    safe(initNav, 'initNav');
    safe(initReveal, 'initReveal');
    safe(initYear, 'initYear');
    safe(initSmartForms, 'initSmartForms');
    safe(initClientArea, 'initClientArea');
  });
})();
