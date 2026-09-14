// ============================================================
// Lockd — Onglet "Statistiques" du dashboard admin (admin.html)
//
// Regroupe les réponses à "Comment nous as-tu connus ?" des deux
// points d'entrée : public.waitlist (landing page, avant le
// lancement — colonne heard_about) et public.onboarding_answers
// (à l'inscription dans l'app — colonne acquisition_source).
// Lecture via les policies RLS admin_select_waitlist /
// admin_select_onboarding_answers (migration
// admin_select_acquisition_stats).
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  let loaded = false;

  document.addEventListener('admin-tab-shown', (e) => {
    if (e.detail.tabId === 'tabStats' && !loaded) {
      loaded = true;
      init().catch((err) => {
        console.error('Onglet statistiques : erreur inattendue', err);
      });
    }
  });

  // Les codes de la landing page sont figés côté fonction Edge
  // join-waitlist (HEARD_ABOUT_VALUES) ; les réponses de l'app sont du
  // texte libre saisi côté onboarding. On regroupe en normalisant en
  // minuscule, avec un libellé soigné pour les valeurs connues et une
  // simple capitalisation sinon.
  const KNOWN_LABELS = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    amis: 'Amis',
    autre: 'Autre',
    facebook: 'Facebook',
    youtube: 'YouTube',
    'app store': 'App Store',
    google: 'Google',
  };

  function labelFor(key, raw) {
    return KNOWN_LABELS[key] || (raw.charAt(0).toUpperCase() + raw.slice(1));
  }

  function aggregate(rows, field) {
    const counts = new Map();
    (rows || []).forEach((row) => {
      const raw = (row[field] || '').toString().trim();
      const key = raw.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { key, raw, count: 1 });
      }
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }

  function renderBars(list, entries, total) {
    list.innerHTML = '';
    if (!entries.length) {
      list.innerHTML = '<li class="admin-feed__empty">Aucune réponse pour l\'instant.</li>';
      return;
    }
    const max = entries[0].count;
    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'admin-stats-bar';

      const head = document.createElement('div');
      head.className = 'admin-stats-bar__head';

      const label = document.createElement('span');
      label.className = 'admin-stats-bar__label';
      label.textContent = entry.key ? labelFor(entry.key, entry.raw) : 'Non renseigné';

      const value = document.createElement('span');
      value.className = 'admin-stats-bar__value';
      const pct = total ? Math.round((entry.count / total) * 100) : 0;
      value.textContent = entry.count + ' · ' + pct + '%';

      head.append(label, value);

      const track = document.createElement('div');
      track.className = 'admin-stats-bar__track';
      const fill = document.createElement('div');
      fill.className = 'admin-stats-bar__fill';
      fill.style.width = (max ? (entry.count / max) * 100 : 0) + '%';
      track.appendChild(fill);

      li.append(head, track);
      list.appendChild(li);
    });
  }

  function setTotal(el, count) {
    el.textContent = count ? count + (count > 1 ? ' réponses' : ' réponse') : '';
  }

  async function init() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const email = session && session.user && session.user.email;
    if (!session || !email || !window.ADMIN_EMAILS || !window.ADMIN_EMAILS.includes(email)) {
      // admin-dashboard.js s'occupe déjà de la redirection ; on s'arrête simplement ici.
      return;
    }

    const landingBars = document.getElementById('statsLandingBars');
    const appBars = document.getElementById('statsAppBars');
    const landingTotal = document.getElementById('statsLandingTotal');
    const appTotal = document.getElementById('statsAppTotal');

    const [waitlistRes, onboardingRes] = await Promise.all([
      supabaseClient.from('waitlist').select('heard_about'),
      supabaseClient.from('onboarding_answers').select('acquisition_source'),
    ]);

    if (waitlistRes.error) console.error('Statistiques : erreur lecture waitlist', waitlistRes.error);
    if (onboardingRes.error) console.error('Statistiques : erreur lecture onboarding_answers', onboardingRes.error);

    const landingRows = waitlistRes.data || [];
    const appRows = onboardingRes.data || [];

    setTotal(landingTotal, landingRows.length);
    setTotal(appTotal, appRows.length);

    renderBars(landingBars, aggregate(landingRows, 'heard_about'), landingRows.length);
    renderBars(appBars, aggregate(appRows, 'acquisition_source'), appRows.length);
  }
});
