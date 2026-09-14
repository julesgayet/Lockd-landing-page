// ============================================================
// Lockd — Onglet "Résultat IA" du dashboard admin (admin.html)
//
// Vue en lecture seule sur public.proofs (policy RLS admin_select_proofs) :
// chaque preuve envoyée par un utilisateur avec la décision de l'IA de
// vérification (ai_verdict / ai_confidence / ai_reason / ai_spoof_suspected),
// qu'elle ait été acceptée, refusée, jugée incertaine ou pas encore traitée —
// et, quand la preuve a ensuite été contestée, l'issue de la contestation
// (public.disputes, jointe via proof_id). Rien n'est écrit ici, ça ne fait
// qu'afficher : la décision (accepter/refuser une contestation) se prend
// dans l'onglet Contestations (js/admin-disputes.js).
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  let loaded = false;
  let resultsCache = [];

  document.addEventListener('admin-tab-shown', (e) => {
    if (e.detail.tabId === 'tabAiResults' && !loaded) {
      loaded = true;
      init().catch((err) => {
        console.error('Onglet résultats IA : erreur inattendue', err);
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

    await loadResults();

    document.getElementById('aiFilterVerdict').addEventListener('change', applyFilters);
    document.getElementById('aiFilterDispute').addEventListener('change', applyFilters);
    document.getElementById('aiFilterSearch').addEventListener('input', applyFilters);
  }

  // ---------- Aides d'affichage ----------
  const VERDICT_LABELS = { pass: 'IA : conforme', fail: 'IA : refusé', uncertain: 'IA : incertain' };
  const VERDICT_BADGE_CLASS = { pass: 'admin-feed__badge--kept', fail: 'admin-feed__badge--failed', uncertain: 'admin-feed__badge--warning' };

  const DISPUTE_LABELS = {
    open: 'Contestation en attente',
    under_review: 'Contestation en cours',
    upheld: 'Contestation acceptée',
    denied: 'Contestation rejetée',
  };
  const DISPUTE_BADGE_CLASS = { open: 'admin-feed__badge--warning', under_review: 'admin-feed__badge--warning', upheld: 'admin-feed__badge--kept', denied: 'admin-feed__badge--failed' };

  // Sous-ensemble des libellés d'états d'objectif utilisés ailleurs
  // (admin-dashboard.js) — dupliqué ici faute de module partagé, comme le
  // reste du dashboard (voir escapeHtml/relativeTime dans admin-disputes.js).
  const STATE_LABELS = {
    validated: 'Validé',
    rejected: 'Rejeté',
    human_review: 'Revue humaine',
    closed_kept: 'Tenu',
    closed_void: 'Annulé',
    closed_failed: 'Raté',
  };

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

  // ---------- Agrandissement de la photo ----------
  let lightbox = null;

  function openLightbox(src, alt) {
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.className = 'dispute-lightbox';
      lightbox.hidden = true;
      lightbox.innerHTML = '<button type="button" class="dispute-lightbox__close" aria-label="Fermer">✕</button><img alt="">';
      lightbox.addEventListener('click', (e) => {
        if (e.target.tagName !== 'IMG') closeLightbox();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
      });
      document.body.appendChild(lightbox);
    }
    const img = lightbox.querySelector('img');
    img.src = src;
    img.alt = alt || '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    lightbox.querySelector('img').removeAttribute('src');
    document.body.style.overflow = '';
  }

  function makeZoomable(img) {
    img.classList.add('is-zoomable');
    img.title = 'Cliquer pour agrandir';
    img.addEventListener('click', () => openLightbox(img.src, img.alt));
  }

  // ---------- Chargement ----------
  async function loadResults() {
    const list = document.getElementById('aiResultsList');

    const { data, error } = await supabaseClient
      .from('proofs')
      .select(`
        id, storage_path, captured_at, created_at, ai_verdict, ai_confidence, ai_reason,
        ai_spoof_suspected, ai_model,
        goal:goals ( title, reference, state ),
        user:profiles ( display_name, email ),
        dispute:disputes ( id, status, resolved_at, resolution_note, reviewer_id )
      `)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      list.innerHTML = '<li class="admin-feed__empty">Erreur de chargement : ' + escapeHtml(error.message) + '</li>';
      return;
    }

    // `dispute` revient en tableau (relation inverse proof_id -> proofs) :
    // une preuve n'a en pratique qu'une contestation active à la fois, on
    // garde la plus récente.
    resultsCache = (data || []).map((row) => {
      const disputes = Array.isArray(row.dispute) ? row.dispute : (row.dispute ? [row.dispute] : []);
      disputes.sort((a, b) => new Date(b.resolved_at || 0) - new Date(a.resolved_at || 0));
      return Object.assign({}, row, { dispute: disputes[0] || null });
    });

    updateStats(resultsCache);
    applyFilters();
  }

  function updateStats(rows) {
    document.getElementById('aiStatTotal').textContent = String(rows.length);
    document.getElementById('aiStatPass').textContent = String(rows.filter((r) => r.ai_verdict === 'pass').length);
    document.getElementById('aiStatFail').textContent = String(rows.filter((r) => r.ai_verdict === 'fail').length);
    document.getElementById('aiStatDisputed').textContent = String(rows.filter((r) => r.dispute).length);
  }

  // ---------- Filtres (appliqués côté client sur le cache) ----------
  function applyFilters() {
    const verdict = document.getElementById('aiFilterVerdict').value;
    const disputeFilter = document.getElementById('aiFilterDispute').value;
    const search = document.getElementById('aiFilterSearch').value.trim().toLowerCase();

    const filtered = resultsCache.filter((row) => {
      if (verdict === 'none') {
        if (row.ai_verdict != null) return false;
      } else if (verdict !== 'all' && row.ai_verdict !== verdict) {
        return false;
      }

      if (disputeFilter === 'disputed' && !row.dispute) return false;
      if (disputeFilter === 'none' && row.dispute) return false;

      if (search) {
        const goal = row.goal || {};
        const user = row.user || {};
        const haystack = [goal.title, goal.reference, user.display_name, user.email, row.ai_reason]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });

    renderResults(filtered);
  }

  function renderResults(rows) {
    const list = document.getElementById('aiResultsList');
    list.innerHTML = '';

    if (!rows.length) {
      list.innerHTML = '<li class="admin-feed__empty">Aucune décision IA ne correspond à ces filtres.</li>';
      return;
    }

    rows.forEach((row) => list.appendChild(buildResultItem(row)));
  }

  // ---------- Construction des lignes ----------
  function buildResultItem(row) {
    const li = document.createElement('li');
    li.className = 'history-item';

    const goal = row.goal || {};
    const user = row.user || {};
    const dispute = row.dispute;

    const verdictLabel = row.ai_verdict ? (VERDICT_LABELS[row.ai_verdict] || row.ai_verdict) : 'IA : non traité';
    const verdictBadgeClass = row.ai_verdict ? (VERDICT_BADGE_CLASS[row.ai_verdict] || '') : 'admin-feed__badge--muted';

    li.innerHTML = `
      <button type="button" class="admin-feed__item history-item__head" aria-expanded="false">
        <div class="admin-feed__main">
          <p class="admin-feed__title">${escapeHtml(goal.title || 'Objectif')} <span class="admin-feed__sub">${escapeHtml(goal.reference || '')}</span></p>
          <p class="admin-feed__sub">${escapeHtml(user.display_name || 'Sans nom')} · ${escapeHtml(user.email || '')}</p>
        </div>
        <span class="admin-feed__badge ${verdictBadgeClass}">${escapeHtml(verdictLabel)}</span>
        ${row.ai_spoof_suspected ? '<span class="admin-feed__badge admin-feed__badge--failed">⚠ Triche suspectée</span>' : ''}
        ${dispute ? `<span class="admin-feed__badge ${DISPUTE_BADGE_CLASS[dispute.status] || ''}">${escapeHtml(DISPUTE_LABELS[dispute.status] || dispute.status)}</span>` : ''}
        <span class="admin-feed__time">${escapeHtml(relativeTime(row.captured_at || row.created_at))}</span>
        <span class="history-item__chevron" aria-hidden="true">▾</span>
      </button>
      <div class="history-item__detail" hidden></div>
    `;

    const head = li.querySelector('.history-item__head');
    const detail = li.querySelector('.history-item__detail');
    let opened = false;

    head.addEventListener('click', () => {
      const open = detail.hidden;
      detail.hidden = !open;
      head.setAttribute('aria-expanded', String(open));
      li.classList.toggle('is-open', open);
      if (open && !opened) {
        opened = true;
        renderDetail(detail, row);
      }
    });

    return li;
  }

  // Détail complet, construit directement depuis le cache (pas de second
  // aller-retour réseau) : seule la photo signée est chargée à la demande,
  // à la première ouverture.
  function renderDetail(detail, row) {
    const goal = row.goal || {};
    const dispute = row.dispute;
    const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '?');

    detail.innerHTML = `
      <div class="dispute-card history-item__card">
        <div class="dispute-card__photo" data-role="photo">
          <span class="dispute-card__photo-placeholder">Chargement de la photo…</span>
        </div>
        <div class="dispute-card__body">
          <p class="admin-feed__sub">Objectif : ${escapeHtml(STATE_LABELS[goal.state] || goal.state || '?')} · preuve envoyée le ${escapeHtml(fmt(row.captured_at))}</p>
          ${row.ai_model ? '<p class="admin-feed__sub">Modèle IA : ' + escapeHtml(row.ai_model) + (row.ai_confidence != null ? ' · confiance ' + Math.round(row.ai_confidence * 100) + '%' : '') + '</p>' : ''}
          ${row.ai_reason ? '<p class="dispute-card__reason">« ' + escapeHtml(row.ai_reason) + ' »</p>' : '<p class="admin-feed__sub">Pas de motif détaillé fourni par l\'IA.</p>'}
          ${dispute ? `
          <p class="admin-feed__sub" style="margin-top:8px;">
            <strong>Contestation</strong> déposée par l'utilisateur${dispute.resolved_at ? ', tranchée le ' + escapeHtml(fmt(dispute.resolved_at)) + (dispute.reviewer_id ? ' par ' + escapeHtml(dispute.reviewer_id) : '') : ' — en attente de décision'}${dispute.resolution_note ? ' — ' + escapeHtml(dispute.resolution_note) : ''}
          </p>
          ` : ''}
        </div>
      </div>
    `;

    loadPhoto(detail, row.storage_path);
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
    makeZoomable(img);
    holder.innerHTML = '';
    holder.appendChild(img);
  }
});
