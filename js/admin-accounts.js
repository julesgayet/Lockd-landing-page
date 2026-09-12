// ============================================================
// Lockd — Onglet "Comptes" du dashboard admin (admin.html)
//
// Liste les comptes (public.profiles, lisible par les admins via la
// policy RLS admin_select_profiles) avec recherche, et ouvre une fiche
// détail par compte (derniers objectifs / mises / contestations, via les
// policies admin_select_goals / admin_select_stakes / admin_select_disputes).
//
// Trois actions d'écriture, toutes via des RPC qui vérifient elles-mêmes
// l'email admin (même garde que admin_resolve_dispute) — profiles n'a
// aucune policy RLS d'UPDATE/DELETE ouverte aux admins, par précaution vu
// les colonnes sensibles qu'elle porte (Stripe, plafonds...) :
//   - public.admin_set_stake_block()     : bloque/débloque la prise de mises
//   - public.admin_update_display_name() : renomme le compte
//   - public.admin_delete_account()      : supprime le compte (auth.users,
//     qui cascade sur profiles et tout son historique — irréversible, y
//     compris pour un compte admin : la RPC ne l'interdit pas, seule la
//     confirmation par saisie d'email dans l'UI protège du clic accidentel)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  let loaded = false;
  let accountsCache = [];
  let deleteTargetRow = null;

  document.addEventListener('admin-tab-shown', (e) => {
    if (e.detail.tabId === 'tabAccounts' && !loaded) {
      loaded = true;
      init().catch((err) => {
        console.error('Onglet comptes : erreur inattendue', err);
      });
    }
  });

  async function init() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const email = session && session.user && session.user.email;
    if (!session || !email || !window.ADMIN_EMAILS || !window.ADMIN_EMAILS.includes(email)) {
      // admin-dashboard.js s'occupe déjà de la redirection ; on s'arrête simplement ici.
      return;
    }

    await loadAccounts();

    document.getElementById('accountsSearch').addEventListener('input', (e) => {
      renderAccounts(filterAccounts(e.target.value));
    });

    document.querySelectorAll('[data-role="closeDrawer"]').forEach((el) => {
      el.addEventListener('click', closeDrawer);
    });
    document.querySelectorAll('[data-role="closeDeleteConfirm"]').forEach((el) => {
      el.addEventListener('click', closeDeleteConfirm);
    });
    document.getElementById('deleteConfirmInput').addEventListener('input', (e) => {
      const target = deleteTargetRow;
      document.getElementById('deleteConfirmButton').disabled = !target || e.target.value.trim() !== target.email;
    });
    document.getElementById('deleteConfirmButton').addEventListener('click', () => {
      if (deleteTargetRow) deleteAccount(deleteTargetRow);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('deleteConfirmModal').hidden) closeDeleteConfirm();
      else closeDrawer();
    });
  }

  // ---------- Aides d'affichage ----------
  const TIER_LABELS = { none: null, plus: 'Plus', pro: 'Pro' };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

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

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatEuros(cents) {
    return ((cents || 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
  }

  const GOAL_STATE_LABELS = {
    draft: 'Brouillon', committed: 'Engagé', proof_window_open: 'Fenêtre ouverte',
    proof_submitted: 'Preuve envoyée', ai_verifying: 'Vérification IA', validated: 'Validé',
    rejected: 'Rejeté', human_review: 'Revue humaine', closed_kept: 'Tenu',
    closed_void: 'Annulé', closed_failed: 'Raté', charge_pending: 'Débit en attente',
    charge_ok: 'Débité', charge_failed: 'Échec débit',
  };
  const STAKE_STATUS_LABELS = { active: 'En jeu', released: 'Libérée', charged: 'Débitée' };
  const DISPUTE_STATUS_LABELS = { open: 'Ouverte', under_review: 'En revue', upheld: 'Acceptée', denied: 'Refusée' };

  // ---------- Chargement + recherche ----------
  async function loadAccounts() {
    const list = document.getElementById('accountsList');

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('user_id, display_name, email, created_at, subscription_tier, outstanding_balance_cents, stake_block_active, stake_block_reason, stake_block_since, per_goal_cap_cents, monthly_cap_cents, pm_brand, pm_last4')
      .order('created_at', { ascending: false });

    if (error) {
      list.innerHTML = '<li class="admin-feed__empty">Erreur de chargement : ' + escapeHtml(error.message) + '</li>';
      return;
    }

    accountsCache = data || [];
    renderAccounts(accountsCache);
  }

  function filterAccounts(query) {
    const q = query.trim().toLowerCase();
    if (!q) return accountsCache;
    return accountsCache.filter((row) =>
      (row.display_name || '').toLowerCase().includes(q) ||
      (row.email || '').toLowerCase().includes(q)
    );
  }

  function renderAccounts(rows) {
    const list = document.getElementById('accountsList');
    list.innerHTML = '';

    if (!rows || rows.length === 0) {
      list.innerHTML = '<li class="admin-feed__empty">Aucun compte trouvé.</li>';
      return;
    }

    rows.forEach((row) => list.appendChild(buildAccountRow(row)));
  }

  function buildAccountRow(row) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'account-row';

    const main = document.createElement('div');
    main.className = 'admin-feed__main';
    const nameRow = document.createElement('div');
    nameRow.className = 'admin-feed__name-row';
    const title = document.createElement('p');
    title.className = 'admin-feed__title';
    title.textContent = row.display_name || 'Sans nom';
    nameRow.appendChild(title);
    if (window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes(row.email)) {
      const adminBadge = document.createElement('span');
      adminBadge.className = 'admin-feed__badge admin-feed__badge--admin';
      adminBadge.textContent = 'Admin';
      nameRow.appendChild(adminBadge);
    }
    const sub = document.createElement('p');
    sub.className = 'admin-feed__sub';
    sub.textContent = row.email || '';
    main.append(nameRow, sub);

    const right = document.createElement('span');
    right.className = 'account-row__badges';

    const tierLabel = TIER_LABELS[row.subscription_tier];
    if (tierLabel) {
      const tierBadge = document.createElement('span');
      tierBadge.className = 'admin-feed__badge admin-feed__badge--tier';
      tierBadge.textContent = tierLabel;
      right.appendChild(tierBadge);
    }
    if (row.stake_block_active) {
      const blockBadge = document.createElement('span');
      blockBadge.className = 'admin-feed__badge admin-feed__badge--blocked';
      blockBadge.textContent = 'Bloqué';
      right.appendChild(blockBadge);
    }

    const time = document.createElement('span');
    time.className = 'admin-feed__time';
    time.textContent = relativeTime(row.created_at);
    right.appendChild(time);

    btn.append(main, right);
    btn.addEventListener('click', () => openDrawer(row));
    li.appendChild(btn);
    return li;
  }

  // ---------- Fiche détail ----------
  function openDrawer(row) {
    const drawer = document.getElementById('accountDrawer');
    const body = document.getElementById('accountDrawerBody');

    const tierLabel = TIER_LABELS[row.subscription_tier];
    const paymentLine = row.pm_brand && row.pm_last4
      ? escapeHtml(row.pm_brand) + ' •••• ' + escapeHtml(row.pm_last4)
      : 'Aucun moyen de paiement enregistré';
    // La RPC de suppression refuse déjà les comptes admin ; on masque le
    // bouton pour ces comptes-là plutôt que de laisser un clic échouer.
    const isAdminAccount = window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes(row.email);

    body.innerHTML = `
      <div class="account-detail__name-row">
        <input type="text" class="account-detail__name-input" data-role="nameInput" value="${escapeHtml(row.display_name || '')}" placeholder="Sans nom" maxlength="120" />
        <button type="button" class="account-detail__name-save" data-role="nameSave" hidden>Enregistrer</button>
      </div>
      <div class="account-detail__subrow">
        <p class="account-detail__sub">${escapeHtml(row.email || '')} · inscrit le ${escapeHtml(formatDate(row.created_at))}${tierLabel ? ' · ' + escapeHtml(tierLabel) : ''}</p>
        ${isAdminAccount ? '<span class="admin-feed__badge admin-feed__badge--admin">Admin</span>' : ''}
      </div>
      <p class="account-detail__name-error" data-role="nameError" hidden></p>

      <div class="account-detail__stats">
        <div class="account-detail__stat">
          <p class="account-detail__stat-label">Plafond par mise</p>
          <p class="account-detail__stat-value">${escapeHtml(formatEuros(row.per_goal_cap_cents))}</p>
        </div>
        <div class="account-detail__stat">
          <p class="account-detail__stat-label">Plafond mensuel</p>
          <p class="account-detail__stat-value">${escapeHtml(formatEuros(row.monthly_cap_cents))}</p>
        </div>
        <div class="account-detail__stat">
          <p class="account-detail__stat-label">Solde dû</p>
          <p class="account-detail__stat-value">${escapeHtml(formatEuros(row.outstanding_balance_cents))}</p>
        </div>
        <div class="account-detail__stat">
          <p class="account-detail__stat-label">Moyen de paiement</p>
          <p class="account-detail__stat-value" style="font-size:13px;">${paymentLine}</p>
        </div>
      </div>

      <div class="account-actions" data-role="blockSection">
        <div class="account-actions__row">
          <div>
            <p class="account-actions__label">${row.stake_block_active ? 'Compte bloqué' : 'Compte actif'}</p>
            ${row.stake_block_active && row.stake_block_reason ? '<p class="account-actions__hint"><strong>Raison :</strong> ' + escapeHtml(row.stake_block_reason) + '</p>' : ''}
            ${row.stake_block_active && row.stake_block_since ? '<p class="account-actions__hint">Depuis le ' + escapeHtml(formatDate(row.stake_block_since)) + '</p>' : ''}
          </div>
          <button type="button" class="dispute-btn ${row.stake_block_active ? 'dispute-btn--approve' : 'dispute-btn--reject'}" data-role="blockToggle">
            ${row.stake_block_active ? '✓ Débloquer' : '✕ Bloquer'}
          </button>
        </div>
        ${!row.stake_block_active ? `
        <div class="account-actions__reveal" data-role="blockReasonWrap" hidden>
          <textarea data-role="blockReason" placeholder="Raison du blocage (visible dans la fiche)" rows="2"></textarea>
          <div class="account-actions__reveal-footer">
            <button type="button" class="account-actions__cancel" data-role="blockCancel">Annuler</button>
          </div>
        </div>
        ` : ''}
        <p class="account-actions__error" data-role="blockError" hidden></p>

        <div class="account-actions__divider"></div>

        <div class="account-actions__row">
          <div>
            <p class="account-actions__label">${isAdminAccount ? '⚠️ Compte administrateur' : 'Supprimer le compte'}</p>
            <p class="account-actions__hint">Efface définitivement le compte et tout son historique.</p>
          </div>
          <button type="button" class="account-danger__btn" data-role="deleteAccount">Supprimer</button>
        </div>
      </div>

      <p class="account-detail__section-title">Objectifs récents</p>
      <ul class="account-detail__list" data-role="goalsList"><li class="admin-feed__empty">Chargement…</li></ul>

      <p class="account-detail__section-title">Mises récentes</p>
      <ul class="account-detail__list" data-role="stakesList"><li class="admin-feed__empty">Chargement…</li></ul>

      <p class="account-detail__section-title">Contestations</p>
      <ul class="account-detail__list" data-role="disputesList"><li class="admin-feed__empty">Chargement…</li></ul>
    `;

    body.querySelector('[data-role="blockToggle"]').addEventListener('click', () => toggleBlock(row, body));
    const deleteBtn = body.querySelector('[data-role="deleteAccount"]');
    if (deleteBtn) deleteBtn.addEventListener('click', () => openDeleteConfirm(row));

    const blockCancel = body.querySelector('[data-role="blockCancel"]');
    if (blockCancel) blockCancel.addEventListener('click', () => cancelBlockReveal(body));

    const nameInput = body.querySelector('[data-role="nameInput"]');
    const nameSave = body.querySelector('[data-role="nameSave"]');
    nameInput.addEventListener('input', () => {
      nameSave.hidden = nameInput.value.trim() === (row.display_name || '');
    });
    nameSave.addEventListener('click', () => saveDisplayName(row, body));

    drawer.hidden = false;
    document.body.style.overflow = 'hidden';

    loadAccountDetails(row.user_id, body);
  }

  function closeDrawer() {
    const drawer = document.getElementById('accountDrawer');
    if (drawer.hidden) return;
    drawer.hidden = true;
    document.body.style.overflow = '';
  }

  // ---------- Renommage ----------
  async function saveDisplayName(row, body) {
    const input = body.querySelector('[data-role="nameInput"]');
    const saveBtn = body.querySelector('[data-role="nameSave"]');
    const errorEl = body.querySelector('[data-role="nameError"]');
    const newName = input.value.trim();

    saveBtn.disabled = true;
    errorEl.hidden = true;

    const { error } = await supabaseClient.rpc('admin_update_display_name', {
      p_user_id: row.user_id,
      p_display_name: newName || null,
    });

    saveBtn.disabled = false;

    if (error) {
      errorEl.textContent = 'Échec : ' + error.message;
      errorEl.hidden = false;
      return;
    }

    row.display_name = newName || null;
    saveBtn.hidden = true;
    const cachedIndex = accountsCache.findIndex((r) => r.user_id === row.user_id);
    if (cachedIndex !== -1) accountsCache[cachedIndex] = row;
    renderAccounts(filterAccounts(document.getElementById('accountsSearch').value));
  }

  // ---------- Suppression définitive ----------
  function openDeleteConfirm(row) {
    deleteTargetRow = row;
    const isAdminAccount = window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes(row.email);

    document.getElementById('deleteConfirmBody').textContent =
      (isAdminAccount ? '⚠️ Ceci est un compte ADMINISTRATEUR. ' : '') +
      'Le compte de ' + (row.display_name || row.email) + ' (' + row.email + ') sera supprimé avec tout son historique : ' +
      'objectifs, mises, contestations, preuves et paiements enregistrés.' +
      (isAdminAccount ? ' Cet email perdra définitivement l\'accès au dashboard.' : '') +
      ' Cette action ne peut pas être annulée.';

    const input = document.getElementById('deleteConfirmInput');
    input.value = '';
    input.placeholder = row.email;
    document.getElementById('deleteConfirmButton').disabled = true;
    document.getElementById('deleteConfirmError').hidden = true;

    document.getElementById('deleteConfirmModal').hidden = false;
    input.focus();
  }

  function closeDeleteConfirm() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal.hidden) return;
    modal.hidden = true;
    deleteTargetRow = null;
  }

  async function deleteAccount(row) {
    const btn = document.getElementById('deleteConfirmButton');
    const errorEl = document.getElementById('deleteConfirmError');
    btn.disabled = true;
    errorEl.hidden = true;

    const { error } = await supabaseClient.rpc('admin_delete_account', { p_user_id: row.user_id });

    if (error) {
      errorEl.textContent = 'Échec : ' + error.message;
      errorEl.hidden = false;
      btn.disabled = false;
      return;
    }

    closeDeleteConfirm();
    closeDrawer();
    accountsCache = accountsCache.filter((r) => r.user_id !== row.user_id);
    renderAccounts(filterAccounts(document.getElementById('accountsSearch').value));
  }

  async function loadAccountDetails(userId, body) {
    const [goalsRes, stakesRes, disputesRes] = await Promise.all([
      supabaseClient.from('goals').select('id, title, state, created_at, reference').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
      supabaseClient.from('stakes').select('id, amount_cents, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
      supabaseClient.from('disputes').select('id, status, filed_at, resolved_at, proof_id, attachment_path').eq('user_id', userId).order('filed_at', { ascending: false }).limit(5),
    ]);

    fillSimpleList(body.querySelector('[data-role="goalsList"]'), goalsRes.data, 'Aucun objectif.', (row) => ({
      title: row.title || 'Objectif',
      sub: (row.reference || '') + ' · ' + formatDate(row.created_at),
      badge: GOAL_STATE_LABELS[row.state] || row.state,
    }));

    fillSimpleList(body.querySelector('[data-role="stakesList"]'), stakesRes.data, 'Aucune mise.', (row) => ({
      title: formatEuros(row.amount_cents),
      sub: formatDate(row.created_at),
      badge: STAKE_STATUS_LABELS[row.status] || row.status,
    }));

    fillSimpleList(body.querySelector('[data-role="disputesList"]'), disputesRes.data, 'Aucune contestation.', (row) => ({
      title: DISPUTE_STATUS_LABELS[row.status] || row.status,
      sub: formatDate(row.filed_at)
        + (row.proof_id ? '' : ' · sans preuve')
        + (row.attachment_path ? ' · 📎 justificatif' : ''),
      badge: null,
    }));
  }

  function fillSimpleList(ul, rows, emptyText, mapRow) {
    ul.innerHTML = '';
    if (!rows || rows.length === 0) {
      ul.innerHTML = '<li class="admin-feed__empty">' + escapeHtml(emptyText) + '</li>';
      return;
    }
    rows.forEach((row) => {
      const item = mapRow(row);
      const li = document.createElement('li');
      li.className = 'admin-feed__item';
      li.innerHTML = `
        <div class="admin-feed__main">
          <p class="admin-feed__title">${escapeHtml(item.title)}</p>
          <p class="admin-feed__sub">${escapeHtml(item.sub)}</p>
        </div>
        ${item.badge ? '<span class="admin-feed__badge">' + escapeHtml(item.badge) + '</span>' : ''}
      `;
      ul.appendChild(li);
    });
  }

  // ---------- Blocage / déblocage ----------
  function cancelBlockReveal(body) {
    const section = body.querySelector('[data-role="blockSection"]');
    const wrap = section.querySelector('[data-role="blockReasonWrap"]');
    const toggleBtn = section.querySelector('[data-role="blockToggle"]');
    const errorEl = section.querySelector('[data-role="blockError"]');
    wrap.hidden = true;
    wrap.querySelector('textarea').value = '';
    toggleBtn.textContent = '✕ Bloquer';
    errorEl.hidden = true;
  }

  async function toggleBlock(row, body) {
    const section = body.querySelector('[data-role="blockSection"]');
    const toggleBtn = section.querySelector('[data-role="blockToggle"]');
    const errorEl = section.querySelector('[data-role="blockError"]');
    const willBlock = !row.stake_block_active;
    const reasonWrap = section.querySelector('[data-role="blockReasonWrap"]');

    // Premier clic : révèle juste le champ de raison, ne bloque pas encore.
    if (willBlock && reasonWrap && reasonWrap.hidden) {
      reasonWrap.hidden = false;
      toggleBtn.textContent = '✕ Confirmer le blocage';
      reasonWrap.querySelector('textarea').focus();
      return;
    }

    const reasonEl = section.querySelector('[data-role="blockReason"]');
    const reason = reasonEl ? reasonEl.value.trim() : '';

    if (willBlock && !reason) {
      errorEl.textContent = 'Indique une raison avant de bloquer ce compte.';
      errorEl.hidden = false;
      return;
    }

    toggleBtn.disabled = true;
    errorEl.hidden = true;

    const { error } = await supabaseClient.rpc('admin_set_stake_block', {
      p_user_id: row.user_id,
      p_blocked: willBlock,
      p_reason: willBlock ? reason : null,
    });

    if (error) {
      errorEl.textContent = 'Échec : ' + error.message;
      errorEl.hidden = false;
      toggleBtn.disabled = false;
      return;
    }

    row.stake_block_active = willBlock;
    row.stake_block_reason = willBlock ? reason : null;
    row.stake_block_since = willBlock ? new Date().toISOString() : null;

    const cachedIndex = accountsCache.findIndex((r) => r.user_id === row.user_id);
    if (cachedIndex !== -1) accountsCache[cachedIndex] = row;
    renderAccounts(filterAccounts(document.getElementById('accountsSearch').value));

    openDrawer(row);
  }
});
