// ============================================================
// Lockd — Dashboard admin (admin.html)
// Lecture seule sur la même base que l'app, via les policies RLS
// "admin_select_*" (voir la migration admin_dashboard_read_access).
// Réservé aux comptes listés dans window.ADMIN_EMAILS.
// ============================================================

function showGateError(gate, message) {
  gate.innerHTML = '';
  const p = document.createElement('p');
  p.style.color = '#FCA5A5';
  p.style.maxWidth = '360px';
  p.style.textAlign = 'center';
  p.style.padding = '0 20px';
  p.textContent = message;
  const retry = document.createElement('a');
  retry.href = 'connexion.html';
  retry.style.color = '#fff';
  retry.style.textDecoration = 'underline';
  retry.textContent = 'Retourner se connecter';
  gate.append(p, retry);
}

document.addEventListener('DOMContentLoaded', () => {
  const gate = document.getElementById('adminGate');
  const app = document.getElementById('adminApp');

  // Filet de sécurité : si quelque chose bloque plus de 8s (réseau,
  // client Supabase pas chargé, exception imprévue...), on arrête
  // d'attendre en silence plutôt que de laisser tourner le spinner
  // indéfiniment.
  const gateTimeout = setTimeout(() => {
    showGateError(gate, "La vérification prend trop de temps. Vérifie ta connexion, ou que rien ne bloque cdn.jsdelivr.net, puis réessaie.");
  }, 8000);

  init().catch((err) => {
    console.error('Admin dashboard: erreur inattendue', err);
    showGateError(gate, "Erreur inattendue : " + (err && err.message ? err.message : String(err)));
  }).finally(() => clearTimeout(gateTimeout));

  async function init() {
    // ---------- Garde d'accès (UX seulement — RLS fait foi côté base) ----------
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      throw new Error('Client Supabase indisponible (script non chargé ?).');
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    const email = session && session.user && session.user.email;

    if (!session || !email || !window.ADMIN_EMAILS || !window.ADMIN_EMAILS.includes(email)) {
      window.location.href = 'connexion.html';
      return;
    }

    gate.hidden = true;
    app.hidden = false;
    document.getElementById('adminUserEmail').textContent = email;

  document.getElementById('adminLogout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  });

  // ---------- Aides d'affichage ----------
  const ACTIVE_GOAL_STATES_EXCLUDED = ['draft', 'closed_kept', 'closed_void', 'closed_failed'];

  const STATE_LABELS = {
    draft: 'Brouillon',
    committed: 'Engagé',
    proof_window_open: 'Fenêtre ouverte',
    proof_submitted: 'Preuve envoyée',
    ai_verifying: 'Vérification IA',
    validated: 'Validé',
    rejected: 'Rejeté',
    human_review: 'Revue humaine',
    closed_kept: 'Tenu',
    closed_void: 'Annulé',
    closed_failed: 'Raté',
    charge_pending: 'Débit en attente',
    charge_ok: 'Débité',
    charge_failed: 'Échec débit',
  };

  function stateBadgeClass(state) {
    if (state === 'closed_kept') return 'admin-feed__badge--kept';
    if (state === 'closed_failed' || state === 'rejected' || state === 'charge_failed') return 'admin-feed__badge--failed';
    if (state === 'draft' || state === 'closed_void') return '';
    return 'admin-feed__badge--active';
  }

  function formatEuros(cents) {
    return ((cents || 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
  }

  function relativeTime(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return 'il y a ' + min + ' min';
    const h = Math.floor(min / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    const d = Math.floor(h / 24);
    return 'il y a ' + d + ' j';
  }

  function clearEmptyState(list) {
    const empty = list.querySelector('.admin-feed__empty');
    if (empty) empty.remove();
  }

  function capList(list, max) {
    while (list.children.length > max) list.removeChild(list.lastChild);
  }

  function prependItem(list, node) {
    clearEmptyState(list);
    list.prepend(node);
    capList(list, 30);
  }

  function buildUserItem(row) {
    const li = document.createElement('li');
    li.className = 'admin-feed__item';

    const main = document.createElement('div');
    main.className = 'admin-feed__main';
    const title = document.createElement('p');
    title.className = 'admin-feed__title';
    title.textContent = row.display_name || 'Sans nom';
    const sub = document.createElement('p');
    sub.className = 'admin-feed__sub';
    sub.textContent = row.email || '';
    main.append(title, sub);

    const time = document.createElement('span');
    time.className = 'admin-feed__time';
    time.textContent = relativeTime(row.created_at);

    li.append(main, time);
    return li;
  }

  // Un objectif hebdomadaire ("Marcher 5 fois cette semaine") est stocké
  // côté base comme une ligne `goals` PAR séance (même plan_id, un
  // session_number chacune) — voir le commentaire sur goals.plan_id.
  // Sans regroupement, le flux affichait donc le même titre en double,
  // triple... jusqu'à N fois. On regroupe ici par plan_id et on montre
  // une pastille par séance plutôt qu'une ligne par séance.
  function goalGroupKey(row) {
    return row.plan_id || row.id;
  }

  function buildGoalGroupItem(row) {
    const li = document.createElement('li');
    li.className = 'admin-feed__item';
    li.dataset.planKey = goalGroupKey(row);

    const main = document.createElement('div');
    main.className = 'admin-feed__main';
    const title = document.createElement('p');
    title.className = 'admin-feed__title';
    title.textContent = row.title || 'Objectif';
    const sub = document.createElement('p');
    sub.className = 'admin-feed__sub';
    sub.dataset.role = 'sessionCount';
    main.append(title, sub);

    const right = document.createElement('span');
    right.style.display = 'flex';
    right.style.alignItems = 'center';

    const badges = document.createElement('span');
    badges.dataset.role = 'sessionBadges';

    const time = document.createElement('span');
    time.className = 'admin-feed__time';
    time.style.marginLeft = '8px';
    time.textContent = relativeTime(row.created_at);

    right.append(badges, time);
    li.append(main, right);
    return li;
  }

  function addSessionToGoalGroup(li, row) {
    const badges = li.querySelector('[data-role="sessionBadges"]');
    const num = row.session_number;
    let badge = num != null ? badges.querySelector('[data-session="' + num + '"]') : null;

    if (!badge) {
      badge = document.createElement('span');
      if (num != null) badge.dataset.session = num;
      badges.appendChild(badge);
    }
    const badgeClass = stateBadgeClass(row.state);
    badge.className = 'admin-feed__badge' + (badgeClass ? ' ' + badgeClass : '');
    badge.title = STATE_LABELS[row.state] || row.state;
    badge.textContent = num != null ? String(num) : (STATE_LABELS[row.state] || row.state);

    const sub = li.querySelector('[data-role="sessionCount"]');
    const count = badges.children.length;
    sub.textContent = count > 1 ? count + ' séances' : '1 séance';
  }

  // ---------- Stats agrégées ----------
  let statsTimer = null;
  function scheduleStatsRefresh() {
    clearTimeout(statsTimer);
    statsTimer = setTimeout(refreshStats, 250);
  }

  async function refreshStats() {
    const [usersRes, goalsRes, stakesRes] = await Promise.all([
      supabaseClient.from('profiles').select('user_id', { count: 'exact', head: true }),
      supabaseClient.from('goals').select('id', { count: 'exact', head: true }).not('state', 'in', '(' + ACTIVE_GOAL_STATES_EXCLUDED.join(',') + ')'),
      supabaseClient.from('stakes').select('amount_cents').eq('status', 'active'),
    ]);

    document.getElementById('statUsers').textContent = usersRes.count != null ? usersRes.count : '—';
    document.getElementById('statGoalsActive').textContent = goalsRes.count != null ? goalsRes.count : '—';

    const total = (stakesRes.data || []).reduce((sum, r) => sum + (r.amount_cents || 0), 0);
    document.getElementById('statStakeAmount').textContent = formatEuros(total);
  }

  // ---------- Chargement initial des flux ----------
  async function loadInitialFeeds() {
    const feedUsers = document.getElementById('feedUsers');
    const feedGoals = document.getElementById('feedGoals');

    const { data: users } = await supabaseClient
      .from('profiles')
      .select('user_id, display_name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(15);

    feedUsers.innerHTML = '';
    if (users && users.length) {
      users.forEach((row) => feedUsers.appendChild(buildUserItem(row)));
    } else {
      feedUsers.innerHTML = '<li class="admin-feed__empty">Aucune inscription pour l\'instant.</li>';
    }

    // limit plus haut que pour les autres flux : chaque objectif
    // hebdomadaire occupe plusieurs lignes (une par séance), regroupées
    // ensuite par plan_id — sans cette marge le panneau afficherait
    // très peu de plans distincts.
    const { data: goals } = await supabaseClient
      .from('goals')
      .select('id, title, state, created_at, plan_id, session_number')
      .order('created_at', { ascending: false })
      .limit(40);

    feedGoals.innerHTML = '';
    if (goals && goals.length) {
      goals.forEach((row) => {
        const key = goalGroupKey(row);
        let li = feedGoals.querySelector('[data-plan-key="' + key + '"]');
        if (!li) {
          li = buildGoalGroupItem(row);
          feedGoals.appendChild(li);
        }
        addSessionToGoalGroup(li, row);
      });
      capList(feedGoals, 15);
    } else {
      feedGoals.innerHTML = '<li class="admin-feed__empty">Aucun objectif pour l\'instant.</li>';
    }
  }

  // ---------- Temps réel ----------
  function subscribeRealtime() {
    const feedUsers = document.getElementById('feedUsers');
    const feedGoals = document.getElementById('feedGoals');

    supabaseClient
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
        prependItem(feedUsers, buildUserItem(payload.new));
        scheduleStatsRefresh();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'goals' }, (payload) => {
        const key = goalGroupKey(payload.new);
        let li = feedGoals.querySelector('[data-plan-key="' + key + '"]');
        if (li) {
          addSessionToGoalGroup(li, payload.new);
        } else {
          li = buildGoalGroupItem(payload.new);
          addSessionToGoalGroup(li, payload.new);
          prependItem(feedGoals, li);
        }
        scheduleStatsRefresh();
      })
      // Une séance qui change d'état (ex : passe à "Rejeté") met juste
      // à jour sa pastille dans le groupe, sans créer de nouvelle ligne.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'goals' }, (payload) => {
        const li = feedGoals.querySelector('[data-plan-key="' + goalGroupKey(payload.new) + '"]');
        if (li) addSessionToGoalGroup(li, payload.new);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, scheduleStatsRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stakes' }, scheduleStatsRefresh)
      .subscribe();
  }

    await Promise.all([refreshStats(), loadInitialFeeds()]);
    subscribeRealtime();
  }
});
