/* Marbella Maintenance — Supabase connection
   Project URL and anon/publishable key are safe to expose in client-side
   code: real access control lives in the database's Row Level Security
   policies (see supabase/schema.sql), not in this key. */
(function () {
  'use strict';
  var SUPABASE_URL = 'https://mclbdjhuuwmlapwpilau.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_sS5k-xkWDioOFyrK6iwX8g_eVhJprcn';

  if (window.supabase && window.supabase.createClient) {
    window.mmSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('[mm] Supabase library failed to load');
  }
})();
