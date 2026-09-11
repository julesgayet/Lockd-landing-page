// ============================================================
// Lockd — Onglet "Contestations" du dashboard admin (admin.html)
//
// Traite les objectifs en état `human_review` ouverts par
// public.open_dispute() (l'utilisateur conteste un refus IA). La décision
// admin passe par la RPC public.admin_resolve_dispute(), qui réutilise
// app.resolve_dispute() — la même fonction que le rattrapage automatique à
// 72h — donc les mêmes effets de bord partout : maj de disputes.status,
// transition_goal vers closed_kept (mise libérée) ou closed_failed (repris
// par le cycle de débit existant), notification, etc. Rien n'est réécrit
// à la main ici : ce fichier ne fait qu'afficher et appeler la RPC.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Bascule d'onglets ----------
  // Généralisée à tous les .admin-tab présents (Vue d'ensemble, Contestations,
  // Comptes...) plutôt que de coder chaque paire en dur : chaque onglet
  // déclenche un évènement 'admin-tab-shown' que les autres scripts (ex.
  // admin-accounts.js) écoutent pour charger leurs données à la demande.
  const tabs = Array.from(document.querySelectorAll('.admin-tab'));

  function activateTab(tabId) {
    tabs.forEach((tab) => {
      const isActive = tab.id === tabId;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      if (panel) panel.hidden = !isActive;
    });
    document.dispatchEvent(new CustomEvent('admin-tab-shown', { detail: { tabId } }));
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => activateTab(tab.id)));

  // ---------- Démarrage (attend la même garde d'accès que le reste du dashboard) ----------
  init().catch((err) => {
    console.error('Onglet contestations : erreur inattendue', err);
  });

  async function init() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const email = session && session.user && session.user.email;
    if (!session || !email || !window.ADMIN_EMAILS || !window.ADMIN_EMAILS.includes(email)) {
      // admin-dashboard.js s'occupe déjà de la redirection ; on s'arrête simplement ici.
      return;
    }

    await Promise.all([loadPending(), loadHistory()]);
    subscribeRealtime();
  }

  // ---------- Aides d'affichage ----------
  const VERDICT_LABELS = { pass: 'IA : conforme', fail: 'IA : refusé', uncertain: 'IA : incertain' };

  function relativeTime(iso) {
    if (!iso) return '';
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return 'il y a ' + min + ' min';
    const h = Math.floor(min / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    const d = Math.floor(h / 24);
    return 'il y a ' + d + ' j';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function updateCount(n) {
    const badge = document.getElementById('disputesCount');
    badge.textContent = String(n);
    badge.hidden = n === 0;
  }

  // ---------- Chargement ----------
  async function loadPending() {
    const list = document.getElementById('disputesPending');

    const { data, error } = await supabaseClient
      .from('disputes')
      .select(`
        id, reason, status, filed_at,
        goal:goals ( id, title, reference, state ),
        user:profiles ( display_name, email ),
        proof:proofs ( id, storage_path, ai_verdict, ai_confidence, ai_reason, captured_at )
      `)
      .in('status', ['open', 'under_review'])
      .order('filed_at', { ascending: true });

    if (error) {
      list.innerHTML = '<li class="admin-feed__empty">Erreur de chargement : ' + escapeHtml(error.message) + '</li>';
      return;
    }

    list.innerHTML = '';
    updateCount((data || []).length);

    if (!data || data.length === 0) {
      list.innerHTML = '<li class="admin-feed__empty">Aucune contestation en attente.</li>';
      return;
    }

    data.forEach((row) => list.appendChild(buildPendingCard(row)));
  }

  async function loadHistory() {
    const list = document.getElementById('disputesHistory');

    const { data, error } = await supabaseClient
      .from('disputes')
      .select(`
        id, reason, status, filed_at, resolved_at, resolution_note, reviewer_id,
        goal:goals ( title, reference ),
        user:profiles ( display_name, email )
      `)
      .in('status', ['upheld', 'denied'])
      .order('resolved_at', { ascending: false })
      .limit(30);

    if (error) {
      list.innerHTML = '<li class="admin-feed__empty">Erreur de chargement : ' + escapeHtml(error.message) + '</li>';
      return;
    }

    list.innerHTML = '';
    if (!data || data.length === 0) {
      list.innerHTML = '<li class="admin-feed__empty">Aucune décision pour l\'instant.</li>';
      return;
    }

    data.forEach((row) => list.appendChild(buildHistoryItem(row)));
  }

  // ---------- Construction des cartes ----------
  function buildPendingCard(row) {
    const li = document.createElement('li');
    li.className = 'dispute-card';
    li.dataset.disputeId = row.id;

    const goal = row.goal || {};
    const user = row.user || {};
    const proof = row.proof || {};

    li.innerHTML = `
      <div class="dispute-card__photo" data-role="photo">
        <span class="dispute-card__photo-placeholder">Chargement de la photo…</span>
      </div>
      <div class="dispute-card__body">
        <div class="dispute-card__head">
          <div>
            <p class="dispute-card__title">${escapeHtml(goal.title || 'Objectif')}</p>
            <p class="admin-feed__sub">${escapeHtml(user.display_name || 'Sans nom')} · ${escapeHtml(user.email || '')} · ${escapeHtml(goal.reference || '')}</p>
          </div>
          <span class="admin-feed__time">${escapeHtml(relativeTime(row.filed_at))}</span>
        </div>

        <p class="dispute-card__reason"><strong>Raison de l'utilisateur :</strong> ${escapeHtml(row.reason)}</p>

        <p class="dispute-card__ai">
          <span class="admin-feed__badge ${proof.ai_verdict === 'fail' ? 'admin-feed__badge--failed' : ''}">${escapeHtml(VERDICT_LABELS[proof.ai_verdict] || 'IA : verdict inconnu')}</span>
          ${proof.ai_confidence != null ? '<span class="admin-feed__sub" style="display:inline;">confiance ' + Math.round(proof.ai_confidence * 100) + '%</span>' : ''}
        </p>
        ${proof.ai_reason ? '<p class="admin-feed__sub">« ' + escapeHtml(proof.ai_reason) + ' »</p>' : ''}

        <textarea class="dispute-card__note" placeholder="Note (optionnelle, visible dans l'historique)" rows="2"></textarea>

        <div class="dispute-card__actions">
          <button type="button" class="dispute-btn dispute-btn--approve" data-action="upheld">✓ Accepter</button>
          <button type="button" class="dispute-btn dispute-btn--reject" data-action="denied">✕ Refuser</button>
        </div>
        <p class="dispute-card__error" data-role="error" hidden></p>
      </div>
    `;

    loadPhoto(li, proof.storage_path);

    li.querySelectorAll('.dispute-btn').forEach((btn) => {
      btn.addEventListener('click', () => resolveDispute(li, row.id, btn.dataset.action === 'upheld'));
    });

    return li;
  }

  function buildHistoryItem(row) {
    const li = document.createElement('li');
    li.className = 'admin-feed__item';
    const goal = row.goal || {};
    const user = row.user || {};
    const upheld = row.status === 'upheld';

    li.innerHTML = `
      <div class="admin-feed__main">
        <p class="admin-feed__title">${escapeHtml(goal.title || 'Objectif')} <span class="admin-feed__sub">${escapeHtml(goal.reference || '')}</span></p>
        <p class="admin-feed__sub">${escapeHtml(user.display_name || 'Sans nom')} · ${row.resolution_note ? escapeHtml(row.resolution_note) : 'sans note'} · par ${escapeHtml(row.reviewer_id || '?')}</p>
      </div>
      <span class="admin-feed__badge ${upheld ? 'admin-feed__badge--kept' : 'admin-feed__badge--failed'}">${upheld ? 'Accepté' : 'Rejeté'}</span>
    `;
    return li;
  }

  async function loadPhoto(li, storagePath) {
    const holder = li.querySelector('[data-role="photo"]');
    if (!storagePath) {
      holder.innerHTML = '<span class="dispute-card__photo-placeholder">Aucune photo</span>';
      return;
    }

    const { data, error } = await supabaseClient.storage.from('proofs').createSignedUrl(storagePath, 3600);
    if (error || !data) {
      holder.innerHTML = '<span class="dispute-card__photo-placeholder">Photo indisponible</span>';
      return;
    }

    const img = document.createElement('img');
    img.src = data.signedUrl;
    img.alt = 'Preuve soumise';
    img.loading = 'lazy';
    holder.innerHTML = '';
    holder.appendChild(img);
  }

  async function resolveDispute(li, disputeId, upheld) {
    const buttons = li.querySelectorAll('.dispute-btn');
    const errorEl = li.querySelector('[data-role="error"]');
    const note = li.querySelector('.dispute-card__note').value.trim();

    buttons.forEach((b) => (b.disabled = true));
    errorEl.hidden = true;

    const { error } = await supabaseClient.rpc('admin_resolve_dispute', {
      p_dispute_id: disputeId,
      p_upheld: upheld,
      p_note: note || null,
    });

    if (error) {
      errorEl.textContent = 'Échec : ' + error.message;
      errorEl.hidden = false;
      buttons.forEach((b) => (b.disabled = false));
      return;
    }

    li.remove();
    const list = document.getElementById('disputesPending');
    updateCount(list.querySelectorAll('.dispute-card').length);
    if (list.querySelectorAll('.dispute-card').length === 0) {
      list.innerHTML = '<li class="admin-feed__empty">Aucune contestation en attente 🎉</li>';
    }
    loadHistory();
  }

  // ---------- Temps réel ----------
  function subscribeRealtime() {
    supabaseClient
      .channel('admin-disputes-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'disputes' }, () => {
        loadPending();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'disputes' }, () => {
        loadPending();
        loadHistory();
      })
      .subscribe();
  }
});
