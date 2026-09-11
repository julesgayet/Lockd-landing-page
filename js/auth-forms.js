// ============================================================
// Lockd — Formulaires de connexion / création de compte
// Utilise le même projet Supabase que l'app (voir supabase-client.js).
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  function setStatus(el, message, isError) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.classList.toggle('auth-status--error', !!isError);
    el.classList.toggle('auth-status--success', !isError);
  }

  function setLoading(button, loading, label) {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? 'Un instant…' : label;
  }

  // Remplace le contenu de la carte par un état de succès, sans jamais
  // injecter de texte utilisateur via innerHTML (on construit les nœuds).
  function showSuccess(card, title, leadText, email) {
    card.innerHTML = '';

    const icon = document.createElement('div');
    icon.className = 'auth-success__icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true"><path d="M4 12.5l5 5L20 7" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const h1 = document.createElement('h1');
    h1.textContent = title;

    const lead = document.createElement('p');
    lead.className = 'auth-card__lead';
    lead.textContent = leadText;

    const backBtn = document.createElement('a');
    backBtn.href = 'index.html';
    backBtn.className = 'btn btn--primary auth-submit auth-submit--active';
    backBtn.textContent = "Retour à l'accueil";

    card.append(icon, h1, lead, backBtn);

    if (email) {
      const emailNote = document.createElement('p');
      emailNote.className = 'auth-note';
      emailNote.textContent = 'Compte : ' + email;
      card.appendChild(emailNote);
    }
  }

  function readableAuthError(error) {
    const msg = (error && error.message) || '';
    if (/already registered|already exists/i.test(msg)) return 'Un compte existe déjà avec cette adresse. Essaie de te connecter.';
    if (/invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
    if (/password.*(least|short|weak)/i.test(msg)) return 'Ton mot de passe doit faire au moins 6 caractères.';
    if (/email.*invalid/i.test(msg)) return 'Cette adresse e-mail ne semble pas valide.';
    if (/rate limit|too many/i.test(msg)) return 'Trop de tentatives, réessaie dans quelques minutes.';
    return msg || 'Une erreur est survenue, réessaie.';
  }

  // ---------- Connexion ----------
  if (loginForm) {
    const status = document.getElementById('authStatus');
    const submitBtn = loginForm.querySelector('.auth-submit');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      setLoading(submitBtn, true, 'Se connecter');
      if (status) status.hidden = true;

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if (error) {
        setLoading(submitBtn, false, 'Se connecter');
        setStatus(status, readableAuthError(error), true);
        return;
      }

      showSuccess(
        loginForm.closest('.auth-card'),
        'Tu es connecté !',
        'Retrouve tes objectifs, ton historique et tes réglages directement dans Lockd sur ton iPhone.',
        data.user && data.user.email
      );
    });
  }

  // ---------- Création de compte ----------
  if (signupForm) {
    const status = document.getElementById('authStatus');
    const submitBtn = signupForm.querySelector('.auth-submit');

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = signupForm.name.value.trim();
      const email = signupForm.email.value.trim();
      const password = signupForm.password.value;

      setLoading(submitBtn, true, 'Créer mon compte');
      if (status) status.hidden = true;

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });

      if (error) {
        setLoading(submitBtn, false, 'Créer mon compte');
        setStatus(status, readableAuthError(error), true);
        return;
      }

      const needsConfirmation = !data.session;
      showSuccess(
        signupForm.closest('.auth-card'),
        needsConfirmation ? 'Compte créé, confirme ton e-mail' : 'Compte créé !',
        needsConfirmation
          ? "On t'a envoyé un lien de confirmation. Une fois confirmé, connecte-toi directement dans l'app Lockd sur ton iPhone avec cette même adresse."
          : "Ton compte est prêt. Connecte-toi directement dans l'app Lockd sur ton iPhone avec cette même adresse.",
        data.user && data.user.email
      );
    });
  }
});
