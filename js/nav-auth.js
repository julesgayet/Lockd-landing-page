// ============================================================
// Lockd — Bouton "Se déconnecter" dans la nav (index.html,
// connexion.html, creer-un-compte.html).
// Affiché seulement si une session Supabase est active ; masqué
// sinon. Utilise le même client que les autres pages d'auth
// (voir supabase-client.js).
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  if (!window.supabaseClient) return;

  const desktopBtn = document.getElementById('navLogout');
  const mobileBtn = document.getElementById('navLogoutMobile');
  if (!desktopBtn && !mobileBtn) return;

  async function refresh() {
    let session = null;
    try {
      const res = await supabaseClient.auth.getSession();
      session = res.data.session;
    } catch (err) {
      console.error('Nav: erreur getSession', err);
    }
    const loggedIn = !!(session && session.user);
    if (desktopBtn) desktopBtn.hidden = !loggedIn;
    if (mobileBtn) mobileBtn.hidden = !loggedIn;
  }

  function setLoggingOut(button) {
    if (!button) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const label = button.querySelector('.nav__logout-label');
    if (label) label.textContent = 'Déconnexion…';
  }

  let loggingOut = false;

  // Attend signOut() au maximum 1,5s : certaines versions du client
  // Supabase peuvent rester bloquées (verrou interne entre onglets,
  // requête réseau qui ne répond jamais...). Dans ce cas on abandonne
  // l'attente et on redirige quand même, plutôt que de laisser le
  // bouton coincé sur "Déconnexion…" pour toujours.
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((resolve) => setTimeout(resolve, ms)),
    ]);
  }

  async function logout() {
    if (loggingOut) return; // évite un double clic pendant le chargement
    loggingOut = true;
    setLoggingOut(desktopBtn);
    setLoggingOut(mobileBtn);
    try {
      await withTimeout(supabaseClient.auth.signOut({ scope: 'local' }), 1500);
    } catch (err) {
      console.error('Nav: erreur signOut', err);
    }
    window.location.href = 'index.html';
  }

  if (desktopBtn) desktopBtn.addEventListener('click', logout);
  if (mobileBtn) mobileBtn.addEventListener('click', logout);

  refresh();
  supabaseClient.auth.onAuthStateChange(refresh);
});
