// ============================================================
// Lockd — Formulaire d'inscription au lancement (page landing,
// avant sortie de l'app). Passe par la fonction Edge
// "join-waitlist" : la table public.waitlist n'accepte aucune
// écriture directe depuis le client (voir supabase-client.js).
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('waitlistForm');
  if (!form) return;

  const status = document.getElementById('waitlistStatus');
  const submitBtn = form.querySelector('.auth-submit');
  const defaultLabel = "M'inscrire";

  function setStatus(message, isError) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    status.classList.toggle('auth-status--error', !!isError);
    status.classList.toggle('auth-status--success', !isError);
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Un instant…' : defaultLabel;
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Le serveur met trop de temps à répondre. Réessaie.')), ms)),
    ]);
  }

  function showSuccess(name) {
    const card = form.closest('.auth-card');
    card.innerHTML = '';

    const icon = document.createElement('div');
    icon.className = 'auth-success__icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true"><path d="M4 12.5l5 5L20 7" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const h1 = document.createElement('h1');
    h1.textContent = name ? `Merci ${name} !` : 'C\'est noté !';

    const lead = document.createElement('p');
    lead.className = 'auth-card__lead';
    lead.textContent = "On te préviendra par e-mail et par SMS dès que Lockd sera disponible sur l'App Store.";

    const backBtn = document.createElement('a');
    backBtn.href = 'index.html';
    backBtn.className = 'btn btn--primary auth-submit auth-submit--active';
    backBtn.textContent = "Retour à l'accueil";

    card.append(icon, h1, lead, backBtn);
  }

  function readableError(message) {
    if (/invalide/i.test(message || '')) return 'Cette adresse e-mail ne semble pas valide.';
    if (/telephone|téléphone/i.test(message || '')) return 'Indique un numéro de téléphone.';
    if (/connu/i.test(message || '')) return 'Indique comment tu nous as connus.';
    return 'Une erreur est survenue, réessaie.';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const heardAbout = form.heardAbout.value;

    setLoading(true);
    if (status) status.hidden = true;

    try {
      const { data, error } = await withTimeout(
        supabaseClient.functions.invoke('join-waitlist', {
          body: { name, email, phone, heardAbout, source: 'hero' },
        }),
        15000
      );

      if (error || (data && data.error)) {
        setStatus(readableError(data && data.error), true);
        return;
      }

      showSuccess(name);
    } catch (err) {
      console.error('Waitlist: erreur inscription', err);
      setStatus(readableError(err && err.message), true);
    } finally {
      setLoading(false);
    }
  });
});
