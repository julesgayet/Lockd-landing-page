// ============================================================
// Lockd — Client Supabase partagé (connexion.html, creer-un-compte.html)
//
// Pointe sur le même projet Supabase ("Objectify") que l'app iOS :
// les comptes créés ou utilisés ici sont exactement les mêmes que
// dans l'app (auth.users partagé, trigger on_auth_user_created qui
// alimente public.profiles côté serveur).
//
// La clé "publishable" ci-dessous est faite pour vivre côté client
// (comme sur mobile) : elle n'autorise que ce que les policies RLS
// et les endpoints Auth permettent déjà à un utilisateur anonyme.
// ============================================================

(function () {
  var SUPABASE_URL = 'https://gdqzpjlexyvtamrtergk.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rk5RmvlmHVebGRu5I5Z_kQ_ANcbigC3';

  window.supabaseClient = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
})();
