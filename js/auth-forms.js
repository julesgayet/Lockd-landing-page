// ============================================================
// Lockd — Formulaires de connexion / création de compte
// Utilise le même projet Supabase que l'app (voir supabase-client.js).
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
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

  // Évite qu'un bouton reste bloqué sur "Un instant…" pour toujours si
  // la requête réseau ne répond jamais (au lieu d'échouer proprement).
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Le serveur met trop de temps à répondre. Réessaie.')), ms)),
    ]);
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

    const storeBadge = document.createElement('a');
    storeBadge.href = 'https://apps.apple.com/';
    storeBadge.target = '_blank';
    storeBadge.rel = 'noopener';
    storeBadge.className = 'auth-card__store';
    storeBadge.innerHTML = '<svg viewBox="0 0 384 512" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-14.9 0-49.3-19.7-76.6-19.7C63.7 141 4 184.5 4 273.6c0 25.5 4.7 51.9 14 79.2 12.4 36.4 57.3 125.5 104.1 124 25.3-.6 43.2-18 76.2-18 32 0 48.4 18 76.6 18 47.2-.7 88.1-82 100-118.5-63.7-30-56.2-88.1-56.2-89.6zm-56.6-164.2c26.8-31.9 24.4-61 23.6-71.5-23.7 1.4-51.1 16.4-66.7 34.8-17.2 19.7-27.3 44.1-25.2 71.4 25.9 2 49.5-12.7 68.3-34.7z"/></svg> Télécharger l\'app';

    const backBtn = document.createElement('a');
    backBtn.href = 'index.html';
    backBtn.className = 'btn btn--primary auth-submit auth-submit--active';
    backBtn.textContent = "Retour à l'accueil";

    card.append(icon, h1, lead, storeBadge, backBtn);

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
    if (/signups?[ _]not allowed|signup is disabled|unable to validate email|user not found/i.test(msg)) return "Aucun compte trouvé avec cette adresse. Crée d'abord un compte.";
    return msg || 'Une erreur est survenue, réessaie.';
  }

  function redirectIfAdminElseSuccess(card, email) {
    if (email && window.ADMIN_EMAILS.includes(email)) {
      window.location.href = 'admin.html';
      return;
    }
    showSuccess(
      card,
      'Tu es connecté !',
      'Retrouve tes objectifs, ton historique et tes réglages directement dans Lockd sur ton iPhone.',
      email
    );
  }

  // ---------- Connexion (par code / lien reçu par e-mail, pas de mot de passe pour l'instant) ----------
  if (loginForm) {
    const status = document.getElementById('authStatus');
    const submitBtn = loginForm.querySelector('.auth-submit');
    const defaultLabel = 'Recevoir le code de connexion';
    const codeForm = document.getElementById('codeForm');
    const codeStatus = document.getElementById('codeStatus');
    const codeSubmitBtn = codeForm.querySelector('.auth-submit');
    let pendingEmail = '';

    // Si on revient tout juste du clic sur le lien reçu par e-mail,
    // Supabase a déjà échangé le jeton présent dans l'URL contre une
    // session au chargement de la page : on saute directement le
    // formulaire.
    let existingSession = null;
    try {
      const res = await supabaseClient.auth.getSession();
      existingSession = res.data.session;
    } catch (err) {
      console.error('Auth: erreur getSession', err);
    }

    if (existingSession && existingSession.user) {
      redirectIfAdminElseSuccess(loginForm.closest('.auth-card'), existingSession.user.email);
    } else {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.email.value.trim();

        setLoading(submitBtn, true, defaultLabel);
        if (status) status.hidden = true;

        try {
          const { error } = await withTimeout(
            supabaseClient.auth.signInWithOtp({
              email,
              options: {
                shouldCreateUser: false,
                emailRedirectTo: window.location.href.split('#')[0].split('?')[0],
              },
            }),
            15000
          );

          if (error) {
            setStatus(status, readableAuthError(error), true);
            return;
          }

          pendingEmail = email;
          loginForm.hidden = true;
          codeForm.hidden = false;
          setStatus(codeStatus, "Code envoyé à " + email + '.', false);
          codeForm.otpCode.focus();
        } catch (err) {
          console.error('Auth: erreur signInWithOtp', err);
          setStatus(status, readableAuthError(err), true);
        } finally {
          setLoading(submitBtn, false, defaultLabel);
        }
      });

      codeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = codeForm.otpCode.value.trim();

        setLoading(codeSubmitBtn, true, 'Valider le code');
        if (codeStatus) codeStatus.hidden = true;

        try {
          const { data, error } = await withTimeout(
            supabaseClient.auth.verifyOtp({
              email: pendingEmail,
              token,
              type: 'email',
            }),
            15000
          );

          if (error) {
            setStatus(codeStatus, /expired|invalid/i.test(error.message) ? 'Code invalide ou expiré, redemande-en un.' : readableAuthError(error), true);
            return;
          }

          redirectIfAdminElseSuccess(loginForm.closest('.auth-card'), data.user && data.user.email);
        } catch (err) {
          console.error('Auth: erreur verifyOtp', err);
          setStatus(codeStatus, readableAuthError(err), true);
        } finally {
          setLoading(codeSubmitBtn, false, 'Valider le code');
        }
      });
    }
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

      try {
        const { data, error } = await withTimeout(
          supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } },
          }),
          15000
        );

        if (error) {
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
      } catch (err) {
        console.error('Auth: erreur signUp', err);
        setStatus(status, readableAuthError(err), true);
      } finally {
        setLoading(submitBtn, false, 'Créer mon compte');
      }
    });
  }
});
