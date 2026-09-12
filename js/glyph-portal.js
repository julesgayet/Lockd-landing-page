// ============================================================
// Lockd — zoom dans le titre « Rien ne se perd » de sa propre carte
// La section « Pourquoi ça marche » se fige en bas de son défilement ; le titre
// grandit depuis sa place exacte dans la carte, la caméra entre dans une lettre
// et l'écran devient blanc, comme la section suivante.
// Adapté de Glyph Portal © 2026 Christian Katzmann, MIT (ktzm.dk).
// Garder cette mention avec toute copie.
// ============================================================
(() => {
  const wrap = document.getElementById('whyPortal');
  const section = document.getElementById('pourquoi');
  const source = document.getElementById('gpSource');
  const overlay = document.getElementById('gpOverlay');
  if (!wrap || !section || !source || !overlay) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  const field = overlay.querySelector('.gp-overlay__field');
  const art = overlay.querySelector('.gp-overlay__art');
  const clip = overlay.querySelector('#gpClip');
  const glyph = overlay.querySelector('.gp-overlay__glyph');
  const text = source.textContent.trim();
  const marker = document.createElement('span');
  marker.setAttribute('aria-hidden', 'true');
  marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;';
  source.textContent = text;
  source.prepend(marker);
  const LENGTH = 1.8; // défilement consacré au zoom, en hauteurs d'écran
  // L'écran devient blanc pile à la fin du défilement réservé : la section suivante monte aussitôt.
  const WHITE_AT = 1;
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });

  let W = 1, H = 1, travel = 1, font = null, bounds = null, center = null, target = null;
  let raf = 0;

  // Plus grand carré plein dans une lettre : c'est par là que la caméra entre.
  function interior(char, f) {
    const canvas = ctx.canvas;
    ctx.font = f;
    const m = ctx.measureText(char);
    const pad = 8, left = Math.ceil(m.actualBoundingBoxLeft), ascent = Math.ceil(m.actualBoundingBoxAscent);
    canvas.width = Math.max(1, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2);
    canvas.height = Math.max(1, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2);
    ctx.font = f;
    ctx.fillText(char, pad + left, pad + ascent);
    const { width, height } = canvas;
    const px = ctx.getImageData(0, 0, width, height).data;
    const rows = new Uint16Array(width + 1);
    let size = 0, bx = 0, by = 0;
    for (let y = 0; y < height; y++) {
      let diag = 0;
      for (let x = 0; x < width; x++) {
        const above = rows[x + 1];
        rows[x + 1] = px[(y * width + x) * 4 + 3] > 245 ? Math.min(above, rows[x], diag) + 1 : 0;
        diag = above;
        if (rows[x + 1] > size) { size = rows[x + 1]; bx = x; by = y; }
      }
    }
    if (size < 3) return null;
    return { x: (bx + 1 - size / 2 - pad - left) / 3, y: (by + 1 - size / 2 - pad - ascent) / 3, radius: (size / 2 - 1) / 3 };
  }

  function measure() {
    const cs = getComputedStyle(source);
    font = { family: cs.fontFamily, weight: cs.fontWeight, size: parseFloat(cs.fontSize), lineHeight: cs.lineHeight };
    glyph.style.fontFamily = font.family;
    glyph.style.fontWeight = font.weight;
    glyph.style.fontSize = '100px';
    glyph.style.letterSpacing = cs.letterSpacing === 'normal' ? '0' : `${parseFloat(cs.letterSpacing) * 100 / font.size}px`;
    const f100 = `${font.weight} 100px ${font.family}`;
    ctx.font = f100;
    const m = ctx.measureText(text);
    bounds = { x: -m.actualBoundingBoxLeft, y: -m.actualBoundingBoxAscent,
      width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent };
    center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const candidates = [];
    Array.from(text).forEach((char, i) => {
      if (char === ' ') return;
      ctx.font = f100;
      const advance = ctx.measureText(text.slice(0, i)).width;
      const found = interior(char, `${font.weight} 300px ${font.family}`);
      if (found) candidates.push({ ...found, x: found.x + advance });
    });
    target = candidates.sort((a, b) => b.radius - a.radius || Math.abs(a.x - center.x) - Math.abs(b.x - center.x))[0] || null;
    return !!target;
  }

  function layout() {
    // Taille réelle du calque (sans la barre de défilement), sinon le SVG se recentre et décale le texte.
    W = overlay.clientWidth || window.innerWidth; H = overlay.clientHeight || window.innerHeight;
    travel = H * LENGTH;
    art.setAttribute('viewBox', `0 0 ${W} ${H}`);
    art.setAttribute('preserveAspectRatio', 'none');
    // La section se fige quand son bas touche le bas de l'écran.
    section.style.top = `${Math.min(0, H - section.offsetHeight)}px`;
    wrap.style.height = `${section.offsetHeight + travel}px`;
  }

  function paint() {
    raf = 0;
    const p = clamp((-wrap.getBoundingClientRect().top - Math.max(0, section.offsetHeight - H)) / travel);
    const on = p > 0 && p < 1;
    overlay.classList.toggle('is-on', on);
    // Une fois l'écran blanc, la section ne doit plus jamais réapparaître en descendant :
    // elle reste masquée (fond blanc) pendant qu'elle se décroche, et la suivante monte directement.
    section.style.visibility = p >= WHITE_AT ? 'hidden' : '';
    // Le titre réel cède sa place pendant le zoom, et la reprend une fois passé.
    source.style.visibility = on ? 'hidden' : '';
    if (!on) return;

    // Point de départ : le titre tel qu'il est posé dans la carte.
    // Repère posé sur la ligne de base, au tout début du texte : aucune estimation de hauteur de ligne.
    const r = marker.getBoundingClientRect();
    const s0 = font.size / 100;
    const start = { x: r.left + center.x * s0, y: r.bottom + center.y * s0 };
    const endScale = Math.max(s0, Math.hypot(W, H) / (target.radius * 1.35));

    const t = clamp(p / WHITE_AT);
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    const scale = Math.exp(Math.log(s0) + Math.log(endScale / s0) * eased);
    const blend = (1 / scale - 1 / s0) / (1 / endScale - 1 / s0);
    const cx = lerp(center.x, target.x, blend);
    const cy = lerp(center.y, target.y, blend);
    const ax = lerp(start.x, W / 2, eased);
    const ay = lerp(start.y, H / 2, eased);
    const roll = -4 * smooth(0.06, 0.5, t) * (1 - smooth(0.62, 0.92, t));
    const rad = roll * Math.PI / 180;
    const dx = ax / scale, dy = ay / scale;
    clip.setAttribute('transform', `scale(${scale}) rotate(${roll})`);
    glyph.setAttribute('transform', `translate(${Math.cos(rad) * dx + Math.sin(rad) * dy - cx} ${-Math.sin(rad) * dx + Math.cos(rad) * dy - cy})`);
    // L'écran est entièrement blanc : on retire le masque, puis on rend la main à la page.
    if (t >= 1) field.removeAttribute('clip-path'); else field.setAttribute('clip-path', 'url(#gpClip)');
  }

  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
  const resize = () => { layout(); paint(); };

  const start = () => {
    if (!measure()) return;
    layout(); paint();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', resize);
    new ResizeObserver(resize).observe(section);
  };
  const cs = getComputedStyle(source);
  Promise.race([document.fonts.load(`${cs.fontWeight} 100px Inter`, text), new Promise((r) => setTimeout(r, 1600))]).then(start, start);
})();
