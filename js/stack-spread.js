// ============================================================
// Lockd — « Plus jamais abandonner » : une pile de cartes qui s'éparpille au défilement
// Adapté en JS sans framework de Stack Spread (Hyperiux Vault, vault.hyperiux.com).
// ============================================================
(() => {
  const wrap = document.getElementById('stackSpread');
  if (!wrap) return;
  const layer = document.getElementById('ssCards');
  const copy = document.getElementById('ssCopy');
  const hint = document.getElementById('ssHint');

  const IMG_BASE = 'https://pub-8abee449136941f5b0a1cd2c014534e9.r2.dev/vault-listing-images/assets-images/stack-spread';
  const img = (n) => `${IMG_BASE}/img${n}.png`;

  // Ordre du tableau = ordre d'empilement, du fond vers le dessus.
  // Positions en vw / vh depuis le centre ; targetSm = grille en colonnes sur écran tactile.
  const CARDS = [
    { src: img(8), stackOffset: { x: -8, y: -10 }, stackRotate: -18, target: { x: -20, y: -34, scale: 0.7, w: 17, h: 22 }, targetSm: { x: -22, y: -40 } },
    { src: img(7), stackOffset: { x: 14, y: -10 }, stackRotate: 20, target: { x: 32, y: -30, scale: 0.9, w: 18, h: 32 }, targetSm: { x: 22, y: -40 } },
    { src: img(6), stackOffset: { x: -16, y: 0 }, stackRotate: -4, target: { x: -36, y: -2, scale: 0.9, w: 15, h: 32 }, targetSm: { x: -22, y: -19 } },
    { src: img(5), stackOffset: { x: 1, y: -10 }, stackRotate: -2, target: { x: 6, y: -32, scale: 0.8, w: 25, h: 30 }, targetSm: { x: 22, y: -19 } },
    { src: img(4), stackOffset: { x: 18, y: 1 }, stackRotate: 6, target: { x: 37, y: 6, scale: 0.8, w: 18, h: 32 }, targetSm: { x: -22, y: 20 } },
    { src: img(3), stackOffset: { x: -6, y: 10 }, stackRotate: 6, target: { x: -24, y: 34, scale: 0.9, w: 22, h: 25 }, targetSm: { x: 22, y: 20 } },
    { src: img(2), stackOffset: { x: 8, y: 7 }, stackRotate: 3, target: { x: 2, y: 36, scale: 0.8, w: 20, h: 26 }, targetSm: { x: -22, y: 40 } },
    { src: img(1), stackOffset: { x: 20, y: 12 }, stackRotate: -7, target: { x: 30, y: 34, scale: 0.9, w: 16, h: 20 }, targetSm: { x: 22, y: 40 } },
  ];

  const SCATTER_START = 0.12;
  const SCATTER_END = 0.9;
  const STACK_SCALE = 0.82;
  const TEXT_FADE_START = 0.3;
  const PARALLAX_X = 2.6;
  const PARALLAX_Y = 2.2;

  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)');

  const els = CARDS.map((card, i) => {
    const el = document.createElement('div');
    el.className = 'stack-spread__card';
    el.style.zIndex = String(i + 2);
    const im = document.createElement('img');
    im.src = card.src; im.alt = ''; im.draggable = false; im.loading = 'lazy';
    el.appendChild(im);
    layer.appendChild(el);
    return el;
  });

  // Parallaxe au pointeur, amortie (ressort simplifié), active une fois la pile éparpillée.
  const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });

  let raf = 0;
  const frame = () => {
    raf = 0;
    const rect = wrap.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    const span = wrap.offsetHeight - window.innerHeight;
    const raw = span > 0 ? clamp(-rect.top / span) : 1;
    const p = range(raw, SCATTER_START, SCATTER_END);
    const small = coarse.matches || window.innerWidth <= 768;
    const parallax = !reduce && !small;
    const spread = p >= 0.999;

    const goalX = parallax && spread ? pointer.tx : 0;
    const goalY = parallax && spread ? pointer.ty : 0;
    pointer.x += (goalX - pointer.x) * 0.08;
    pointer.y += (goalY - pointer.y) * 0.08;

    CARDS.forEach((card, i) => {
      const { target } = card;
      const sm = small ? card.targetSm : null;
      const endX = sm ? Math.sign(sm.x) * 22 : target.x;
      const endY = sm ? sm.y : target.y;
      const stackRotate = reduce ? 0 : card.stackRotate;
      const restScale = small ? 0.72 : target.scale;
      const depth = parallax ? 0.55 + (i / (CARDS.length - 1)) * 0.75 : 0;
      const drift = depth * p;
      const dx = card.stackOffset.x + (endX - card.stackOffset.x) * p - pointer.x * PARALLAX_X * drift;
      const dy = card.stackOffset.y + (endY - card.stackOffset.y) * p - pointer.y * PARALLAX_Y * drift;
      const el = els[i];
      el.style.width = `${small ? 40 : target.w}vw`;
      el.style.height = `${small ? 20 : target.h}vh`;
      el.style.transform = `translate(calc(-50% + ${dx}vw), calc(-50% + ${dy}vh)) rotate(${stackRotate * (1 - p)}deg) scale(${STACK_SCALE + (restScale - STACK_SCALE) * p})`;
    });

    copy.style.opacity = String(range(p, TEXT_FADE_START, TEXT_FADE_START + 0.35));
    copy.style.transform = reduce ? 'none' : `scale(${0.85 + 0.15 * range(p, TEXT_FADE_START, 0.9)})`;
    hint.style.opacity = String(1 - range(raw, 0, SCATTER_START));

    // Tant que la parallaxe n'est pas au repos, on continue d'animer.
    if (Math.abs(goalX - pointer.x) > 0.001 || Math.abs(goalY - pointer.y) > 0.001) schedule();
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(frame); };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pointermove', schedule, { passive: true });
  coarse.addEventListener('change', schedule);
  frame();
})();
