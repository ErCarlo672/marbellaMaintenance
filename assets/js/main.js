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

      // attributes don't respond to the CSS language toggle either: tab title,
      // image alt text and aria-labels need to be swapped directly
      var titleEl = document.querySelector('title');
      if (titleEl && titleEl.dataset.en) {
        if (!titleEl.dataset.es) titleEl.dataset.es = titleEl.textContent;
        titleEl.textContent = lang === 'en' ? titleEl.dataset.en : titleEl.dataset.es;
      }
      document.querySelectorAll('[data-en-alt]').forEach(function (el) {
        if (!el.dataset.esAlt) el.dataset.esAlt = el.getAttribute('alt') || '';
        el.setAttribute('alt', lang === 'en' ? el.dataset.enAlt : el.dataset.esAlt);
      });
      document.querySelectorAll('[data-en-aria]').forEach(function (el) {
        if (!el.dataset.esAria) el.dataset.esAria = el.getAttribute('aria-label') || '';
        el.setAttribute('aria-label', lang === 'en' ? el.dataset.enAria : el.dataset.esAria);
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
     Smart forms (booking + contact): validate, insert into Supabase,
     show success panel + build a mailto fallback.
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

  var FORM_FIELD_MAP = {
    booking_requests: { date: 'preferred_date', time: 'time_slot' }
  };

  function initSmartForms() {
    document.querySelectorAll('form[data-smart-form]').forEach(function (form) {
      var table = form.getAttribute('data-smart-form');
      var successEl = form.parentElement.querySelector('[data-form-success]');
      var errorEl = form.parentElement.querySelector('[data-form-error]');
      var mailLink = form.parentElement.querySelector('[data-mail-fallback]');
      var submitBtn = form.querySelector('button[type="submit"]');

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        var raw = serializeForm(form);
        var map = FORM_FIELD_MAP[table] || {};
        var payload = {};
        Object.keys(raw).forEach(function (k) {
          var col = map[k] || k;
          var v = raw[k];
          payload[col] = v === '' ? null : v;
        });

        if (mailLink) {
          var lines = Object.keys(raw).map(function (k) {
            var v = raw[k];
            return k + ': ' + (Array.isArray(v) ? v.join(', ') : v);
          });
          var subject = encodeURIComponent('Nueva solicitud - Marbella Maintenance');
          var body = encodeURIComponent(lines.join('\n'));
          mailLink.setAttribute('href', 'mailto:info@marbellamaintenance.com?subject=' + subject + '&body=' + body);
        }

        if (errorEl) errorEl.classList.remove('is-visible');
        if (!window.mmSupabase) {
          if (errorEl) errorEl.classList.add('is-visible');
          return;
        }

        if (submitBtn) submitBtn.disabled = true;
        window.mmSupabase.from(table).insert([payload]).then(function (res) {
          if (submitBtn) submitBtn.disabled = false;
          if (res.error) {
            console.error('[mm] ' + table + ' insert failed', res.error);
            if (errorEl) errorEl.classList.add('is-visible');
            return;
          }
          form.style.display = 'none';
          if (successEl) successEl.classList.add('is-visible');
        });
      });
    });
  }

  /* ---------------------------------------------------------------------
     Client area: real Supabase auth + maintenance dashboard
  --------------------------------------------------------------------- */
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

  function translateAuthError(message, lang) {
    var known = {
      'Invalid login credentials': { es: 'Email o contraseña incorrectos.', en: 'Incorrect email or password.' },
      'User already registered': { es: 'Ya existe una cuenta con este email. Prueba a iniciar sesión.', en: 'An account with this email already exists. Try logging in.' },
      'Password should be at least 6 characters': { es: 'La contraseña debe tener al menos 6 caracteres.', en: 'Password should be at least 6 characters.' },
      'Email not confirmed': { es: 'Confirma tu email antes de iniciar sesión (revisa tu bandeja de entrada).', en: 'Please confirm your email before logging in (check your inbox).' }
    };
    return (known[message] && known[message][lang]) || message;
  }

  function initClientArea() {
    var root = document.querySelector('[data-client-area]');
    if (!root) return;
    var client = window.mmSupabase;
    if (!client) { console.error('[mm] Supabase not available'); return; }

    var authWrap = root.querySelector('.auth-wrap');
    var dash = root.querySelector('.dash');
    var pending = root.querySelector('[data-register-pending]');
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

    var current = { profile: null, email: null, records: [], messages: [] };

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

    function renderRecords() {
      if (!recordList) return;
      var L = lang();
      if (!current.records.length) {
        recordList.innerHTML =
          '<p class="msg-empty"><span class="i18n-es">Todavía no hay mantenimientos registrados. En cuanto el equipo registre tu primera visita, aparecerá aquí.</span>' +
          '<span class="i18n-en">No maintenance visits logged yet. As soon as the team records your first visit, it will show up here.</span></p>';
        return;
      }
      recordList.innerHTML = current.records.map(function (r) {
        var d = formatDate(r.visit_date, L);
        var service = L === 'en' ? r.service_en : r.service_es;
        var note = L === 'en' ? r.note_en : r.note_es;
        return '<div class="record">' +
          '<div class="date"><strong>' + d.day + '</strong><span>' + d.month + '</span></div>' +
          '<div><h4>' + service + '</h4><p>' + (note || '') + (r.technician ? ' &middot; ' + (L === 'en' ? 'Technician' : 'Técnico') + ': ' + r.technician : '') + '</p></div>' +
          '<span class="badge ' + r.status + '">' + badgeLabel(r.status, L) + '</span>' +
          '</div>';
      }).join('');
    }

    function renderProfile() {
      if (!profileGrid) return;
      var L = lang();
      var p = current.profile || {};
      var rows = [
        [{ es: 'Titular', en: 'Account holder' }, p.name || '—'],
        [{ es: 'Email', en: 'Email' }, current.email],
        [{ es: 'Propiedad', en: 'Property' }, p.address || (L === 'en' ? 'Not specified' : 'No especificada')],
        [{ es: 'Cliente desde', en: 'Client since' }, p.created_at ? new Date(p.created_at).toLocaleDateString(L === 'en' ? 'en-GB' : 'es-ES') : '—']
      ];
      profileGrid.innerHTML = rows.map(function (r) {
        return '<div class="profile-item"><span>' + r[0][L] + '</span><strong>' + r[1] + '</strong></div>';
      }).join('');
    }

    function renderMessages() {
      if (!msgList) return;
      msgList.innerHTML = current.messages.map(function (m) {
        return '<div class="msg-item">' + m.body + '<time>' + new Date(m.created_at).toLocaleString(lang() === 'en' ? 'en-GB' : 'es-ES') + '</time></div>';
      }).join('') || '<p class="msg-empty i18n-es">Aun no has enviado mensajes.</p><p class="msg-empty i18n-en">You have not sent any messages yet.</p>';
    }

    function renderAll() {
      if (welcomeName) welcomeName.textContent = (current.profile && current.profile.name) || current.email;
      renderRecords();
      renderProfile();
      renderMessages();
    }

    function showDashboard() {
      if (pending) pending.classList.remove('is-visible');
      authWrap.style.display = 'none';
      dash.classList.add('is-visible');
      renderAll();
    }

    function showAuth() {
      if (pending) pending.classList.remove('is-visible');
      authWrap.style.display = '';
      dash.classList.remove('is-visible');
    }

    function showPendingConfirmation() {
      authWrap.style.display = 'none';
      dash.classList.remove('is-visible');
      if (pending) pending.classList.add('is-visible');
    }

    async function loadDashboardData(user) {
      current.email = user.email;
      var profileRes = await client.from('profiles').select('*').eq('id', user.id).single();
      current.profile = profileRes.data || null;

      var recordsRes = await client.from('maintenance_records').select('*').eq('user_id', user.id).order('visit_date', { ascending: true });
      current.records = recordsRes.data || [];

      var msgRes = await client.from('messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      current.messages = msgRes.data || [];

      showDashboard();
    }

    async function boot() {
      var sessionRes = await client.auth.getSession();
      var session = sessionRes.data && sessionRes.data.session;
      if (session && session.user) {
        await loadDashboardData(session.user);
      } else {
        showAuth();
      }
    }

    if (registerForm) {
      registerForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        registerError.classList.remove('is-visible');
        var data = serializeForm(registerForm);
        var email = (data.email || '').trim().toLowerCase();
        if (!email || !data.password || !data.name) return;

        var submitBtn = registerForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        var res = await client.auth.signUp({
          email: email,
          password: data.password,
          options: { data: { name: data.name, address: data.address || '' } }
        });

        if (submitBtn) submitBtn.disabled = false;

        if (res.error) {
          registerError.textContent = translateAuthError(res.error.message, lang());
          registerError.classList.add('is-visible');
          return;
        }

        if (res.data.session && res.data.user) {
          await loadDashboardData(res.data.user);
        } else {
          showPendingConfirmation();
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        loginError.classList.remove('is-visible');
        var data = serializeForm(loginForm);
        var email = (data.email || '').trim().toLowerCase();

        var submitBtn = loginForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        var res = await client.auth.signInWithPassword({ email: email, password: data.password });

        if (submitBtn) submitBtn.disabled = false;

        if (res.error) {
          loginError.textContent = translateAuthError(res.error.message, lang());
          loginError.classList.add('is-visible');
          return;
        }
        await loadDashboardData(res.data.user);
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        await client.auth.signOut();
        current = { profile: null, email: null, records: [], messages: [] };
        showAuth();
      });
    }

    if (msgForm) {
      msgForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var sessionRes = await client.auth.getSession();
        var user = sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
        if (!user) return;
        var data = serializeForm(msgForm);
        if (!data.text) return;

        var res = await client.from('messages').insert([{ user_id: user.id, body: data.text }]).select();
        if (res.error) { console.error('[mm] message insert failed', res.error); return; }

        current.messages.unshift(res.data[0]);
        msgForm.reset();
        renderMessages();
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

    // re-render dashboard copy when language changes
    document.querySelectorAll('[data-lang-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (current.email) renderAll();
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
